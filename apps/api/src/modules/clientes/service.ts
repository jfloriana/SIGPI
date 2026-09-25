import { prisma } from "../../db.ts";
import type { Cliente, Prisma } from "../../generated/prisma/client.ts";
import { auditar } from "../../services/auditoria.ts";
import { contiene, duplicado, esViolacionUnica, type Contexto } from "../../utils/consultas.ts";
import { accesoDenegado, noEncontrado } from "../../utils/errores.ts";
import { paginado, rango } from "../../utils/paginacion.ts";
import { ROLES } from "../../utils/roles.ts";
import type { CrearCliente, EditarCliente, ListarClientes } from "./schemas.ts";

const ENTIDAD = "Cliente";

export function clienteRespuesta(c: Cliente) {
  return {
    id: c.id,
    tipoDoc: c.tipoDoc,
    numDoc: c.numDoc,
    razonSocial: c.razonSocial,
    direccion: c.direccion,
    telefono: c.telefono,
    zona: c.zona,
    activo: c.activo,
  };
}

const docDuplicado = () => duplicado("numDoc", "Ya existe un cliente con ese número de documento");

export async function listar(q: ListarClientes) {
  const where: Prisma.ClienteWhereInput = {
    ...(q.buscar && { OR: [{ razonSocial: contiene(q.buscar) }, { numDoc: { contains: q.buscar } }] }),
    ...(q.zona && { zona: q.zona }),
    ...(q.activo !== undefined && { activo: q.activo }),
  };
  const [filas, total] = await Promise.all([
    prisma.cliente.findMany({ where, orderBy: [{ razonSocial: "asc" }, { id: "asc" }], ...rango(q) }),
    prisma.cliente.count({ where }),
  ]);
  return paginado(filas.map(clienteRespuesta), total, q);
}

export async function obtener(id: number) {
  const c = await prisma.cliente.findUnique({ where: { id } });
  if (!c) throw noEncontrado(ENTIDAD);
  return clienteRespuesta(c);
}

export async function crear(datos: CrearCliente, ctx: Contexto) {
  if (await prisma.cliente.findUnique({ where: { numDoc: datos.numDoc } })) throw docDuplicado();
  try {
    const creado = await prisma.$transaction(async (tx) => {
      const c = await tx.cliente.create({ data: { ...datos, telefono: datos.telefono ?? null } });
      await auditar(tx, {
        usuarioId: ctx.usuarioId,
        accion: "CREAR",
        entidad: ENTIDAD,
        entidadId: c.id,
        despues: clienteRespuesta(c),
        ip: ctx.ip,
      });
      return c;
    });
    return clienteRespuesta(creado);
  } catch (e) {
    if (esViolacionUnica(e)) throw docDuplicado();
    throw e;
  }
}

export async function actualizar(id: number, datos: EditarCliente, ctx: Contexto) {
  // El VENDEDOR crea y edita, pero no activa ni desactiva clientes.
  if (datos.activo !== undefined && ctx.rol !== ROLES.ADMIN) {
    throw accesoDenegado("Solo el administrador puede activar o desactivar clientes");
  }

  const actual = await prisma.cliente.findUnique({ where: { id } });
  if (!actual) throw noEncontrado(ENTIDAD);

  if (datos.numDoc !== undefined && datos.numDoc !== actual.numDoc) {
    const otro = await prisma.cliente.findUnique({ where: { numDoc: datos.numDoc } });
    if (otro && otro.id !== id) throw docDuplicado();
  }

  try {
    const actualizado = await prisma.$transaction(async (tx) => {
      const c = await tx.cliente.update({ where: { id }, data: datos });
      await auditar(tx, {
        usuarioId: ctx.usuarioId,
        accion: datos.activo === false ? "DESACTIVAR" : "EDITAR",
        entidad: ENTIDAD,
        entidadId: id,
        antes: clienteRespuesta(actual),
        despues: clienteRespuesta(c),
        ip: ctx.ip,
      });
      return c;
    });
    return clienteRespuesta(actualizado);
  } catch (e) {
    if (esViolacionUnica(e)) throw docDuplicado();
    throw e;
  }
}
