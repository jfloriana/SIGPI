// Fechas de filtro `AAAA-MM-DD` interpretadas en America/Lima (UTC-5 fijo: Perú no usa horario de verano).
import { z } from "zod";

/** Fecha opcional en query string con formato AAAA-MM-DD. */
export const fechaQuerySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Use el formato AAAA-MM-DD" })
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), { error: "Fecha no válida" })
  .optional();

/** superRefine para esquemas con `desde`/`hasta`: el error queda en `hasta`. */
export function refinarRangoFechas(q: { desde?: string; hasta?: string }, ctx: z.RefinementCtx) {
  if (q.desde && q.hasta && q.desde > q.hasta) {
    ctx.addIssue({ code: "custom", path: ["hasta"], message: "La fecha final no puede ser anterior a la inicial" });
  }
}

/** Inicio del día `AAAA-MM-DD` en hora de Lima. */
export const inicioDiaLima = (fecha: string) => new Date(`${fecha}T00:00:00-05:00`);

/** Filtro Prisma de fechas: `desde` inclusive y `hasta` inclusive (todo ese día en Lima). */
export function filtroFechas(desde?: string, hasta?: string): { gte?: Date; lt?: Date } | undefined {
  if (!desde && !hasta) return undefined;
  return {
    ...(desde && { gte: inicioDiaLima(desde) }),
    ...(hasta && { lt: new Date(inicioDiaLima(hasta).getTime() + 86_400_000) }),
  };
}
