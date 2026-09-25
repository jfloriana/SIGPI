import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/db.ts";
import { sembrar } from "../prisma/seed.ts";
import { app, tokenDe, tokenRapido } from "./helpers.ts";

type Rol = "ADMIN" | "GERENTE" | "VENDEDOR" | "ALMACENERO";
const EMAIL: Record<Rol, string> = {
  ADMIN: "admin@distrinorte.pe",
  GERENTE: "gerente@distrinorte.pe",
  VENDEDOR: "vendedor1@distrinorte.pe",
  ALMACENERO: "almacen@distrinorte.pe",
};

let tokens: Record<Rol, string>;

beforeEach(async () => {
  await sembrar();
  tokens = Object.fromEntries(
    await Promise.all((Object.keys(EMAIL) as Rol[]).map(async (r) => [r, await tokenRapido(EMAIL[r])])),
  ) as Record<Rol, string>;
});

const auth = (r: Rol) => ({ Authorization: `Bearer ${tokens[r]}` });
const get = (r: Rol, url: string) => request(app).get(url).set(auth(r));

/** Genera actividad variada: logins, una edición de cliente y un ajuste. */
async function actividad() {
  await tokenDe(EMAIL.GERENTE); // LOGIN_OK
  await request(app).post("/api/auth/login").send({ email: EMAIL.VENDEDOR, clave: "mala" }); // LOGIN_FALLIDO
  const cliente = await prisma.cliente.findFirstOrThrow({ orderBy: { id: "asc" } });
  await request(app).patch(`/api/clientes/${cliente.id}`).set(auth("ADMIN")).send({ telefono: "944 000 111" }); // EDITAR
  const prod = await prisma.producto.findUniqueOrThrow({ where: { codigo: "ACE-001" } });
  await request(app)
    .post("/api/inventario/ajustes")
    .set(auth("ALMACENERO"))
    .send({ productoId: prod.id, tipo: "AJUSTE_POSITIVO", cantidad: 2, motivo: "Sobrante en conteo" }); // AJUSTE
  return { cliente, prod };
}

describe("Consulta de la bitácora", () => {
  it("ADMIN y GERENTE ven la lista, más recientes primero, con usuario y detalle parseado", async () => {
    const { cliente } = await actividad();
    const res = await get("GERENTE", "/api/bitacora");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 9, page: 1, pageSize: 20 }); // 5 de la carga inicial + 4
    const ids = res.body.datos.map((b: { id: number }) => b.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));

    expect(res.body.datos[0]).toEqual({
      id: expect.any(Number),
      fecha: expect.any(String),
      usuario: { id: expect.any(Number), nombre: "Jorge Alvarado Díaz", email: EMAIL.ALMACENERO },
      accion: "AJUSTE",
      entidad: "Producto",
      entidadId: expect.any(String),
      detalle: { antes: { stock: 480 }, despues: expect.objectContaining({ stock: 482, tipo: "AJUSTE_POSITIVO" }) },
      ip: expect.any(String),
    });
    const edicion = res.body.datos[1];
    expect(edicion).toMatchObject({ accion: "EDITAR", entidad: "Cliente", entidadId: String(cliente.id) });
    expect(edicion.detalle.antes.telefono).toBe(cliente.telefono);
    expect(edicion.detalle.despues.telefono).toBe("944 000 111");

    // Los registros de la carga inicial no tienen usuario.
    const ultimo = res.body.datos.at(-1);
    expect(ultimo).toMatchObject({ accion: "CREAR", entidad: "Usuario", usuario: null, ip: null, detalle: { antes: null } });

    expect((await get("ADMIN", "/api/bitacora")).status).toBe(200);
  });

  it("filtra por usuario, entidad, entidadId, acción y fechas, y pagina", async () => {
    const { cliente } = await actividad();
    const admin = await prisma.usuario.findUniqueOrThrow({ where: { email: EMAIL.ADMIN } });

    const porUsuario = await get("ADMIN", `/api/bitacora?usuarioId=${admin.id}`);
    expect(porUsuario.body.datos.map((b: { accion: string }) => b.accion)).toEqual(["EDITAR"]);

    expect((await get("ADMIN", "/api/bitacora?entidad=Usuario")).body.total).toBe(7); // 5 CREAR + 2 login
    expect((await get("ADMIN", `/api/bitacora?entidad=Cliente&entidadId=${cliente.id}`)).body.total).toBe(1);
    expect((await get("ADMIN", "/api/bitacora?accion=LOGIN_FALLIDO")).body.datos[0].detalle.despues).toMatchObject({
      motivo: "CLAVE_INCORRECTA",
    });

    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
    expect((await get("ADMIN", `/api/bitacora?desde=${hoy}&hasta=${hoy}`)).body.total).toBe(9);
    expect((await get("ADMIN", "/api/bitacora?hasta=2020-01-01")).body.total).toBe(0);

    const p2 = await get("ADMIN", "/api/bitacora?page=2&pageSize=4");
    expect(p2.body).toMatchObject({ total: 9, page: 2, pageSize: 4 });
    expect(p2.body.datos).toHaveLength(4);
    expect((await get("ADMIN", "/api/bitacora?page=3&pageSize=4")).body.datos).toHaveLength(1);

    expect((await get("ADMIN", "/api/bitacora?accion=BORRAR")).status).toBe(400);
    expect((await get("ADMIN", "/api/bitacora?pageSize=500")).status).toBe(400);
    expect((await get("ADMIN", "/api/bitacora?desde=2026-02-01&hasta=2026-01-01")).status).toBe(400);
  });

  it("detalle de un registro y listas para los filtros", async () => {
    await actividad();
    const primero = (await get("ADMIN", "/api/bitacora?pageSize=1")).body.datos[0];
    const res = await get("GERENTE", `/api/bitacora/${primero.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(primero);
    expect((await get("GERENTE", "/api/bitacora/999999")).status).toBe(404);
    expect((await get("GERENTE", "/api/bitacora/abc")).status).toBe(400);

    const filtros = await get("GERENTE", "/api/bitacora/filtros");
    expect(filtros.body).toEqual({
      entidades: ["Cliente", "Producto", "Usuario"],
      acciones: ["AJUSTE", "CREAR", "EDITAR", "LOGIN_FALLIDO", "LOGIN_OK"],
    });
  });

  it("VENDEDOR y ALMACENERO no tienen acceso (403); sin sesión, 401", async () => {
    for (const r of ["VENDEDOR", "ALMACENERO"] as const) {
      expect((await get(r, "/api/bitacora")).status).toBe(403);
      expect((await get(r, "/api/bitacora/filtros")).status).toBe(403);
      expect((await get(r, "/api/bitacora/1")).status).toBe(403);
    }
    expect((await request(app).get("/api/bitacora")).status).toBe(401);
  });
});

describe("La bitácora es de solo lectura (regla 17)", () => {
  it("no existen POST, PUT, PATCH ni DELETE: responden 404 y nada cambia", async () => {
    await actividad();
    const registro = await prisma.bitacora.findFirstOrThrow({ orderBy: { id: "desc" } });
    const antes = await prisma.bitacora.findMany({ orderBy: { id: "asc" } });

    const intentos = [
      request(app).post("/api/bitacora").set(auth("ADMIN")).send({ accion: "CREAR", entidad: "X", detalle: "{}" }),
      request(app).put(`/api/bitacora/${registro.id}`).set(auth("ADMIN")).send({ detalle: "{}" }),
      request(app).patch(`/api/bitacora/${registro.id}`).set(auth("ADMIN")).send({ detalle: "{}" }),
      request(app).delete(`/api/bitacora/${registro.id}`).set(auth("ADMIN")),
      request(app).delete("/api/bitacora").set(auth("ADMIN")),
      request(app).delete(`/api/bitacora/${registro.id}`).set(auth("GERENTE")),
    ];
    for (const r of await Promise.all(intentos)) {
      expect([404, 405]).toContain(r.status);
      expect(r.body.error.codigo).toBe("RUTA_NO_ENCONTRADA");
    }
    expect(await prisma.bitacora.findMany({ orderBy: { id: "asc" } })).toEqual(antes);
  });

  it("ningún router de la API registra una ruta de escritura sobre la bitácora", async () => {
    // Inspección de la pila de Express: bajo /api/bitacora solo hay rutas GET.
    const { bitacoraRouter } = await import("../src/modules/bitacora/routes.ts");
    const metodos = bitacoraRouter.stack
      .filter((capa) => capa.route)
      .flatMap((capa) => Object.keys((capa.route as unknown as { methods: Record<string, boolean> }).methods));
    expect(new Set(metodos)).toEqual(new Set(["get"]));
  });
});
