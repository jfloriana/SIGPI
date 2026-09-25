import { prisma } from "../../db.ts";
import { Prisma } from "../../generated/prisma/client.ts";
import type { Contexto } from "../../utils/consultas.ts";
import { AppError } from "../../utils/errores.ts";
import { filtroFechas } from "../../utils/fechas.ts";
import { ROLES } from "../../utils/roles.ts";
import { ZONAS } from "../../utils/validadores.ts";
import * as inventario from "../inventario/service.ts";
import { ESTADOS_PEDIDO } from "../pedidos/schemas.ts";
import type { PeriodoQuery } from "./schemas.ts";

/** Solo estos estados cuentan como venta; la fecha de la venta es `fechaDespacho`. */
export const ESTADOS_VENTA = ["DESPACHADO", "ENTREGADO"];
export const DIAS_POR_DEFECTO = 30;
export const DIAS_MAXIMOS = 366;

const DIA_MS = 86_400_000;
const OFFSET_LIMA_MS = 5 * 3_600_000; // UTC-5 fijo (sin horario de verano)

/** Fecha `AAAA-MM-DD` en hora de Lima. */
export const diaLima = (d: Date) => new Date(d.getTime() - OFFSET_LIMA_MS).toISOString().slice(0, 10);
/** Fecha y hora `AAAA-MM-DD HH:mm` en hora de Lima. */
export const fechaHoraLima = (d: Date) => new Date(d.getTime() - OFFSET_LIMA_MS).toISOString().slice(0, 16).replace("T", " ");
const sumarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA_MS);

const dinero = (d: Prisma.Decimal) => d.toFixed(2);
const cero = () => new Prisma.Decimal(0);

/**
 * Período del reporte. Por defecto, los últimos 30 días incluyendo hoy (hora de Lima).
 * Con solo `desde`, llega hasta hoy; con solo `hasta`, abarca los 30 días que terminan ese día.
 */
export function resolverPeriodo(q: PeriodoQuery): { desde: string; hasta: string } {
  const hoy = diaLima(new Date());
  const hasta = q.hasta ?? (q.desde ? (q.desde > hoy ? q.desde : hoy) : hoy);
  const desde = q.desde ?? sumarDias(hasta, -(DIAS_POR_DEFECTO - 1));
  if (desde > hasta) {
    throw new AppError(400, "VALIDACION", "Revise los datos ingresados", { hasta: "La fecha final no puede ser anterior a la inicial" });
  }
  if (diasEntre(desde, hasta) + 1 > DIAS_MAXIMOS) {
    const mensaje = `El período no puede superar ${DIAS_MAXIMOS} días`;
    throw new AppError(400, "VALIDACION", mensaje, { desde: mensaje });
  }
  return { desde, hasta };
}

export type Alcance = "TOTAL" | "PROPIO" | "STOCK";

export function alcanceDe(ctx: Contexto): Alcance {
  if (ctx.rol === ROLES.VENDEDOR) return "PROPIO";
  if (ctx.rol === ROLES.ALMACENERO) return "STOCK";
  return "TOTAL";
}

/** Pedidos vendidos (despachados o entregados) con fecha de despacho en el período. */
function ventasDelPeriodo(periodo: { desde: string; hasta: string }, vendedorId?: number) {
  return prisma.pedido.findMany({
    where: {
      estado: { in: ESTADOS_VENTA },
      fechaDespacho: filtroFechas(periodo.desde, periodo.hasta),
      ...(vendedorId !== undefined && { vendedorId }),
    },
    include: {
      cliente: { select: { id: true, razonSocial: true, tipoDoc: true, numDoc: true, zona: true } },
      vendedor: { select: { id: true, nombre: true } },
      detalles: { select: { productoId: true, cantidad: true, subtotal: true, producto: { select: { codigo: true, nombre: true } } } },
    },
    orderBy: [{ fechaDespacho: "asc" }, { id: "asc" }],
  });
}

export async function tablero(q: PeriodoQuery, ctx: Contexto) {
  const periodo = resolverPeriodo(q);
  const alcance = alcanceDe(ctx);

  const alertas = alcance === "PROPIO" ? [] : await inventario.alertas();
  const productosEnAlerta = alertas.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    stock: p.stock,
    stockMinimo: p.stockMinimo,
    cantidadSugerida: p.cantidadSugerida,
  }));

  if (alcance === "STOCK") {
    return {
      alcance,
      periodo,
      ventasTotales: null,
      numPedidos: null,
      ticketPromedio: null,
      pedidosPorEstado: [],
      ventasPorDia: [],
      top10Productos: [],
      ventasPorVendedor: [],
      ventasPorZona: [],
      productosEnAlerta,
    };
  }

  const vendedorId = alcance === "PROPIO" ? ctx.usuarioId : undefined;
  const [ventas, porEstado] = await Promise.all([
    ventasDelPeriodo(periodo, vendedorId),
    prisma.pedido.groupBy({
      by: ["estado"],
      where: { fecha: filtroFechas(periodo.desde, periodo.hasta), ...(vendedorId !== undefined && { vendedorId }) },
      _count: { _all: true },
    }),
  ]);

  // Agregación en memoria con Decimal: portable entre SQLite y PostgreSQL y exacta para montos.
  const ventasTotales = ventas.reduce((a, p) => a.add(p.total), cero());
  const numPedidos = ventas.length;
  const ticketPromedio = numPedidos ? ventasTotales.div(numPedidos).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) : cero();

  const dias = new Map<string, { total: Prisma.Decimal; pedidos: number }>();
  for (let d = periodo.desde; d <= periodo.hasta; d = sumarDias(d, 1)) dias.set(d, { total: cero(), pedidos: 0 });
  const productos = new Map<number, { codigo: string; nombre: string; cantidad: number; total: Prisma.Decimal }>();
  const vendedores = new Map<number, { nombre: string; total: Prisma.Decimal; pedidos: number }>();
  const zonas = new Map<string, { total: Prisma.Decimal; pedidos: number }>(ZONAS.map((z) => [z, { total: cero(), pedidos: 0 }]));

  if (vendedorId !== undefined) {
    const yo = await prisma.usuario.findUniqueOrThrow({ where: { id: vendedorId }, select: { nombre: true } });
    vendedores.set(vendedorId, { nombre: yo.nombre, total: cero(), pedidos: 0 });
  }

  for (const p of ventas) {
    const dia = dias.get(diaLima(p.fechaDespacho!));
    if (dia) {
      dia.total = dia.total.add(p.total);
      dia.pedidos++;
    }
    const v = vendedores.get(p.vendedorId) ?? { nombre: p.vendedor.nombre, total: cero(), pedidos: 0 };
    v.total = v.total.add(p.total);
    v.pedidos++;
    vendedores.set(p.vendedorId, v);

    const z = zonas.get(p.cliente.zona) ?? { total: cero(), pedidos: 0 };
    z.total = z.total.add(p.total);
    z.pedidos++;
    zonas.set(p.cliente.zona, z);

    for (const d of p.detalles) {
      const prod = productos.get(d.productoId) ?? { codigo: d.producto.codigo, nombre: d.producto.nombre, cantidad: 0, total: cero() };
      prod.cantidad += d.cantidad;
      prod.total = prod.total.add(d.subtotal);
      productos.set(d.productoId, prod);
    }
  }

  const conteoEstado = new Map(porEstado.map((e) => [e.estado, e._count._all]));

  return {
    alcance,
    periodo,
    ventasTotales: dinero(ventasTotales),
    numPedidos,
    ticketPromedio: dinero(ticketPromedio),
    pedidosPorEstado: ESTADOS_PEDIDO.map((estado) => ({ estado, cantidad: conteoEstado.get(estado) ?? 0 })),
    ventasPorDia: [...dias].map(([fecha, d]) => ({ fecha, total: dinero(d.total), pedidos: d.pedidos })),
    top10Productos: [...productos]
      .sort(([, a], [, b]) => b.total.cmp(a.total) || b.cantidad - a.cantidad || a.codigo.localeCompare(b.codigo))
      .slice(0, 10)
      .map(([productoId, p]) => ({ productoId, codigo: p.codigo, nombre: p.nombre, cantidad: p.cantidad, total: dinero(p.total) })),
    ventasPorVendedor: [...vendedores]
      .sort(([, a], [, b]) => b.total.cmp(a.total) || a.nombre.localeCompare(b.nombre))
      .map(([id, v]) => ({ vendedorId: id, nombre: v.nombre, total: dinero(v.total), pedidos: v.pedidos })),
    ventasPorZona: [...zonas]
      .sort(([za, a], [zb, b]) => b.total.cmp(a.total) || ZONAS.indexOf(za as never) - ZONAS.indexOf(zb as never))
      .map(([zona, z]) => ({ zona, total: dinero(z.total), pedidos: z.pedidos })),
    productosEnAlerta,
  };
}

// ---------------------------------------------------------------------------------------------
// Exportación CSV (Excel en español: BOM UTF-8, separador «;», fin de línea CRLF).

const CABECERA_CSV = ["Código", "Fecha despacho", "Cliente", "Documento", "Zona", "Vendedor", "Condición", "Estado", "Total"];

/**
 * Escapa un campo CSV: entre comillas si contiene `;`, comillas o saltos de línea (las comillas se duplican).
 * Además neutraliza la inyección de fórmulas: un texto que empieza con = + - @ (o tab/CR) se antepone con «'».
 */
export function campoCsv(valor: string, esTexto = true): string {
  let v = valor;
  if (esTexto && /^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function ventasCsv(q: PeriodoQuery, ctx: Contexto) {
  const periodo = resolverPeriodo(q);
  const vendedorId = alcanceDe(ctx) === "PROPIO" ? ctx.usuarioId : undefined;
  const ventas = await ventasDelPeriodo(periodo, vendedorId);

  const filas = ventas.map((p) =>
    [
      campoCsv(p.codigo),
      campoCsv(fechaHoraLima(p.fechaDespacho!)),
      campoCsv(p.cliente.razonSocial),
      campoCsv(`${p.cliente.tipoDoc} ${p.cliente.numDoc}`),
      campoCsv(p.cliente.zona),
      campoCsv(p.vendedor.nombre),
      campoCsv(p.condicionPago),
      campoCsv(p.estado),
      campoCsv(dinero(p.total), false),
    ].join(";"),
  );
  const contenido = "﻿" + [CABECERA_CSV.join(";"), ...filas].join("\r\n") + "\r\n";
  return { nombreArchivo: `ventas_${periodo.desde}_${periodo.hasta}.csv`, contenido };
}
