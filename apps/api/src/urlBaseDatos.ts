import path from "node:path";
import { fileURLToPath } from "node:url";

// Carpeta raíz de apps/api, sin importar desde dónde se ejecute el comando.
export const RAIZ_API = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Convierte `file:./prisma/dev.db` en una ruta absoluta dentro de apps/api. Las URL de PostgreSQL pasan sin cambios. */
export function resolverUrlBaseDatos(url: string): string {
  if (!url.startsWith("file:")) return url;
  const ruta = url.slice("file:".length);
  return "file:" + (path.isAbsolute(ruta) ? ruta : path.resolve(RAIZ_API, ruta));
}

export function esSqlite(url: string): boolean {
  return url.startsWith("file:");
}
