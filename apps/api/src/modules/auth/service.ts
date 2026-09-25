import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../../config.ts";
import { prisma } from "../../db.ts";
import { auditar } from "../../services/auditoria.ts";
import { AppError } from "../../utils/errores.ts";
import type { LoginEntrada } from "./schemas.ts";

/** Contenido de bitácora de un inicio de sesión exitoso (compartido con la carga de datos históricos). */
export const bitacoraLoginOk = (intentosPrevios: number) => ({
  accion: "LOGIN_OK" as const,
  antes: { intentosFallidos: intentosPrevios },
  despues: { intentosFallidos: 0 },
});

// Hash de relleno: se compara aunque el usuario no exista para no revelar por tiempo de respuesta
// qué correos están registrados (enumeración de usuarios).
const HASH_RELLENO = bcrypt.hashSync("clave-de-relleno-sin-uso", config.rondasBcrypt);

const credencialesIncorrectas = () => new AppError(401, "CREDENCIALES_INCORRECTAS", "Correo o contraseña incorrectos");

/** Datos públicos del usuario: nunca incluye hashClave. */
export function usuarioPublico(u: {
  id: number;
  nombre: string;
  email: string;
  activo: boolean;
  creadoEn: Date;
  rol: { nombre: string };
}) {
  return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol.nombre, activo: u.activo, creadoEn: u.creadoEn };
}

function cuentaBloqueada(hasta: Date) {
  const hora = hasta.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Lima",
  });
  return new AppError(423, "CUENTA_BLOQUEADA", `Cuenta bloqueada por intentos fallidos hasta las ${hora}`, undefined, {
    bloqueadoHasta: hasta.toISOString(),
  });
}

export async function login({ email, clave }: LoginEntrada, ip: string | null) {
  const usuario = await prisma.usuario.findUnique({ where: { email }, include: { rol: true } });

  if (!usuario || !usuario.activo) {
    await bcrypt.compare(clave, HASH_RELLENO);
    await auditar(prisma, {
      usuarioId: usuario?.id ?? null,
      accion: "LOGIN_FALLIDO",
      entidad: "Usuario",
      entidadId: usuario?.id,
      despues: { email, motivo: usuario ? "USUARIO_INACTIVO" : "USUARIO_INEXISTENTE" },
      ip,
    });
    throw credencialesIncorrectas();
  }

  const ahora = new Date();
  if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > ahora) {
    await auditar(prisma, {
      usuarioId: usuario.id,
      accion: "LOGIN_FALLIDO",
      entidad: "Usuario",
      entidadId: usuario.id,
      despues: { email, motivo: "CUENTA_BLOQUEADA", bloqueadoHasta: usuario.bloqueadoHasta },
      ip,
    });
    throw cuentaBloqueada(usuario.bloqueadoHasta);
  }

  const claveCorrecta = await bcrypt.compare(clave, usuario.hashClave);

  if (!claveCorrecta) {
    const intentos = usuario.intentosFallidos + 1;
    const bloquear = intentos >= config.maxIntentosFallidos;
    const bloqueadoHasta = bloquear ? new Date(ahora.getTime() + config.minutosBloqueo * 60_000) : null;

    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: usuario.id },
        data: bloquear ? { intentosFallidos: 0, bloqueadoHasta } : { intentosFallidos: intentos },
      });
      await auditar(tx, {
        usuarioId: usuario.id,
        accion: "LOGIN_FALLIDO",
        entidad: "Usuario",
        entidadId: usuario.id,
        antes: { intentosFallidos: usuario.intentosFallidos },
        despues: { motivo: "CLAVE_INCORRECTA", intentosFallidos: intentos, ...(bloqueadoHasta && { bloqueadoHasta }) },
        ip,
      });
    });

    if (bloqueadoHasta) throw cuentaBloqueada(bloqueadoHasta);
    throw credencialesIncorrectas();
  }

  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id: usuario.id }, data: { intentosFallidos: 0, bloqueadoHasta: null } });
    await auditar(tx, {
      usuarioId: usuario.id,
      entidad: "Usuario",
      entidadId: usuario.id,
      ...bitacoraLoginOk(usuario.intentosFallidos),
      ip,
    });
  });

  const token = jwt.sign({ sub: String(usuario.id), rol: usuario.rol.nombre }, config.jwtSecret, {
    expiresIn: config.jwtExpiracion,
  });
  return { token, usuario: usuarioPublico(usuario) };
}

export async function obtenerPerfil(id: number) {
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id }, include: { rol: true } });
  return usuarioPublico(usuario);
}
