import { z } from "zod";
import { paginacionSchema } from "../../utils/paginacion.ts";
import { buscarQuery, rucSchema, telefonoSchema, textoSchema } from "../../utils/validadores.ts";

export const listarProveedoresSchema = paginacionSchema.extend({ buscar: buscarQuery });

export const crearProveedorSchema = z.object({
  ruc: rucSchema,
  razonSocial: textoSchema("la razón social", 150, 3),
  telefono: telefonoSchema.optional(),
});

export const editarProveedorSchema = z
  .object({
    ruc: rucSchema.optional(),
    razonSocial: textoSchema("la razón social", 150, 3).optional(),
    telefono: telefonoSchema.optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { error: "No se envió ningún cambio" });

export type ListarProveedores = z.infer<typeof listarProveedoresSchema>;
export type CrearProveedor = z.infer<typeof crearProveedorSchema>;
export type EditarProveedor = z.infer<typeof editarProveedorSchema>;
