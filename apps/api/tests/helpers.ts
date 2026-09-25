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

/** Último id de la bitácora (para contar los registros que deja una operación). */
export async function ultimoIdBitacora(): Promise<number> {
  return (await prisma.bitacora.aggregate({ _max: { id: true } }))._max.id ?? 0;
}

/** Ejecuta la operación y devuelve su resultado junto con los registros de bitácora que creó. */
export async function conBitacora<T>(operacion: () => Promise<T>) {
  const desde = await ultimoIdBitacora();
  const resultado = await operacion();
  const registros = await prisma.bitacora.findMany({ where: { id: { gt: desde } }, orderBy: { id: "asc" } });
  return { resultado, registros };
}

/** Verifica que el stock de cada producto = suma de sus movimientos y nunca es negativo. */
export async function verificarKardex() {
  const productos = await prisma.producto.findMany({ include: { movimientos: true } });
  const descuadres = productos
    .map((p) => ({
      codigo: p.codigo,
      stock: p.stock,
      suma: p.movimientos.reduce(
        (a, m) => a + (m.tipo === "ENTRADA" || m.tipo === "AJUSTE_POSITIVO" ? m.cantidad : -m.cantidad),
        0,
      ),
    }))
    .filter((p) => p.suma !== p.stock || p.stock < 0);
  if (descuadres.length) throw new Error(`Kardex descuadrado: ${JSON.stringify(descuadres)}`);
}
