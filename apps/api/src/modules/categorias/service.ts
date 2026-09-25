import { prisma } from "../../db.ts";
import type { Prisma } from "../../generated/prisma/client.ts";
import { auditar } from "../../services/auditoria.ts";
import { contiene, duplicado, esViolacionUnica, type Contexto } from "../../utils/consultas.ts";
import { AppError } from "../../utils/errores.ts";
import { paginado, rango } from "../../utils/paginacion.ts";
import type { DatosCategoria, ListarCategorias } from "./schemas.ts";

const ENTIDAD = "Categoria";
const incluir = { _count: { select: { productos: true } } } as const;
type CategoriaConConteo = Prisma.CategoriaGetPayload<{ include: typeof incluir }>;

/** `numProductos` cuenta todos los productos de la categoría (activos e inactivos). */
export function categoriaRespuesta(c: CategoriaConConteo) {
  return { id: c.id, nombre: c.nombre, numProductos: c._count.productos };
}

const nombreDuplicado = () => duplicado("nombre", "Ya existe una categoría con ese nombre");

export async function listar(q: ListarCategorias) {
  const where: Prisma.CategoriaWhereInput = q.buscar ? { nombre: contiene(q.buscar) } : {};
  const [filas, total] = await Promise.all([
    prisma.categoria.findMany({ where, include: incluir, orderBy: [{ nombre: "asc" }, { id: "asc" }], ...rango(q) }),
    prisma.categoria.count({ where }),
  ]);
  return paginado(filas.map(categoriaRespuesta), total, q);
}

export async function obtener(id: number) {
  const c = await prisma.categoria.findUnique({ where: { id }, include: incluir });
  if (!c) throw new AppError(404, "NO_ENCONTRADO", "Categoría no encontrada");
  return categoriaRespuesta(c);
}

async function verificarNombreLibre(nombre: string, excluirId?: number) {
  // Comparación sin distinguir mayúsculas para evitar "Aceites" y "aceites".
  const todas = await prisma.categoria.findMany({ select: { id: true, nombre: true } });
  const choca = todas.some((c) => c.id !== excluirId && c.nombre.toLocaleLowerCase("es") === nombre.toLocaleLowerCase("es"));
  if (choca) throw nombreDuplicado();
}

export async function crear(datos: DatosCategoria, ctx: Contexto) {
  await verificarNombreLibre(datos.nombre);
  try {
    const creada = await prisma.$transaction(async (tx) => {
      const c = await tx.categoria.create({ data: datos, include: incluir });
      await auditar(tx, {
        usuarioId: ctx.usuarioId,
        accion: "CREAR",
        entidad: ENTIDAD,
        entidadId: c.id,
        despues: { nombre: c.nombre },
        ip: ctx.ip,
      });
      return c;
    });
    return categoriaRespuesta(creada);
  } catch (e) {
    if (esViolacionUnica(e)) throw nombreDuplicado();
    throw e;
  }
}

export async function actualizar(id: number, datos: DatosCategoria, ctx: Contexto) {
  const actual = await prisma.categoria.findUnique({ where: { id } });
  if (!actual) throw new AppError(404, "NO_ENCONTRADO", "Categoría no encontrada");
  await verificarNombreLibre(datos.nombre, id);
  try {
    const actualizada = await prisma.$transaction(async (tx) => {
      const c = await tx.categoria.update({ where: { id }, data: datos, include: incluir });
      await auditar(tx, {
        usuarioId: ctx.usuarioId,
        accion: "EDITAR",
        entidad: ENTIDAD,
        entidadId: id,
        antes: { nombre: actual.nombre },
        despues: { nombre: c.nombre },
        ip: ctx.ip,
      });
      return c;
    });
    return categoriaRespuesta(actualizada);
  } catch (e) {
    if (esViolacionUnica(e)) throw nombreDuplicado();
    throw e;
  }
}
