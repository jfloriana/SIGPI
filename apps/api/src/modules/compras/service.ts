import { randomUUID } from "node:crypto";
import { prisma, type Tx } from "../../db.ts";
import { Prisma } from "../../generated/prisma/client.ts";
import { auditar } from "../../services/auditoria.ts";
import type { Contexto } from "../../utils/consultas.ts";
import { AppError, accesoDenegado, noEncontrado } from "../../utils/errores.ts";
import { filtroFechas } from "../../utils/fechas.ts";
import { paginado, rango } from "../../utils/paginacion.ts";
import { ROLES, type Rol } from "../../utils/roles.ts";
import type { CrearOrden, EstadoOC, ListarOrdenes, Sugerida } from "./schemas.ts";

const ENTIDAD = "OrdenCompra";
const { ADMIN, GERENTE, ALMACENERO } = ROLES;

/**
 * Supuesto del demo (confirmado por el usuario): el costo unitario sugerido es el 80 % del precio de venta.
 * Es editable en el formulario antes de crear la orden.
 */
export const FACTOR_COSTO_SUGERIDO = new Prisma.Decimal("0.80");

export type AccionOC = "aprobar" | "anular" | "recepcionar";
export const ACCIONES_OC: AccionOC[] = ["aprobar", "recepcionar", "anular"];

/** Solo el GERENTE aprueba (segregación: el ADMIN solo consulta y anula). */
export const ROLES_POR_ACCION_OC: Record<AccionOC, Rol[]> = {
  aprobar: [GERENTE],
  anular: [GERENTE, ADMIN],
  recepcionar: [ALMACENERO],
};

const TRANSICIONES: Record<AccionOC, { desde: EstadoOC[]; hacia: EstadoOC }> = {
  aprobar: { desde: ["PENDIENTE"], hacia: "APROBADA" },
  recepcionar: { desde: ["APROBADA"], hacia: "RECIBIDA" },
  anular: { desde: ["PENDIENTE", "APROBADA"], hacia: "ANULADA" },
};

const ESTADOS_ALMACENERO: EstadoOC[] = ["APROBADA", "RECIBIDA"];

export const codigoOrden = (id: number) => `OC-${String(id).padStart(6, "0")}`;
const dinero = (d: Prisma.Decimal) => d.toFixed(2);
const transicionInvalida = (de: string, a: string) =>
  new AppError(422, "TRANSICION_INVALIDA", `No se puede pasar de ${de} a ${a}`);

// ---------------------------------------------------------------------------------------------
// Visibilidad y permisos

type OrdenMin = { estado: string };

function puedeVer(o: OrdenMin, ctx: Contexto) {
  if (ctx.rol === ALMACENERO) return ESTADOS_ALMACENERO.includes(o.estado as EstadoOC);
  return ctx.rol === ADMIN || ctx.rol === GERENTE;
}

export function evaluarAccion(accion: AccionOC, o: OrdenMin, ctx: Contexto): AppError | null {
  if (!ROLES_POR_ACCION_OC[accion].includes(ctx.rol)) return accesoDenegado();
  if (!puedeVer(o, ctx)) return accesoDenegado("No tiene acceso a esta orden de compra");
  const t = TRANSICIONES[accion];
  if (!t.desde.includes(o.estado as EstadoOC)) return transicionInvalida(o.estado, t.hacia);
  return null;
}

const accionesPermitidas = (o: OrdenMin, ctx: Contexto) => ACCIONES_OC.filter((a) => evaluarAccion(a, o, ctx) === null);

// ---------------------------------------------------------------------------------------------
// Consultas

const incluirFila = {
  proveedor: { select: { id: true, ruc: true, razonSocial: true } },
  detalles: { select: { cantidad: true, costoUnit: true } },
} satisfies Prisma.OrdenCompraInclude;

const incluirDetalle = {
  proveedor: true,
  detalles: {
    include: { producto: { select: { id: true, codigo: true, nombre: true, unidad: true, stock: true, stockMinimo: true } } },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.OrdenCompraInclude;

const subtotal = (d: { cantidad: number; costoUnit: Prisma.Decimal }) =>
  d.costoUnit.mul(d.cantidad).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
const totalDe = (detalles: { cantidad: number; costoUnit: Prisma.Decimal }[]) =>
  detalles.reduce((a, d) => a.add(subtotal(d)), new Prisma.Decimal(0));

// ---------------------------------------------------------------------------------------------
// Lógica pura compartida con la carga de datos históricos (prisma/seed).

/** Costo unitario sugerido: 80 % del precio de venta, a 2 decimales (supuesto del demo). */
export const costoSugerido = (precio: Prisma.Decimal) =>
  precio.mul(FACTOR_COSTO_SUGERIDO).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

/** Motivo y referencia de los movimientos ENTRADA de una recepción. */
export const motivoRecepcion = (codigo: string) => `Recepción ${codigo}`;

export type MovimientoRecepcion = { productoId: number; codigo: string; cantidad: number; stockResultante: number };

/** Contenido de la bitácora (acción, antes y después) de cada operación sobre una orden de compra. */
export const bitacoraOrden = {
  crear: (d: {
    codigo: string;
    proveedor: { id: number; razonSocial: string };
    lineas: { productoId: number; codigo: string; cantidad: number; costoUnit: string }[];
  }) => ({
    accion: "CREAR" as const,
    despues: {
      codigo: d.codigo,
      estado: "PENDIENTE",
      proveedor: { id: d.proveedor.id, razonSocial: d.proveedor.razonSocial },
      total: dinero(totalDe(d.lineas.map((l) => ({ cantidad: l.cantidad, costoUnit: new Prisma.Decimal(l.costoUnit) })))),
      lineas: d.lineas.map((l) => ({ productoId: l.productoId, codigo: l.codigo, cantidad: l.cantidad, costoUnit: l.costoUnit })),
    },
  }),
  aprobacion: (estadoPrevio: string) => ({
    accion: "CAMBIO_ESTADO" as const,
    antes: { estado: estadoPrevio },
    despues: { estado: "APROBADA" },
  }),
  recepcion: (estadoPrevio: string, movimientos: MovimientoRecepcion[]) => ({
    accion: "RECEPCION" as const,
    antes: { estado: estadoPrevio },
    despues: { estado: "RECIBIDA", movimientos },
  }),
  anulacion: (estadoPrevio: string, motivo: string) => ({
    accion: "ANULAR" as const,
    antes: { estado: estadoPrevio },
    despues: { estado: "ANULADA", motivo },
  }),
};

export async function listar(q: ListarOrdenes, ctx: Contexto) {
  const visibilidad: Prisma.OrdenCompraWhereInput = ctx.rol === ALMACENERO ? { estado: { in: ESTADOS_ALMACENERO } } : {};
  const filtros: Prisma.OrdenCompraWhereInput = {
    ...(q.estado && { estado: q.estado }),
    ...(q.proveedorId && { proveedorId: q.proveedorId }),
    ...((q.desde || q.hasta) && { fecha: filtroFechas(q.desde, q.hasta) }),
  };
  const where: Prisma.OrdenCompraWhereInput = { AND: [visibilidad, filtros] };
  const [filas, total] = await Promise.all([
    prisma.ordenCompra.findMany({ where, include: incluirFila, orderBy: [{ fecha: "desc" }, { id: "desc" }], ...rango(q) }),
    prisma.ordenCompra.count({ where }),
  ]);
  return paginado(
    filas.map((o) => ({
      id: o.id,
      codigo: o.codigo,
      fecha: o.fecha,
      estado: o.estado,
      proveedor: o.proveedor,
      numLineas: o.detalles.length,
      total: dinero(totalDe(o.detalles)),
    })),
    total,
    q,
  );
}

export async function obtener(id: number, ctx: Contexto) {
  const o = await prisma.ordenCompra.findUnique({ where: { id }, include: incluirDetalle });
  if (!o) throw noEncontrado("Orden de compra");
  if (!puedeVer(o, ctx)) throw accesoDenegado("No tiene acceso a esta orden de compra");

  const bitacora = await prisma.bitacora.findMany({
    where: { entidad: ENTIDAD, entidadId: String(id) },
    include: { usuario: { select: { id: true, nombre: true } } },
    orderBy: { id: "asc" },
  });
  const historial = bitacora.map((b) => {
    const d = JSON.parse(b.detalle) as { antes: unknown; despues: unknown };
    return { id: b.id, accion: b.accion, usuario: b.usuario, fecha: b.fecha, antes: d.antes, despues: d.despues };
  });
  // El esquema no tiene columna para el motivo de anulación: se toma del registro ANULAR de la bitácora.
  const anulacion = historial.find((h) => h.accion === "ANULAR");
  const motivoAnulacion = anulacion ? ((anulacion.despues as { motivo?: string } | null)?.motivo ?? null) : null;
  const creacion = historial.find((h) => h.accion === "CREAR");

  return {
    id: o.id,
    codigo: o.codigo,
    fecha: o.fecha,
    estado: o.estado,
    proveedor: { id: o.proveedor.id, ruc: o.proveedor.ruc, razonSocial: o.proveedor.razonSocial, telefono: o.proveedor.telefono },
    creadoPor: creacion?.usuario ?? null,
    motivoAnulacion,
    total: dinero(totalDe(o.detalles)),
    lineas: o.detalles.map((d) => ({
      id: d.id,
      producto: d.producto,
      cantidad: d.cantidad,
      costoUnit: dinero(d.costoUnit),
      subtotal: dinero(subtotal(d)),
    })),
    historial,
    acciones: accionesPermitidas(o, ctx),
  };
}

// ---------------------------------------------------------------------------------------------
// Orden sugerida (regla 18): propuesta sin guardar.

export async function sugerida(datos: Sugerida) {
  let proveedor = null;
  if (datos.proveedorId !== undefined) {
    proveedor = await prisma.proveedor.findUnique({
      where: { id: datos.proveedorId },
      select: { id: true, ruc: true, razonSocial: true },
    });
    if (!proveedor) throw new AppError(400, "VALIDACION", "Revise los datos ingresados", { proveedorId: "El proveedor no existe" });
  }

  const where: Prisma.ProductoWhereInput = datos.productoIds
    ? { id: { in: datos.productoIds }, activo: true }
    : { activo: true, stock: { lte: prisma.producto.fields.stockMinimo } };
  const productos = await prisma.producto.findMany({ where, orderBy: { codigo: "asc" } });
  if (datos.productoIds) {
    const encontrados = new Set(productos.map((p) => p.id));
    const faltan = datos.productoIds.filter((pid) => !encontrados.has(pid));
    if (faltan.length) {
      throw new AppError(400, "VALIDACION", "Revise los datos ingresados", {
        productoIds: `Productos inexistentes o inactivos: ${faltan.join(", ")}`,
      });
    }
  }

  const lineas = productos.map((p) => {
    const costoUnit = costoSugerido(p.precio);
    // cantidad = stockMinimo × 2 − stock; al menos 1 (p. ej., si se pide un producto que no está en alerta).
    const cantidad = Math.max(p.stockMinimo * 2 - p.stock, 1);
    return {
      producto: {
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        unidad: p.unidad,
        stock: p.stock,
        stockMinimo: p.stockMinimo,
        precio: dinero(p.precio),
      },
      cantidad,
      costoUnit: dinero(costoUnit),
      subtotal: dinero(costoUnit.mul(cantidad).toDecimalPlaces(2)),
    };
  });
  const total = lineas.reduce((a, l) => a.add(l.subtotal), new Prisma.Decimal(0));

  return {
    proveedor,
    supuestoCosto: "Costo unitario = 80 % del precio de venta (supuesto del demo; editable)",
    lineas,
    total: dinero(total),
  };
}

// ---------------------------------------------------------------------------------------------
// Creación y transiciones

export async function crear(datos: CrearOrden, ctx: Contexto) {
  const id = await prisma.$transaction(async (tx) => {
    const proveedor = await tx.proveedor.findUnique({ where: { id: datos.proveedorId } });
    if (!proveedor) throw new AppError(400, "VALIDACION", "Revise los datos ingresados", { proveedorId: "El proveedor no existe" });

    const productos = await tx.producto.findMany({ where: { id: { in: datos.lineas.map((l) => l.productoId) } } });
    const porId = new Map(productos.map((p) => [p.id, p]));
    const invalidos: Record<string, string> = {};
    datos.lineas.forEach((l, i) => {
      const p = porId.get(l.productoId);
      if (!p || !p.activo) invalidos[`lineas.${i}.productoId`] = "El producto no existe o está inactivo";
    });
    if (Object.keys(invalidos).length) throw new AppError(400, "VALIDACION", "Revise los datos ingresados", invalidos);

    const orden = await tx.ordenCompra.create({
      data: {
        codigo: `TMP-${randomUUID()}`,
        proveedorId: proveedor.id,
        estado: "PENDIENTE",
        detalles: { create: datos.lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad, costoUnit: l.costoUnit })) },
      },
    });
    const codigo = codigoOrden(orden.id);
    await tx.ordenCompra.update({ where: { id: orden.id }, data: { codigo } });

    await auditar(tx, {
      usuarioId: ctx.usuarioId,
      entidad: ENTIDAD,
      entidadId: orden.id,
      ip: ctx.ip,
      ...bitacoraOrden.crear({
        codigo,
        proveedor,
        lineas: datos.lineas.map((l) => ({ ...l, codigo: porId.get(l.productoId)!.codigo })),
      }),
    });
    return orden.id;
  });
  return obtener(id, ctx);
}

async function verificarAccion(id: number, accion: AccionOC, ctx: Contexto) {
  const o = await prisma.ordenCompra.findUnique({ where: { id } });
  if (!o) throw noEncontrado("Orden de compra");
  const error = evaluarAccion(accion, o, ctx);
  if (error) throw error;
  return o;
}

/** Cambio de estado condicional: si otra petición lo cambió antes, count = 0 → 422 y nada cambia. */
async function cambiarEstado(tx: Tx, id: number, accion: AccionOC) {
  const { desde, hacia } = TRANSICIONES[accion];
  const r = await tx.ordenCompra.updateMany({ where: { id, estado: { in: desde } }, data: { estado: hacia } });
  if (r.count !== 1) {
    const actual = await tx.ordenCompra.findUniqueOrThrow({ where: { id }, select: { estado: true } });
    throw transicionInvalida(actual.estado, hacia);
  }
}

export async function aprobar(id: number, ctx: Contexto) {
  const o = await verificarAccion(id, "aprobar", ctx);
  await prisma.$transaction(async (tx) => {
    await cambiarEstado(tx, id, "aprobar");
    await auditar(tx, {
      usuarioId: ctx.usuarioId,
      entidad: ENTIDAD,
      entidadId: id,
      ...bitacoraOrden.aprobacion(o.estado),
      ip: ctx.ip,
    });
  });
  return obtener(id, ctx);
}

export async function anular(id: number, motivo: string, ctx: Contexto) {
  const o = await verificarAccion(id, "anular", ctx);
  await prisma.$transaction(async (tx) => {
    await cambiarEstado(tx, id, "anular");
    await auditar(tx, {
      usuarioId: ctx.usuarioId,
      entidad: ENTIDAD,
      entidadId: id,
      ...bitacoraOrden.anulacion(o.estado, motivo),
      ip: ctx.ip,
    });
  });
  return obtener(id, ctx);
}

/** Regla 9: recepcionar suma stock y crea movimientos ENTRADA en una sola transacción. */
export async function recepcionar(id: number, ctx: Contexto) {
  const o = await verificarAccion(id, "recepcionar", ctx);
  await prisma.$transaction(async (tx) => {
    await cambiarEstado(tx, id, "recepcionar");
    const detalles = await tx.detalleOrdenCompra.findMany({
      where: { ordenId: id },
      include: { producto: { select: { codigo: true } } },
      orderBy: { id: "asc" },
    });
    const movimientos: MovimientoRecepcion[] = [];
    for (const d of detalles) {
      const { stock } = await tx.producto.update({
        where: { id: d.productoId },
        data: { stock: { increment: d.cantidad } },
        select: { stock: true },
      });
      await tx.movInventario.create({
        data: {
          productoId: d.productoId,
          tipo: "ENTRADA",
          cantidad: d.cantidad,
          stockResultante: stock,
          motivo: motivoRecepcion(o.codigo),
          referencia: o.codigo,
          usuarioId: ctx.usuarioId,
        },
      });
      movimientos.push({ productoId: d.productoId, codigo: d.producto.codigo, cantidad: d.cantidad, stockResultante: stock });
    }
    await auditar(tx, {
      usuarioId: ctx.usuarioId,
      entidad: ENTIDAD,
      entidadId: id,
      ...bitacoraOrden.recepcion(o.estado, movimientos),
      ip: ctx.ip,
    });
  });
  return obtener(id, ctx);
}
