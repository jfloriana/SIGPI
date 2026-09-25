import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/db.ts";
import { autenticar } from "../src/middlewares/auth.ts";
import { errorHandler } from "../src/middlewares/errorHandler.ts";
import { requireRol } from "../src/middlewares/requireRol.ts";
import { sembrar } from "../prisma/seed.ts";
import { app, tokenDe } from "./helpers.ts";

const login = (email: string, clave: string) => request(app).post("/api/auth/login").send({ email, clave });

beforeEach(async () => {
  await sembrar();
});

describe("Inicio de sesión", () => {
  it("devuelve un token y el usuario sin hashClave", async () => {
    const res = await login("gerente@distrinorte.pe", "Demo2026!");
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.usuario).toMatchObject({ email: "gerente@distrinorte.pe", rol: "GERENTE" });
    expect(JSON.stringify(res.body)).not.toContain("hashClave");
  });

  it("acepta el correo con mayúsculas y espacios", async () => {
    const res = await login("  Gerente@DistriNorte.pe ", "Demo2026!");
    expect(res.status).toBe(200);
  });

  it("rechaza credenciales incorrectas con un mensaje genérico", async () => {
    const res = await login("gerente@distrinorte.pe", "otra");
    expect(res.status).toBe(401);
    expect(res.body.error.codigo).toBe("CREDENCIALES_INCORRECTAS");

    const inexistente = await login("nadie@distrinorte.pe", "Demo2026!");
    expect(inexistente.status).toBe(401);
    expect(inexistente.body.error.mensaje).toBe(res.body.error.mensaje);
  });

  it("valida la entrada con Zod y responde errores por campo", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "no-es-correo" });
    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe("VALIDACION");
    expect(res.body.error.campos).toHaveProperty("email");
    expect(res.body.error.campos).toHaveProperty("clave");
  });
});

describe("Bloqueo por intentos fallidos (regla 12)", () => {
  it("bloquea la cuenta 15 minutos tras 5 intentos fallidos, aun con la clave correcta", async () => {
    for (let i = 1; i <= 4; i++) {
      expect((await login("vendedor1@distrinorte.pe", "mala")).status).toBe(401);
    }
    const quinto = await login("vendedor1@distrinorte.pe", "mala");
    expect(quinto.status).toBe(423);
    expect(quinto.body.error.codigo).toBe("CUENTA_BLOQUEADA");
    expect(quinto.body.error.mensaje).toMatch(/bloqueada.*hasta las \d{2}:\d{2}/);

    const hasta = new Date(quinto.body.error.bloqueadoHasta).getTime();
    expect(hasta - Date.now()).toBeGreaterThan(14 * 60_000);
    expect(hasta - Date.now()).toBeLessThanOrEqual(15 * 60_000);

    const conClaveCorrecta = await login("vendedor1@distrinorte.pe", "Demo2026!");
    expect(conClaveCorrecta.status).toBe(423);
  });

  it("reinicia el contador al entrar correctamente", async () => {
    for (let i = 0; i < 4; i++) await login("vendedor2@distrinorte.pe", "mala");
    expect((await login("vendedor2@distrinorte.pe", "Demo2026!")).status).toBe(200);

    const u = await prisma.usuario.findUniqueOrThrow({ where: { email: "vendedor2@distrinorte.pe" } });
    expect(u.intentosFallidos).toBe(0);
    // Tras reiniciar, 4 fallos más no bloquean.
    for (let i = 0; i < 4; i++) expect((await login("vendedor2@distrinorte.pe", "mala")).status).toBe(401);
  });

  it("permite entrar cuando el bloqueo ya venció", async () => {
    await prisma.usuario.update({
      where: { email: "almacen@distrinorte.pe" },
      data: { bloqueadoHasta: new Date(Date.now() - 1000) },
    });
    expect((await login("almacen@distrinorte.pe", "Demo2026!")).status).toBe(200);
  });

  it("un usuario desactivado no puede entrar", async () => {
    await prisma.usuario.update({ where: { email: "vendedor2@distrinorte.pe" }, data: { activo: false } });
    expect((await login("vendedor2@distrinorte.pe", "Demo2026!")).status).toBe(401);
  });
});

describe("Bitácora de inicio de sesión (regla 16)", () => {
  it("registra exactamente un LOGIN_OK por entrada exitosa y un LOGIN_FALLIDO por fallo", async () => {
    const antes = (await prisma.bitacora.aggregate({ _max: { id: true } }))._max.id ?? 0;
    await login("admin@distrinorte.pe", "Demo2026!");
    await login("admin@distrinorte.pe", "mala");
    await login("nadie@distrinorte.pe", "mala");

    const nuevos = await prisma.bitacora.findMany({ where: { id: { gt: antes } }, orderBy: { id: "asc" } });
    expect(nuevos.map((b) => b.accion)).toEqual(["LOGIN_OK", "LOGIN_FALLIDO", "LOGIN_FALLIDO"]);
    expect(nuevos[2].usuarioId).toBeNull();

    const detalle = JSON.parse(nuevos[1].detalle);
    expect(detalle).toHaveProperty("antes");
    expect(detalle).toHaveProperty("despues");
    expect(nuevos.every((b) => !b.detalle.includes("hashClave") && !b.detalle.includes("Demo2026!"))).toBe(true);
  });
});

describe("Sesión y control de acceso", () => {
  it("GET /auth/me exige token válido", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set("Authorization", "Bearer basura")).status).toBe(401);

    const token = await tokenDe("almacen@distrinorte.pe");
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ rol: "ALMACENERO" });
    expect(res.body.usuario).not.toHaveProperty("hashClave");
  });

  it("un token deja de servir si el usuario es desactivado", async () => {
    const token = await tokenDe("vendedor1@distrinorte.pe");
    await prisma.usuario.update({ where: { email: "vendedor1@distrinorte.pe" }, data: { activo: false } });
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`)).status).toBe(401);
  });

  it("requireRol responde 403 al rol no autorizado y usa el rol vigente en la base", async () => {
    const prueba = express();
    prueba.get("/solo-gerente", autenticar, requireRol("GERENTE", "ADMIN"), (_req, res) => {
      res.json({ ok: true });
    });
    prueba.use(errorHandler);

    const tokenVendedor = await tokenDe("vendedor1@distrinorte.pe");
    const tokenGerente = await tokenDe("gerente@distrinorte.pe");
    const pedir = (t: string) => request(prueba).get("/solo-gerente").set("Authorization", `Bearer ${t}`);

    expect((await pedir(tokenGerente)).status).toBe(200);
    const denegado = await pedir(tokenVendedor);
    expect(denegado.status).toBe(403);
    expect(denegado.body.error.codigo).toBe("ACCESO_DENEGADO");

    // Si el administrador le cambia el rol, el mismo token pierde el permiso de inmediato.
    const rolVendedor = await prisma.rol.findUniqueOrThrow({ where: { nombre: "VENDEDOR" } });
    await prisma.usuario.update({ where: { email: "gerente@distrinorte.pe" }, data: { rolId: rolVendedor.id } });
    expect((await pedir(tokenGerente)).status).toBe(403);
  });

  it("aplica cabeceras de seguridad y CORS limitado", async () => {
    const res = await request(app).get("/api/salud").set("Origin", "http://localhost:5173");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");

    const ajeno = await request(app).get("/api/salud").set("Origin", "http://sitio-malicioso.com");
    expect(ajeno.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("responde errores con el formato uniforme", async () => {
    const res = await request(app).get("/api/no-existe");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { codigo: "RUTA_NO_ENCONTRADA", mensaje: expect.any(String) } });
  });
});
