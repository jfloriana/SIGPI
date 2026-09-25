import { z } from "zod";

export const loginSchema = z.object({
  email: z.string({ error: "Ingrese su correo" }).trim().toLowerCase().pipe(z.email({ error: "Correo no válido" })),
  clave: z.string({ error: "Ingrese su contraseña" }).min(1, { error: "Ingrese su contraseña" }),
});

export type LoginEntrada = z.infer<typeof loginSchema>;
