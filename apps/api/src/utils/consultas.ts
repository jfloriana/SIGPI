// Utilidades compartidas por los módulos de maestros.
import type { Request } from "express";
import { config } from "../config.ts";
import { esSqlite } from "../urlBaseDatos.ts";
import { AppError } from "./errores.ts";
import type { Rol } from "./roles.ts";

/** Quién ejecuta la operación (para permisos finos y bitácora). */
export interface Contexto {
  usuarioId: number;
  rol: Rol;
  ip: string | null;
}

export function contextoDe(req: Request): Contexto {
  return { usuarioId: req.usuario!.id, rol: req.usuario!.rol, ip: req.ip ?? null };
}

const EN_SQLITE = esSqlite(config.databaseUrl);

/**
 * Filtro "contiene" sin distinguir mayúsculas, portable:
 * en SQLite `LIKE` ya ignora mayúsculas (ASCII) y no admite `mode`; en PostgreSQL se usa `mode: "insensitive"`.
 */
export function contiene(texto: string): { contains: string } {
  return (EN_SQLITE ? { contains: texto } : { contains: texto, mode: "insensitive" }) as { contains: string };
}

/** 409 uniforme para valores únicos repetidos. */
export function duplicado(campo: string, mensaje: string) {
  return new AppError(409, "DUPLICADO", mensaje, { [campo]: mensaje });
}

/** ¿Es un error de restricción única de Prisma (P2002)? Red de seguridad ante carreras tras la verificación previa. */
export function esViolacionUnica(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}
