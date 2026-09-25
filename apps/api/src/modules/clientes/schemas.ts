import { z } from "zod";
import { paginacionSchema } from "../../utils/paginacion.ts";
import {
  booleanoQuery,
  buscarQuery,
  numDocSchema,
  refinarDocumento,
  telefonoSchema,
  textoSchema,
  tipoDocSchema,
  zonaSchema,
} from "../../utils/validadores.ts";

export const listarClientesSchema = paginacionSchema.extend({
  buscar: buscarQuery,
  zona: zonaSchema.optional(),
  activo: booleanoQuery,
});

export const crearClienteSchema = z
  .object({
    tipoDoc: tipoDocSchema,
    numDoc: numDocSchema,
    razonSocial: textoSchema("la razón social", 150, 3),
    direccion: textoSchema("la dirección", 200, 5),
    telefono: telefonoSchema.optional(),
    zona: zonaSchema,
  })
  .superRefine(refinarDocumento);

export const editarClienteSchema = z
  .object({
    tipoDoc: tipoDocSchema.optional(),
    numDoc: numDocSchema.optional(),
    razonSocial: textoSchema("la razón social", 150, 3).optional(),
    direccion: textoSchema("la dirección", 200, 5).optional(),
    telefono: telefonoSchema.optional(),
    zona: zonaSchema.optional(),
    activo: z.boolean({ error: "Debe ser verdadero o falso" }).optional(),
  })
  .superRefine((d, ctx) => {
    // El documento se valida como par: si cambia uno, se envían ambos.
    if ((d.tipoDoc === undefined) !== (d.numDoc === undefined)) {
      const campo = d.tipoDoc === undefined ? "tipoDoc" : "numDoc";
      ctx.addIssue({ code: "custom", path: [campo], message: "Envíe el tipo y el número de documento juntos" });
      return;
    }
    refinarDocumento(d, ctx);
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { error: "No se envió ningún cambio" });

export type ListarClientes = z.infer<typeof listarClientesSchema>;
export type CrearCliente = z.infer<typeof crearClienteSchema>;
export type EditarCliente = z.infer<typeof editarClienteSchema>;
