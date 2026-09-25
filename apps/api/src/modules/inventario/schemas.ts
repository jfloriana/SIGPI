import { z } from "zod";
import { fechaQuerySchema, refinarRangoFechas } from "../../utils/fechas.ts";
import { paginacionSchema } from "../../utils/paginacion.ts";
import { enteroPositivoSchema } from "../../utils/validadores.ts";

export const TIPOS_MOVIMIENTO = ["ENTRADA", "SALIDA", "AJUSTE_POSITIVO", "AJUSTE_NEGATIVO"] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

/** Tipos que se registran a mano (las SALIDA solo salen de despachos). */
export const TIPOS_AJUSTE = ["ENTRADA", "AJUSTE_POSITIVO", "AJUSTE_NEGATIVO"] as const;

export const kardexSchema = paginacionSchema
  .extend({
    desde: fechaQuerySchema,
    hasta: fechaQuerySchema,
    tipo: z.enum(TIPOS_MOVIMIENTO, { error: `El tipo debe ser uno de: ${TIPOS_MOVIMIENTO.join(", ")}` }).optional(),
  })
  .superRefine(refinarRangoFechas);

export const productoIdParamSchema = z.object({
  productoId: z.coerce.number({ error: "Producto no válido" }).int({ error: "Producto no válido" }).positive({ error: "Producto no válido" }),
});

/** Regla 10: los ajustes exigen motivo. */
export const ajusteSchema = z.object({
  productoId: z.number({ error: "Seleccione un producto" }).int({ error: "Seleccione un producto" }).positive({ error: "Seleccione un producto" }),
  tipo: z.enum(TIPOS_AJUSTE, { error: "El tipo debe ser ENTRADA, AJUSTE_POSITIVO o AJUSTE_NEGATIVO" }),
  cantidad: enteroPositivoSchema,
  motivo: z
    .string({ error: "Indique el motivo" })
    .trim()
    .min(5, { error: "El motivo debe tener al menos 5 caracteres" })
    .max(200, { error: "Máximo 200 caracteres" }),
  referencia: z
    .string({ error: "Referencia no válida" })
    .trim()
    .max(60, { error: "Máximo 60 caracteres" })
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});

export type Kardex = z.infer<typeof kardexSchema>;
export type Ajuste = z.infer<typeof ajusteSchema>;
