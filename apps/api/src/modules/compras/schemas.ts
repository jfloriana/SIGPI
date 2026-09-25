import { z } from "zod";
import { fechaQuerySchema, refinarRangoFechas } from "../../utils/fechas.ts";
import { paginacionSchema } from "../../utils/paginacion.ts";
import { dineroSchema, enteroPositivoSchema } from "../../utils/validadores.ts";

export const ESTADOS_OC = ["PENDIENTE", "APROBADA", "RECIBIDA", "ANULADA"] as const;
export type EstadoOC = (typeof ESTADOS_OC)[number];

const idSchema = (mensaje: string) =>
  z.number({ error: mensaje }).int({ error: mensaje }).positive({ error: mensaje });

export const listarOrdenesSchema = paginacionSchema
  .extend({
    estado: z.enum(ESTADOS_OC, { error: `El estado debe ser uno de: ${ESTADOS_OC.join(", ")}` }).optional(),
    proveedorId: z.coerce.number({ error: "Proveedor no válido" }).int().positive({ error: "Proveedor no válido" }).optional(),
    desde: fechaQuerySchema,
    hasta: fechaQuerySchema,
  })
  .superRefine(refinarRangoFechas);

export const crearOrdenSchema = z.object({
  proveedorId: idSchema("Seleccione un proveedor"),
  lineas: z
    .array(
      z.object({
        productoId: idSchema("Seleccione un producto"),
        cantidad: enteroPositivoSchema,
        costoUnit: dineroSchema,
      }),
      { error: "Agregue al menos un producto" },
    )
    .min(1, { error: "La orden debe tener al menos una línea" })
    .max(60, { error: "Máximo 60 líneas por orden" })
    .superRefine((lineas, ctx) => {
      const ids = lineas.map((l) => l.productoId);
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({ code: "custom", message: "No repita el mismo producto en dos líneas" });
      }
    }),
});

export const sugeridaSchema = z
  .object({
    proveedorId: idSchema("Proveedor no válido").optional(),
    productoIds: z
      .array(idSchema("Producto no válido"), { error: "Envíe una lista de productos" })
      .min(1, { error: "Envíe al menos un producto" })
      .max(100, { error: "Máximo 100 productos" })
      .optional(),
  })
  .default({});

export const anularOrdenSchema = z.object({
  motivo: z
    .string({ error: "Indique el motivo de la anulación" })
    .trim()
    .min(10, { error: "El motivo debe tener al menos 10 caracteres" })
    .max(300, { error: "Máximo 300 caracteres" }),
});

export type ListarOrdenes = z.infer<typeof listarOrdenesSchema>;
export type CrearOrden = z.infer<typeof crearOrdenSchema>;
export type Sugerida = z.infer<typeof sugeridaSchema>;
