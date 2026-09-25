import { prisma } from "../../db.ts";
import type { Prisma, Proveedor } from "../../generated/prisma/client.ts";
import { auditar } from "../../services/auditoria.ts";
import { contiene, duplicado, esViolacionUnica, type Contexto } from "../../utils/consultas.ts";
import { noEncontrado } from "../../utils/errores.ts";
import { paginado, rango } from "../../utils/paginacion.ts";
import type { CrearProveedor, EditarProveedor, ListarProveedores } from "./schemas.ts";

const ENTIDAD = "Proveedor";

export function proveedorRespuesta(p: Proveedor) {
  return { id: p.id, ruc: p.ruc, razonSocial: p.razonSocial, telefono: p.telefono };
}

const rucDuplicado = () => duplicado("ruc", "Ya existe un proveedor con ese RUC");

export async function listar(q: ListarProveedores) {
  const where: Prisma.ProveedorWhereInput = q.buscar
    ? { OR: [{ razonSocial: contiene(q.buscar) }, { ruc: { contains: q.buscar } }] }
    : {};
  const [filas, total] = await Promise.all([
    prisma.proveedor.findMany({ where, orderBy: [{ razonSocial: "asc" }, { id: "asc" }], ...rango(q) }),
    prisma.proveedor.count({ where }),
  ]);
  return paginado(filas.map(proveedorRespuesta), total, q);
}

export async function obtener(id: number) {
  const p = await prisma.proveedor.findUnique({ where: { id } });
  if (!p) throw noEncontrado(ENTIDAD);
  return proveedorRespuesta(p);
}

export async function crear(datos: CrearProveedor, ctx: Contexto) {
  if (await prisma.proveedor.findUnique({ where: { ruc: datos.ruc } })) throw rucDuplicado();
  try {
    const creado = await prisma.$transaction(async (tx) => {
      const p = await tx.proveedor.create({ data: { ...datos, telefono: datos.telefono ?? null } });
      await auditar(tx, {
        usuarioId: ctx.usuarioId,
        accion: "CREAR",
        entidad: ENTIDAD,
        entidadId: p.id,
        despues: proveedorRespuesta(p),
        ip: ctx.ip,
      });
      return p;
    });
    return proveedorRespuesta(creado);
  } catch (e) {
    if (esViolacionUnica(e)) throw rucDuplicado();
    throw e;
  }
}

export async function actualizar(id: number, datos: EditarProveedor, ctx: Contexto) {
  const actual = await prisma.proveedor.findUnique({ where: { id } });
  if (!actual) throw noEncontrado(ENTIDAD);
  if (datos.ruc !== undefined && datos.ruc !== actual.ruc) {
    if (await prisma.proveedor.findUnique({ where: { ruc: datos.ruc } })) throw rucDuplicado();
  }
  try {
    const actualizado = await prisma.$transaction(async (tx) => {
      const p = await tx.proveedor.update({ where: { id }, data: datos });
      await auditar(tx, {
        usuarioId: ctx.usuarioId,
        accion: "EDITAR",
        entidad: ENTIDAD,
        entidadId: id,
        antes: proveedorRespuesta(actual),
        despues: proveedorRespuesta(p),
        ip: ctx.ip,
      });
      return p;
    });
    return proveedorRespuesta(actualizado);
  } catch (e) {
    if (esViolacionUnica(e)) throw rucDuplicado();
    throw e;
  }
}
