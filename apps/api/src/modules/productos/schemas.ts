import { z } from "zod";
import { paginacionSchema } from "../../utils/paginacion.ts";
import {
  booleanoQuery,
  buscarQuery,
  dineroSchema,
  enteroNoNegativoSchema,
  textoSchema,
  unidadSchema,
} from "../../utils/validadores.ts";

export const listarProductosSchema = paginacionSchema.extend({
  buscar: buscarQuery,
  categoriaId: z.coerce.number({ error: "Categoría no válida" }).int().positive({ error: "Categoría no válida" }).optional(),
  alerta: booleanoQuery,
  activo: booleanoQuery,
});

const codigoSchema = z
  .string({ error: "Ingrese el código" })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{2,19}$/, { error: "Código no válido: de 3 a 20 letras, números o guiones (p. ej., ARR-001)" });

const categoriaIdSchema = z
  .number({ error: "Seleccione una categoría" })
  .int({ error: "Seleccione una categoría" })
  .positive({ error: "Seleccione una categoría" });

export const crearProductoSchema = z.object({
  codigo: codigoSchema,
  nombre: textoSchema("el nombre", 120, 3),
  unidad: unidadSchema,
  precio: dineroSchema,
  stockMinimo: enteroNoNegativoSchema,
  categoriaId: categoriaIdSchema,
});

export const editarProductoSchema = z
  .object({
    codigo: codigoSchema.optional(),
    nombre: textoSchema("el nombre", 120, 3).optional(),
    unidad: unidadSchema.optional(),
    precio: dineroSchema.optional(),
    stockMinimo: enteroNoNegativoSchema.optional(),
    categoriaId: categoriaIdSchema.optional(),
    activo: z.boolean({ error: "Debe ser verdadero o falso" }).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { error: "No se envió ningún cambio" });

export type ListarProductos = z.infer<typeof listarProductosSchema>;
export type CrearProducto = z.infer<typeof crearProductoSchema>;
export type EditarProducto = z.infer<typeof editarProductoSchema>;
