import { z } from "zod";
import { paginacionSchema } from "../../utils/paginacion.ts";
import { ROLES } from "../../utils/roles.ts";
import { booleanoQuery, buscarQuery, claveSchema, textoSchema } from "../../utils/validadores.ts";

const LISTA_ROLES = Object.values(ROLES) as [string, ...string[]];
export const rolSchema = z.enum(ROLES, { error: `El rol debe ser uno de: ${LISTA_ROLES.join(", ")}` });

export const listarUsuariosSchema = paginacionSchema.extend({
  buscar: buscarQuery,
  rolId: z.coerce.number({ error: "Rol no válido" }).int().positive({ error: "Rol no válido" }).optional(),
  rol: rolSchema.optional(),
  activo: booleanoQuery,
});

const emailSchema = z
  .string({ error: "Ingrese el correo" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Correo no válido" }).max(120, { error: "Máximo 120 caracteres" }));

export const crearUsuarioSchema = z.object({
  nombre: textoSchema("el nombre", 100, 3),
  email: emailSchema,
  clave: claveSchema,
  rol: rolSchema,
});

export const editarUsuarioSchema = z
  .object({
    nombre: textoSchema("el nombre", 100, 3).optional(),
    rol: rolSchema.optional(),
    activo: z.boolean({ error: "Debe ser verdadero o falso" }).optional(),
    clave: claveSchema.optional(),
    desbloquear: z.literal(true, { error: "Envíe desbloquear: true" }).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { error: "No se envió ningún cambio" });

export type ListarUsuarios = z.infer<typeof listarUsuariosSchema>;
export type CrearUsuario = z.infer<typeof crearUsuarioSchema>;
export type EditarUsuario = z.infer<typeof editarUsuarioSchema>;
