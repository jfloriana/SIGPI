// Regla 17: la bitácora es de solo lectura. Este módulo no expone ninguna operación de escritura;
// los registros solo los crea `auditar()` dentro de la transacción de cada operación.
import { prisma } from "../../db.ts";
import type { Bitacora, Prisma } from "../../generated/prisma/client.ts";
import { noEncontrado } from "../../utils/errores.ts";
import { filtroFechas } from "../../utils/fechas.ts";
import { paginado, rango } from "../../utils/paginacion.ts";
import type { ListarBitacora } from "./schemas.ts";

const incluir = { usuario: { select: { id: true, nombre: true, email: true } } } as const;
type RegistroConUsuario = Bitacora & { usuario: { id: number; nombre: string; email: string } | null };

function parsearDetalle(texto: string): { antes: unknown; despues: unknown } {
  try {
    const d = JSON.parse(texto) as { antes?: unknown; despues?: unknown };
    return { antes: d.antes ?? null, despues: d.despues ?? null };
  } catch {
    return { antes: null, despues: texto };
  }
}

export function registroRespuesta(b: RegistroConUsuario) {
  return {
    id: b.id,
    fecha: b.fecha,
    usuario: b.usuario,
    accion: b.accion,
    entidad: b.entidad,
    entidadId: b.entidadId,
    detalle: parsearDetalle(b.detalle),
    ip: b.ip,
  };
}

export async function listar(q: ListarBitacora) {
  const where: Prisma.BitacoraWhereInput = {
    ...(q.usuarioId && { usuarioId: q.usuarioId }),
    ...(q.entidad && { entidad: q.entidad }),
    ...(q.entidadId && { entidadId: q.entidadId }),
    ...(q.accion && { accion: q.accion }),
    ...((q.desde || q.hasta) && { fecha: filtroFechas(q.desde, q.hasta) }),
  };
  const [filas, total] = await Promise.all([
    prisma.bitacora.findMany({ where, include: incluir, orderBy: [{ fecha: "desc" }, { id: "desc" }], ...rango(q) }),
    prisma.bitacora.count({ where }),
  ]);
  return paginado(filas.map(registroRespuesta), total, q);
}

export async function obtener(id: number) {
  const b = await prisma.bitacora.findUnique({ where: { id }, include: incluir });
  if (!b) throw noEncontrado("Registro de bitácora");
  return registroRespuesta(b);
}

/** Valores distintos de `entidad` y `accion` presentes en la bitácora (para los desplegables de filtro). */
export async function filtros() {
  const [entidades, acciones] = await Promise.all([
    prisma.bitacora.findMany({ distinct: ["entidad"], select: { entidad: true }, orderBy: { entidad: "asc" } }),
    prisma.bitacora.findMany({ distinct: ["accion"], select: { accion: true }, orderBy: { accion: "asc" } }),
  ]);
  return { entidades: entidades.map((e) => e.entidad), acciones: acciones.map((a) => a.accion) };
}
