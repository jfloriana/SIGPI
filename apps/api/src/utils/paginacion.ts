// Paginación uniforme: `?page=&pageSize=` (por defecto 20, máximo 100).
import { z } from "zod";

export const PAGE_SIZE_POR_DEFECTO = 20;
export const PAGE_SIZE_MAXIMO = 100;

export const paginacionSchema = z.object({
  page: z.coerce
    .number({ error: "Página no válida" })
    .int({ error: "Página no válida" })
    .min(1, { error: "La página debe ser 1 o mayor" })
    .default(1),
  pageSize: z.coerce
    .number({ error: "Tamaño de página no válido" })
    .int({ error: "Tamaño de página no válido" })
    .min(1, { error: "El tamaño de página debe ser 1 o mayor" })
    .max(PAGE_SIZE_MAXIMO, { error: `El tamaño de página no puede superar ${PAGE_SIZE_MAXIMO}` })
    .default(PAGE_SIZE_POR_DEFECTO),
});

export type Paginacion = z.infer<typeof paginacionSchema>;

export interface Paginado<T> {
  datos: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** `skip`/`take` para Prisma. */
export function rango({ page, pageSize }: Paginacion) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function paginado<T>(datos: T[], total: number, { page, pageSize }: Paginacion): Paginado<T> {
  return { datos, total, page, pageSize };
}
