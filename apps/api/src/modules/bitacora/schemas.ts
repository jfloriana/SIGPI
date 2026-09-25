import { z } from "zod";
import { fechaQuerySchema, refinarRangoFechas } from "../../utils/fechas.ts";
import { paginacionSchema } from "../../utils/paginacion.ts";

export const ACCIONES_BITACORA = [
  "LOGIN_OK",
  "LOGIN_FALLIDO",
  "CREAR",
  "EDITAR",
  "DESACTIVAR",
  "CAMBIO_ESTADO",
  "ANULAR",
  "AJUSTE",
  "RECEPCION",
] as const;

export const listarBitacoraSchema = paginacionSchema
  .extend({
    usuarioId: z.coerce.number({ error: "Usuario no válido" }).int().positive({ error: "Usuario no válido" }).optional(),
    entidad: z.string().trim().max(40, { error: "Máximo 40 caracteres" }).optional().transform((v) => v || undefined),
    entidadId: z.string().trim().max(40, { error: "Máximo 40 caracteres" }).optional().transform((v) => v || undefined),
    accion: z.enum(ACCIONES_BITACORA, { error: `La acción debe ser una de: ${ACCIONES_BITACORA.join(", ")}` }).optional(),
    desde: fechaQuerySchema,
    hasta: fechaQuerySchema,
  })
  .superRefine(refinarRangoFechas);

export type ListarBitacora = z.infer<typeof listarBitacoraSchema>;
