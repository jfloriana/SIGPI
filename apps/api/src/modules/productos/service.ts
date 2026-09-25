import { prisma } from "../../db.ts";
import type { Prisma } from "../../generated/prisma/client.ts";
import { auditar } from "../../services/auditoria.ts";
import { contiene, duplicado, esViolacionUnica, type Contexto } from "../../utils/consultas.ts";
import { AppError, noEncontrado } from "../../utils/errores.ts";
import { paginado, rango } from "../../utils/paginacion.ts";
import type { CrearProducto, EditarProducto, ListarProductos } from "./schemas.ts";

const ENTIDAD = "Producto";
const incluir = { categoria: { select: { id: true, nombre: true } } } as const;
type ProductoConCategoria = Prisma.ProductoGetPayload<{ include: typeof incluir }>;

/** Regla 18: un producto está en alerta cuando stock <= stockMinimo. */
export const estaEnAlerta = (p: { stock: number; stockMinimo: number }) => p.stock <= p.stockMinimo;

export function productoRespuesta(p: ProductoConCategoria) {
  return {
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    unidad: p.unidad,
    precio: p.precio.toFixed(2),
    stock: p.stock,
    stockMinimo: p.stockMinimo,
    activo: p.activo,
    enAlerta: estaEnAlerta(p),
    categoria: { id: p.categoria.id, nombre: p.categoria.nombre },
  };
}

/** Datos del producto que se guardan en la bitácora. */
const instantanea = (p: ProductoConCategoria) => {
  const { enAlerta: _enAlerta, ...resto } = productoRespuesta(p);
  return resto;
};

const codigoDuplicado = () => duplicado("codigo", "Ya existe un producto con ese código");

/**
 * El stock solo cambia con movimientos de inventario (entradas, despachos, ajustes), para que
 * siempre cuadre con el kardex. Se rechaza explícitamente en lugar de ignorarlo en silencio.
 */
export function rechazarStock(cuerpo: unknown) {
  if (cuerpo && typeof cuerpo === "object" && Object.hasOwn(cuerpo, "stock")) {
    const mensaje = "El stock no se edita aquí: cambia solo con movimientos de inventario (entradas, despachos y ajustes)";
    throw new AppError(422, "CAMPO_NO_EDITABLE", mensaje, { stock: mensaje });
  }
}

async function verificarCategoria(categoriaId: number) {
  const existe = await prisma.categoria.findUnique({ where: { id: categoriaId } });
  if (!existe) {
    throw new AppError(400, "VALIDACION", "Revise los datos ingresados", { categoriaId: "La categoría no existe" });
  }
}

export async function listar(q: ListarProductos) {
  // alerta=true sin filtro de estado → solo productos activos (los inactivos no se reponen).
  const activo = q.activo ?? (q.alerta === true ? true : undefined);
  const where: Prisma.ProductoWhereInput = {
    ...(q.buscar && { OR: [{ nombre: contiene(q.buscar) }, { codigo: contiene(q.buscar) }] }),
    ...(q.categoriaId && { categoriaId: q.categoriaId }),
    ...(activo !== undefined && { activo }),
    // Comparación entre columnas con referencias de campo de Prisma: funciona en SQLite y PostgreSQL.
    ...(q.alerta === true && { stock: { lte: prisma.producto.fields.stockMinimo } }),
    ...(q.alerta === false && { stock: { gt: prisma.producto.fields.stockMinimo } }),
  };
  const [filas, total] = await Promise.all([
    prisma.producto.findMany({ where, include: incluir, orderBy: [{ codigo: "asc" }, { id: "asc" }], ...rango(q) }),
    prisma.producto.count({ where }),
  ]);
  return paginado(filas.map(productoRespuesta), total, q);
}

export async function obtener(id: number) {
  const p = await prisma.producto.findUnique({ where: { id }, include: incluir });
  if (!p) throw noEncontrado(ENTIDAD);
  return productoRespuesta(p);
}

export async function crear(datos: CrearProducto, ctx: Contexto) {
  if (await prisma.producto.findUnique({ where: { codigo: datos.codigo } })) throw codigoDuplicado();
  await verificarCategoria(datos.categoriaId);
  try {
    const creado = await prisma.$transaction(async (tx) => {
      // El stock inicial es 0: se carga con una entrada de inventario.
      const p = await tx.producto.create({ data: { ...datos, stock: 0 }, include: incluir });
      await auditar(tx, {
        usuarioId: ctx.usuarioId,
        accion: "CREAR",
        entidad: ENTIDAD,
        entidadId: p.id,
        despues: instantanea(p),
        ip: ctx.ip,
      });
      return p;
    });
    return productoRespuesta(creado);
  } catch (e) {
    if (esViolacionUnica(e)) throw codigoDuplicado();
    throw e;
  }
}

export async function actualizar(id: number, datos: EditarProducto, ctx: Contexto) {
  const actual = await prisma.producto.findUnique({ where: { id }, include: incluir });
  if (!actual) throw noEncontrado(ENTIDAD);

  if (datos.codigo !== undefined && datos.codigo !== actual.codigo) {
    if (await prisma.producto.findUnique({ where: { codigo: datos.codigo } })) throw codigoDuplicado();
  }
  if (datos.categoriaId !== undefined) await verificarCategoria(datos.categoriaId);

  try {
    const actualizado = await prisma.$transaction(async (tx) => {
      const p = await tx.producto.update({ where: { id }, data: datos, include: incluir });
      await auditar(tx, {
        usuarioId: ctx.usuarioId,
        accion: datos.activo === false ? "DESACTIVAR" : "EDITAR",
        entidad: ENTIDAD,
        entidadId: id,
        antes: instantanea(actual),
        despues: instantanea(p),
        ip: ctx.ip,
      });
      return p;
    });
    return productoRespuesta(actualizado);
  } catch (e) {
    if (esViolacionUnica(e)) throw codigoDuplicado();
    throw e;
  }
}
