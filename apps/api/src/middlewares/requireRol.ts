import type { NextFunction, Request, Response } from "express";
import { accesoDenegado, noAutenticado } from "../utils/errores.ts";
import type { Rol } from "../utils/roles.ts";

/** Autorización por rol. Se aplica en el servidor en cada ruta; el frontend solo oculta opciones. */
export function requireRol(...roles: Rol[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.usuario) throw noAutenticado();
    if (!roles.includes(req.usuario.rol)) throw accesoDenegado();
    next();
  };
}
