// Revisión de seguridad (Fase 6): autenticación obligatoria, ausencia de hashClave y cabeceras.
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { MODULOS_API } from "../src/app.ts";
import { config } from "../src/config.ts";
import { prisma } from "../src/db.ts";
import { sembrarBase } from "../prisma/seed.ts";
import { app, tokenRapido } from "./helpers.ts";

beforeEach(async () => {
  await sembrarBase();
});

/** Rutas públicas permitidas (todo lo demás exige token). */
const PUBLICAS = new Set(["POST /api/auth/login", "GET /api/salud"]);

/** Recorre la pila de cada router montado y devuelve sus rutas como "MÉTODO /api/…". */
function rutasDeclaradas(): { metodo: string; ruta: string }[] {
  const rutas: { metodo: string; ruta: string }[] = [];
  for (const [prefijo, router] of MODULOS_API) {
    for (const capa of router.stack) {
      const r = capa.route as unknown as { path: string; methods: Record<string, boolean> } | undefined;
      if (!r) continue;
      for (const metodo of Object.keys(r.methods)) rutas.push({ metodo: metodo.toUpperCase(), ruta: `/api${prefijo}${r.path === "/" ? "" : r.path}` });
    }
  }
  return rutas;
}

const pedir = (metodo: string, ruta: string) => {
  const url = ruta.replace(/:[A-Za-z]+/g, "1");
  const r = request(app);
  return metodo === "GET" ? r.get(url) : metodo === "POST" ? r.post(url).send({}) : metodo === "PATCH" ? r.patch(url).send({}) : metodo === "PUT" ? r.put(url).send({}) : r.delete(url);
};

describe("Autenticación obligatoria en toda la API", () => {
  it("el recorrido encuentra las rutas de todos los módulos", () => {
    const rutas = rutasDeclaradas().map((r) => `${r.metodo} ${r.ruta}`);
    expect(rutas.length).toBeGreaterThan(40);
    for (const esperada of [
      "POST /api/auth/login",
      "GET /api/auth/me",
      "PATCH /api/usuarios/:id",
      "POST /api/pedidos/:id/despachar",
      "POST /api/inventario/ajustes",
      "POST /api/ordenes-compra/:id/recepcionar",
      "GET /api/reportes/ventas.csv",
      "GET /api/bitacora/:id",
    ]) {
      expect(rutas).toContain(esperada);
    }
  });

  it("toda ruta salvo POST /auth/login y GET /salud responde 401 sin token, con token inválido, con alg none o vencido", async () => {
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { email: "admin@distrinorte.pe" } });
    const tokens = {
      basura: "Bearer basura",
      otraClave: `Bearer ${jwt.sign({ sub: String(usuario.id), rol: "ADMIN" }, "otra-clave-que-no-es-la-del-servidor")}`,
      algNone: `Bearer ${jwt.sign({ sub: String(usuario.id), rol: "ADMIN" }, "", { algorithm: "none" })}`,
      vencido: `Bearer ${jwt.sign({ sub: String(usuario.id), rol: "ADMIN", exp: Math.floor(Date.now() / 1000) - 60 }, config.jwtSecret)}`,
    };
    const rutas = rutasDeclaradas().filter((r) => !PUBLICAS.has(`${r.metodo} ${r.ruta}`));
    for (const { metodo, ruta } of rutas) {
      const sin = await pedir(metodo, ruta);
      expect(sin.status, `${metodo} ${ruta} sin token`).toBe(401);
      expect(sin.body.error.codigo).toBe("NO_AUTENTICADO");
      for (const [nombre, t] of Object.entries(tokens)) {
        expect((await pedir(metodo, ruta).set("Authorization", t)).status, `${metodo} ${ruta} (${nombre})`).toBe(401);
      }
    }
    // Las públicas responden sin token.
    expect((await request(app).get("/api/salud")).status).toBe(200);
    expect((await request(app).post("/api/auth/login").send({ email: "admin@distrinorte.pe", clave: "Demo2026!" })).status).toBe(200);
  });
});

describe("Ninguna respuesta incluye hashClave", () => {
  it("recorre los GET principales como ADMIN (y los del resto de roles) buscando hashClave o hashes bcrypt", async () => {
    // Algo de actividad para que las respuestas no estén vacías: un pedido despachado y una OC.
    const vendedor = await tokenRapido("vendedor1@distrinorte.pe");
    const gerente = await tokenRapido("gerente@distrinorte.pe");
    const cliente = await prisma.cliente.findFirstOrThrow({ where: { activo: true } });
    const prod = await prisma.producto.findUniqueOrThrow({ where: { codigo: "ACE-001" } });
    const proveedor = await prisma.proveedor.findFirstOrThrow();
    const ped = await request(app).post("/api/pedidos").set("Authorization", `Bearer ${vendedor}`).send({ clienteId: cliente.id, condicionPago: "CONTADO", lineas: [{ productoId: prod.id, cantidad: 1 }] });
    const oc = await request(app).post("/api/ordenes-compra").set("Authorization", `Bearer ${gerente}`).send({ proveedorId: proveedor.id, lineas: [{ productoId: prod.id, cantidad: 5, costoUnit: "7.90" }] });
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { email: "vendedor1@distrinorte.pe" } });
    const bitacora = await prisma.bitacora.findFirstOrThrow();

    const urls = [
      "/api/auth/me",
      "/api/usuarios?pageSize=100",
      `/api/usuarios/${usuario.id}`,
      "/api/clientes?pageSize=100",
      `/api/clientes/${cliente.id}`,
      "/api/categorias",
      "/api/productos?pageSize=100",
      `/api/productos/${prod.id}`,
      "/api/proveedores",
      "/api/pedidos",
      `/api/pedidos/${ped.body.id}`,
      `/api/inventario/kardex/${prod.id}`,
      "/api/inventario/alertas",
      "/api/ordenes-compra",
      `/api/ordenes-compra/${oc.body.id}`,
      "/api/reportes/tablero",
      "/api/reportes/ventas.csv",
      "/api/bitacora?pageSize=100",
      `/api/bitacora/${bitacora.id}`,
      "/api/bitacora/filtros",
    ];
    for (const email of ["admin@distrinorte.pe", "gerente@distrinorte.pe", "vendedor1@distrinorte.pe", "almacen@distrinorte.pe"]) {
      const token = await tokenRapido(email);
      for (const url of urls) {
        const res = await request(app).get(url).set("Authorization", `Bearer ${token}`);
        if (email === "admin@distrinorte.pe" && !url.startsWith("/api/pedidos/") && url !== "/api/reportes/ventas.csv") {
          expect(res.status, url).toBe(200);
        }
        const texto = res.text ?? JSON.stringify(res.body);
        expect(texto, `${email} ${url}`).not.toMatch(/hashClave|\$2[aby]\$\d\d\$/);
      }
    }
    // El login tampoco.
    const login = await request(app).post("/api/auth/login").send({ email: "admin@distrinorte.pe", clave: "Demo2026!" });
    expect(login.text).not.toMatch(/hashClave|\$2[aby]\$/);
  });
});

describe("Cabeceras, CORS y límite de tasa", () => {
  it("helmet: cabeceras de seguridad y sin X-Powered-By", async () => {
    const res = await request(app).get("/api/salud");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["content-security-policy"]).toBeDefined();
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("CORS solo para el origen configurado, también en preflight", async () => {
    const ok = await request(app).options("/api/auth/login").set("Origin", "http://localhost:5173").set("Access-Control-Request-Method", "POST");
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    const ajeno = await request(app).options("/api/auth/login").set("Origin", "http://evil.example").set("Access-Control-Request-Method", "POST");
    expect(ajeno.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("el login tiene límite de tasa (cabeceras RateLimit) y el cuerpo JSON está limitado", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "nadie@distrinorte.pe", clave: "x" });
    expect(res.headers["ratelimit-policy"]).toMatch(/q=\d+/);
    expect(res.headers["ratelimit"]).toBeDefined();
    const grande = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ email: "a@b.pe", clave: "x".repeat(300_000) }));
    expect(grande.status).toBe(413);
  });
});
