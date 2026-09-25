import request from "supertest";
import { crearApp } from "../src/app.ts";
import { CLAVE_DEMO } from "../prisma/seed.ts";

export const app = crearApp();

export async function tokenDe(email: string, clave = CLAVE_DEMO): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, clave });
  if (res.status !== 200) throw new Error(`No se pudo iniciar sesión como ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}
