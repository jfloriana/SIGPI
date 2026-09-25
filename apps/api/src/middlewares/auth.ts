import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.ts";
import { prisma } from "../db.ts";
import { noAutenticado } from "../utils/errores.ts";
import type { Rol } from "../utils/roles.ts";

export interface UsuarioSesion {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
}

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioSesion;
    }
  }
}

/**
 * Verifica el JWT y vuelve a leer el usuario de la base: así un usuario desactivado
 * o con el rol cambiado pierde el acceso de inmediato, aunque su token siga vigente.
 */
export async function autenticar(req: Request, _res: Response, next: NextFunction) {
  const cabecera = req.headers.authorization;
  if (!cabecera?.startsWith("Bearer ")) throw noAutenticado();

  let id: number;
  try {
    const payload = jwt.verify(cabecera.slice(7), config.jwtSecret, { algorithms: ["HS256"] }) as jwt.JwtPayload;
    id = Number(payload.sub);
  } catch {
    throw noAutenticado("La sesión expiró o no es válida. Inicie sesión nuevamente");
  }

  const usuario = await prisma.usuario.findUnique({ where: { id }, include: { rol: true } });
  if (!usuario || !usuario.activo) throw noAutenticado("El usuario no existe o está desactivado");

  req.usuario = { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol.nombre as Rol };
  next();
}
