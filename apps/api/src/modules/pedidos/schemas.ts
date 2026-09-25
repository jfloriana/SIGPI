import { z } from "zod";
import { paginacionSchema } from "../../utils/paginacion.ts";
import { buscarQuery, enteroPositivoSchema } from "../../utils/validadores.ts";

export const ESTADOS_PEDIDO = ["REGISTRADO", "APROBADO", "DESPACHADO", "ENTREGADO", "ANULADO"] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export const CONDICIONES_PAGO = ["CONTADO", "CREDITO"] as const;

const idSchema = (mensaje: string) =>
  z.number({ error: mensaje }).int({ error: mensaje }).positive({ error: mensaje });

const lineaSchema = z.object({
  productoId: idSchema("Seleccione un producto"),
  cantidad: enteroPositivoSchema,
});

/** Regla 3: al menos una línea y sin productos repetidos. `total`/`precioUnit` enviados se descartan. */
export const crearPedidoSchema = z.object({
  clienteId: idSchema("Seleccione un cliente"),
  condicionPago: z.enum(CONDICIONES_PAGO, { error: "La condición de pago debe ser CONTADO o CREDITO" }),
  lineas: z
    .array(lineaSchema, { error: "Agregue al menos un producto" })
    .min(1, { error: "El pedido debe tener al menos una línea" })
    .max(50, { error: "Máximo 50 líneas por pedido" })
    .superRefine((lineas, ctx) => {
      const vistos = new Set<number>();
      for (const l of lineas) {
        if (vistos.has(l.productoId)) {
          ctx.addIssue({ code: "custom", message: "No repita el mismo producto en dos líneas" });
          return;
        }
        vistos.add(l.productoId);
      }
    }),
});

const fechaQuery = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Use el formato AAAA-MM-DD" })
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), { error: "Fecha no válida" })
  .optional();

export const listarPedidosSchema = paginacionSchema
  .extend({
    estado: z.enum(ESTADOS_PEDIDO, { error: `El estado debe ser uno de: ${ESTADOS_PEDIDO.join(", ")}` }).optional(),
    desde: fechaQuery,
    hasta: fechaQuery,
    vendedorId: z.coerce.number({ error: "Vendedor no válido" }).int().positive({ error: "Vendedor no válido" }).optional(),
    clienteId: z.coerce.number({ error: "Cliente no válido" }).int().positive({ error: "Cliente no válido" }).optional(),
    buscar: buscarQuery,
    orden: z.enum(["recientes", "antiguedad"], { error: 'Use "recientes" o "antiguedad"' }).default("recientes"),
  })
  .refine((q) => !q.desde || !q.hasta || q.desde <= q.hasta, {
    path: ["hasta"],
    error: "La fecha final no puede ser anterior a la inicial",
  });

export const anularSchema = z.object({
  motivo: z
    .string({ error: "Indique el motivo de la anulación" })
    .trim()
    .min(10, { error: "El motivo debe tener al menos 10 caracteres" })
    .max(300, { error: "Máximo 300 caracteres" }),
});

export type CrearPedido = z.infer<typeof crearPedidoSchema>;
export type ListarPedidos = z.infer<typeof listarPedidosSchema>;
