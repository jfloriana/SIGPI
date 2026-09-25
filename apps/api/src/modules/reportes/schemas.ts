import { z } from "zod";
import { fechaQuerySchema, refinarRangoFechas } from "../../utils/fechas.ts";

export const periodoSchema = z
  .object({ desde: fechaQuerySchema, hasta: fechaQuerySchema })
  .superRefine(refinarRangoFechas);

export type PeriodoQuery = z.infer<typeof periodoSchema>;
