import jwt from "jsonwebtoken";
import request from "supertest";
import { crearApp } from "../src/app.ts";
import { config } from "../src/config.ts";
import { prisma } from "../src/db.ts";
import { CLAVE_DEMO } from "../prisma/seed.ts";

export const app = crearApp();

/**
 * Token firmado directamente (sin pasar por /auth/login): más rápido y no agrega LOGIN_OK a la bitácora.
 * El middleware igual relee el usuario y su rol vigente de la base.
 */
export async function tokenRapido(email: string): Promise<string> {
  const u = await prisma.usuario.findUniqueOrThrow({ where: { email }, include: { rol: true } });
  return jwt.sign({ sub: String(u.id), rol: u.rol.nombre }, config.jwtSecret, { expiresIn: "1h" });
}

export async function tokenDe(email: string, clave = CLAVE_DEMO): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, clave });
  if (res.status !== 200) throw new Error(`No se pudo iniciar sesión como ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}
