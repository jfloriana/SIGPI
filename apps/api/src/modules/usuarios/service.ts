import bcrypt from "bcrypt";
import { config } from "../../config.ts";
import { prisma } from "../../db.ts";
import type { Prisma } from "../../generated/prisma/client.ts";
import { auditar } from "../../services/auditoria.ts";
import { contiene, duplicado, esViolacionUnica, type Contexto } from "../../utils/consultas.ts";
import { AppError, noEncontrado } from "../../utils/errores.ts";
import { paginado, rango } from "../../utils/paginacion.ts";
import { ROLES } from "../../utils/roles.ts";
import type { CrearUsuario, EditarUsuario, ListarUsuarios } from "./schemas.ts";

const ENTIDAD = "Usuario";
const incluir = { rol: true } as const;
type UsuarioConRol = Prisma.UsuarioGetPayload<{ include: typeof incluir }>;

/** Forma pública del usuario. Nunca incluye hashClave. */
export function usuarioRespuesta(u: UsuarioConRol) {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol.nombre,
    activo: u.activo,
    bloqueado: u.bloqueadoHasta !== null && u.bloqueadoHasta > new Date(),
    bloqueadoHasta: u.bloqueadoHasta,
    creadoEn: u.creadoEn,
  };
}

/** Datos del usuario que se guardan en la bitácora (sin hashClave). */
const instantanea = (u: UsuarioConRol) => ({
  nombre: u.nombre,
  email: u.email,
  rol: u.rol.nombre,
  activo: u.activo,
});

const emailDuplicado = () => duplicado("email", "Ya existe un usuario con ese correo");

async function idDeRol(nombre: string): Promise<number> {
  const rol = await prisma.rol.findUnique({ where: { nombre } });
  if (!rol) throw new AppError(400, "VALIDACION", "Rol no válido", { rol: "Rol no válido" });
  return rol.id;
}

export async function listar(q: ListarUsuarios) {
  const where: Prisma.UsuarioWhereInput = {
    ...(q.buscar && { OR: [{ nombre: contiene(q.buscar) }, { email: contiene(q.buscar.toLowerCase()) }] }),
    ...(q.rolId && { rolId: q.rolId }),
    ...(q.rol && { rol: { nombre: q.rol } }),
    ...(q.activo !== undefined && { activo: q.activo }),
  };
  const [filas, total] = await Promise.all([
    prisma.usuario.findMany({ where, include: incluir, orderBy: [{ nombre: "asc" }, { id: "asc" }], ...rango(q) }),
    prisma.usuario.count({ where }),
  ]);
  return paginado(filas.map(usuarioRespuesta), total, q);
}

export async function obtener(id: number) {
  const u = await prisma.usuario.findUnique({ where: { id }, include: incluir });
  if (!u) throw noEncontrado(ENTIDAD);
  return usuarioRespuesta(u);
}

export async function crear(datos: CrearUsuario, ctx: Contexto) {
  if (await prisma.usuario.findUnique({ where: { email: datos.email } })) throw emailDuplicado();
  const rolId = await idDeRol(datos.rol);
  const hashClave = await bcrypt.hash(datos.clave, config.rondasBcrypt);

  try {
    const creado = await prisma.$transaction(async (tx) => {
      const u = await tx.usuario.create({
        data: { nombre: datos.nombre, email: datos.email, hashClave, rolId },
        include: incluir,
      });
      await auditar(tx, {
        usuarioId: ctx.usuarioId,
        accion: "CREAR",
        entidad: ENTIDAD,
        entidadId: u.id,
        despues: instantanea(u),
        ip: ctx.ip,
      });
      return u;
    });
    return usuarioRespuesta(creado);
  } catch (e) {
    if (esViolacionUnica(e)) throw emailDuplicado();
    throw e;
  }
}

export async function actualizar(id: number, datos: EditarUsuario, ctx: Contexto) {
  const actual = await prisma.usuario.findUnique({ where: { id }, include: incluir });
  if (!actual) throw noEncontrado(ENTIDAD);

  // Un administrador no puede dejarse sin acceso a sí mismo.
  if (id === ctx.usuarioId) {
    if (datos.activo === false) {
      throw new AppError(422, "OPERACION_NO_PERMITIDA", "No puede desactivar su propia cuenta", {
        activo: "No puede desactivar su propia cuenta",
      });
    }
    if (datos.rol !== undefined && datos.rol !== ROLES.ADMIN) {
      throw new AppError(422, "OPERACION_NO_PERMITIDA", "No puede quitarse a sí mismo el rol ADMIN", {
        rol: "No puede quitarse a sí mismo el rol ADMIN",
      });
    }
  }

  const data: Prisma.UsuarioUncheckedUpdateInput = {};
  const antes: Record<string, unknown> = {};
  const despues: Record<string, unknown> = {};

  if (datos.nombre !== undefined) {
    data.nombre = datos.nombre;
    antes.nombre = actual.nombre;
    despues.nombre = datos.nombre;
  }
  if (datos.rol !== undefined) {
    data.rolId = await idDeRol(datos.rol);
    antes.rol = actual.rol.nombre;
    despues.rol = datos.rol;
  }
  if (datos.activo !== undefined) {
    data.activo = datos.activo;
    antes.activo = actual.activo;
    despues.activo = datos.activo;
  }
  if (datos.clave !== undefined) {
    data.hashClave = await bcrypt.hash(datos.clave, config.rondasBcrypt);
    despues.claveRestablecida = true;
  }
  if (datos.desbloquear) {
    data.intentosFallidos = 0;
    data.bloqueadoHasta = null;
    antes.intentosFallidos = actual.intentosFallidos;
    antes.bloqueadoHasta = actual.bloqueadoHasta;
    despues.intentosFallidos = 0;
    despues.bloqueadoHasta = null;
  }

  const actualizado = await prisma.$transaction(async (tx) => {
    const u = await tx.usuario.update({ where: { id }, data, include: incluir });
    await auditar(tx, {
      usuarioId: ctx.usuarioId,
      accion: datos.activo === false ? "DESACTIVAR" : "EDITAR",
      entidad: ENTIDAD,
      entidadId: id,
      antes,
      despues,
      ip: ctx.ip,
    });
    return u;
  });
  return usuarioRespuesta(actualizado);
}
