import { prisma } from "../../db.ts";
import type { MovInventario, Prisma, Producto } from "../../generated/prisma/client.ts";
import { auditar } from "../../services/auditoria.ts";
import type { Contexto } from "../../utils/consultas.ts";
import { AppError, noEncontrado } from "../../utils/errores.ts";
import { filtroFechas } from "../../utils/fechas.ts";
import { paginado, rango } from "../../utils/paginacion.ts";
import type { Ajuste, Kardex } from "./schemas.ts";

type ProductoKardex = Pick<Producto, "id" | "codigo" | "nombre" | "unidad" | "stock" | "stockMinimo">;

export function productoKardex(p: ProductoKardex) {
  return {
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    unidad: p.unidad,
    stock: p.stock,
    stockMinimo: p.stockMinimo,
    enAlerta: p.stock <= p.stockMinimo,
  };
}

type MovConUsuario = MovInventario & { usuario: { id: number; nombre: string } };

export function movimientoRespuesta(m: MovConUsuario) {
  return {
    id: m.id,
    fecha: m.fecha,
    tipo: m.tipo,
    cantidad: m.cantidad,
    stockResultante: m.stockResultante,
    motivo: m.motivo,
    referencia: m.referencia,
    usuario: m.usuario,
  };
}

const conUsuario = { usuario: { select: { id: true, nombre: true } } } as const;

export async function kardex(productoId: number, q: Kardex) {
  const producto = await prisma.producto.findUnique({ where: { id: productoId } });
  if (!producto) throw noEncontrado("Producto");

  const where: Prisma.MovInventarioWhereInput = {
    productoId,
    ...(q.tipo && { tipo: q.tipo }),
    ...((q.desde || q.hasta) && { fecha: filtroFechas(q.desde, q.hasta) }),
  };
  const [filas, total, sumas] = await Promise.all([
    prisma.movInventario.findMany({
      where,
      include: conUsuario,
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      ...rango(q),
    }),
    prisma.movInventario.count({ where }),
    // El resumen es sobre TODOS los movimientos del producto, sin filtros ni paginación.
    prisma.movInventario.groupBy({ by: ["tipo"], where: { productoId }, _sum: { cantidad: true } }),
  ]);

  const suma = (tipo: string) => sumas.find((s) => s.tipo === tipo)?._sum.cantidad ?? 0;
  const entradas = suma("ENTRADA");
  const salidas = suma("SALIDA");
  const ajustesPositivos = suma("AJUSTE_POSITIVO");
  const ajustesNegativos = suma("AJUSTE_NEGATIVO");
  const saldoCalculado = entradas + ajustesPositivos - salidas - ajustesNegativos;

  return {
    producto: productoKardex(producto),
    resumen: { entradas, salidas, ajustesPositivos, ajustesNegativos, saldoCalculado, cuadra: saldoCalculado === producto.stock },
    ...paginado(filas.map(movimientoRespuesta), total, q),
  };
}

/** Regla 18: productos activos con stock <= stockMinimo, del más crítico al menos crítico. */
export async function alertas() {
  const productos = await prisma.producto.findMany({
    where: { activo: true, stock: { lte: prisma.producto.fields.stockMinimo } },
    include: { categoria: { select: { id: true, nombre: true } } },
  });
  const criticidad = (p: { stock: number; stockMinimo: number }) => (p.stockMinimo === 0 ? 0 : p.stock / p.stockMinimo);
  return productos
    .sort((a, b) => criticidad(a) - criticidad(b) || a.codigo.localeCompare(b.codigo))
    .map((p) => ({
      ...productoKardex(p),
      precio: p.precio.toFixed(2),
      categoria: p.categoria,
      cantidadSugerida: p.stockMinimo * 2 - p.stock,
    }));
}

export async function registrarAjuste(datos: Ajuste, ctx: Contexto) {
  const producto = await prisma.producto.findUnique({ where: { id: datos.productoId } });
  if (!producto) {
    throw new AppError(400, "VALIDACION", "Revise los datos ingresados", { productoId: "El producto no existe" });
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const antes = await tx.producto.findUniqueOrThrow({ where: { id: datos.productoId }, select: { stock: true } });
    if (datos.tipo === "AJUSTE_NEGATIVO") {
      // Regla 10: un ajuste negativo nunca deja stock < 0 (condición en la propia escritura).
      const r = await tx.producto.updateMany({
        where: { id: datos.productoId, stock: { gte: datos.cantidad } },
        data: { stock: { decrement: datos.cantidad } },
      });
      if (r.count !== 1) {
        const actual = await tx.producto.findUniqueOrThrow({ where: { id: datos.productoId }, select: { stock: true } });
        const mensaje = `Stock insuficiente para ${producto.nombre} (${producto.codigo}): stock disponible ${actual.stock}, solicitado ${datos.cantidad}`;
        throw new AppError(409, "STOCK_INSUFICIENTE", mensaje, { cantidad: `Stock disponible: ${actual.stock}` }, {
          productos: [
            { productoId: producto.id, codigo: producto.codigo, nombre: producto.nombre, stockDisponible: actual.stock, solicitado: datos.cantidad },
          ],
        });
      }
    } else {
      await tx.producto.update({ where: { id: datos.productoId }, data: { stock: { increment: datos.cantidad } } });
    }

    const actualizado = await tx.producto.findUniqueOrThrow({ where: { id: datos.productoId } });
    const movimiento = await tx.movInventario.create({
      data: {
        productoId: datos.productoId,
        tipo: datos.tipo,
        cantidad: datos.cantidad,
        stockResultante: actualizado.stock,
        motivo: datos.motivo,
        referencia: datos.referencia ?? null,
        usuarioId: ctx.usuarioId,
      },
      include: conUsuario,
    });
    await auditar(tx, {
      usuarioId: ctx.usuarioId,
      accion: "AJUSTE",
      entidad: "Producto",
      entidadId: datos.productoId,
      antes: { stock: antes.stock },
      despues: {
        stock: actualizado.stock,
        tipo: datos.tipo,
        cantidad: datos.cantidad,
        motivo: datos.motivo,
        referencia: datos.referencia ?? null,
        movimientoId: movimiento.id,
      },
      ip: ctx.ip,
    });
    return { movimiento, producto: actualizado };
  });

  return { movimiento: movimientoRespuesta(resultado.movimiento), producto: productoKardex(resultado.producto) };
}
