import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/db.ts";
import { sembrar } from "../prisma/seed.ts";
import { app, conBitacora, tokenRapido, verificarKardex } from "./helpers.ts";

type Rol = "ADMIN" | "GERENTE" | "VENDEDOR" | "ALMACENERO";
const EMAIL: Record<Rol, string> = {
  ADMIN: "admin@distrinorte.pe",
  GERENTE: "gerente@distrinorte.pe",
  VENDEDOR: "vendedor1@distrinorte.pe",
  ALMACENERO: "almacen@distrinorte.pe",
};

let tokens: Record<Rol, string>;
const id: Record<string, number> = {};

beforeEach(async () => {
  await sembrar();
  tokens = Object.fromEntries(
    await Promise.all((Object.keys(EMAIL) as Rol[]).map(async (r) => [r, await tokenRapido(EMAIL[r])])),
  ) as Record<Rol, string>;
  for (const p of await prisma.producto.findMany()) id[p.codigo] = p.id;
});

const auth = (r: Rol) => ({ Authorization: `Bearer ${tokens[r]}` });
const get = (r: Rol, url: string) => request(app).get(url).set(auth(r));
const post = (r: Rol, url: string, body: object = {}) => request(app).post(url).set(auth(r)).send(body);
const stockDe = async (codigo: string) => (await prisma.producto.findUniqueOrThrow({ where: { codigo } })).stock;
const ajuste = (r: Rol, codigo: string, tipo: string, cantidad: number, motivo = "Conteo físico de almacén") =>
  post(r, "/api/inventario/ajustes", { productoId: id[codigo], tipo, cantidad, motivo });

// ---------------------------------------------------------------------------------------------

describe("Ajustes de inventario (regla 10)", () => {
  it("registra un ajuste positivo: movimiento con stockResultante, producto actualizado y un AJUSTE en bitácora", async () => {
    const { resultado: res, registros } = await conBitacora(() =>
      post("ALMACENERO", "/api/inventario/ajustes", {
        productoId: id["ACE-001"],
        tipo: "AJUSTE_POSITIVO",
        cantidad: 10,
        motivo: "  Sobrante en conteo  ",
        referencia: "INV-2026-09",
      }),
    );
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      movimiento: {
        id: expect.any(Number),
        fecha: expect.any(String),
        tipo: "AJUSTE_POSITIVO",
        cantidad: 10,
        stockResultante: 490,
        motivo: "Sobrante en conteo",
        referencia: "INV-2026-09",
        usuario: { id: expect.any(Number), nombre: "Jorge Alvarado Díaz" },
      },
      producto: { id: id["ACE-001"], codigo: "ACE-001", nombre: expect.any(String), unidad: "UND", stock: 490, stockMinimo: 120, enAlerta: false },
    });
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({ accion: "AJUSTE", entidad: "Producto", entidadId: String(id["ACE-001"]) });
    expect(JSON.parse(registros[0].detalle)).toMatchObject({
      antes: { stock: 480 },
      despues: { stock: 490, tipo: "AJUSTE_POSITIVO", cantidad: 10, motivo: "Sobrante en conteo" },
    });
    await verificarKardex();
  });

  it("ENTRADA manual y ajuste negativo actualizan el stock", async () => {
    expect((await ajuste("ADMIN", "LIM-006", "ENTRADA", 20, "Compra de emergencia")).body.producto.stock).toBe(28);
    const neg = await ajuste("ALMACENERO", "LIM-006", "AJUSTE_NEGATIVO", 28, "Merma por humedad");
    expect(neg.status).toBe(201);
    expect(neg.body.movimiento).toMatchObject({ tipo: "AJUSTE_NEGATIVO", stockResultante: 0 });
    expect(neg.body.producto).toMatchObject({ stock: 0, enAlerta: true });
    await verificarKardex();
  });

  it("un ajuste negativo que dejaría stock < 0 → 409 y no cambia nada", async () => {
    const movs = await prisma.movInventario.count();
    const { resultado: res, registros } = await conBitacora(() => ajuste("ALMACENERO", "ARR-005", "AJUSTE_NEGATIVO", 19, "Merma por gorgojo"));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      codigo: "STOCK_INSUFICIENTE",
      mensaje: "Stock insuficiente para Frejol canario bolsa 1 kg (ARR-005): stock disponible 18, solicitado 19",
      campos: { cantidad: "Stock disponible: 18" },
      productos: [{ productoId: id["ARR-005"], codigo: "ARR-005", stockDisponible: 18, solicitado: 19 }],
    });
    expect(registros).toHaveLength(0);
    expect(await stockDe("ARR-005")).toBe(18);
    expect(await prisma.movInventario.count()).toBe(movs);
  });

  it("exige motivo (5+ caracteres), cantidad entera > 0 y un tipo manual", async () => {
    const sinMotivo = await post("ADMIN", "/api/inventario/ajustes", { productoId: id["ACE-001"], tipo: "AJUSTE_POSITIVO", cantidad: 1 });
    expect(sinMotivo.status).toBe(400);
    expect(sinMotivo.body.error.campos).toHaveProperty("motivo");
    expect((await ajuste("ADMIN", "ACE-001", "AJUSTE_POSITIVO", 1, "abc")).body.error.campos.motivo).toBe(
      "El motivo debe tener al menos 5 caracteres",
    );
    expect((await ajuste("ADMIN", "ACE-001", "AJUSTE_POSITIVO", 0)).body.error.campos).toHaveProperty("cantidad");
    expect((await ajuste("ADMIN", "ACE-001", "AJUSTE_POSITIVO", 1.5)).body.error.campos).toHaveProperty("cantidad");
    expect((await ajuste("ADMIN", "ACE-001", "SALIDA", 1)).body.error.campos).toHaveProperty("tipo");
    const inexistente = await post("ADMIN", "/api/inventario/ajustes", { productoId: 999999, tipo: "ENTRADA", cantidad: 1, motivo: "Motivo válido" });
    expect(inexistente.status).toBe(400);
    expect(inexistente.body.error.campos).toHaveProperty("productoId");
  });

  it("solo ADMIN y ALMACENERO registran ajustes", async () => {
    const { registros } = await conBitacora(async () => {
      expect((await ajuste("GERENTE", "ACE-001", "AJUSTE_POSITIVO", 1)).status).toBe(403);
      expect((await ajuste("VENDEDOR", "ACE-001", "AJUSTE_POSITIVO", 1)).status).toBe(403);
    });
    expect(registros).toHaveLength(0);
    expect(await stockDe("ACE-001")).toBe(480);
  });
});

// ---------------------------------------------------------------------------------------------

describe("Kardex", () => {
  it("muestra producto, movimientos (recientes primero) y un resumen que cuadra sobre todos los movimientos", async () => {
    await ajuste("ALMACENERO", "ACE-001", "AJUSTE_NEGATIVO", 5, "Botellas rotas");
    await ajuste("ALMACENERO", "ACE-001", "ENTRADA", 20, "Entrada por devolución");
    await ajuste("ADMIN", "ACE-001", "AJUSTE_POSITIVO", 3, "Sobrante en conteo");

    const res = await get("GERENTE", `/api/inventario/kardex/${id["ACE-001"]}`);
    expect(res.status).toBe(200);
    expect(res.body.producto).toEqual({ id: id["ACE-001"], codigo: "ACE-001", nombre: expect.any(String), unidad: "UND", stock: 498, stockMinimo: 120, enAlerta: false });
    expect(res.body.resumen).toEqual({ entradas: 500, salidas: 0, ajustesPositivos: 3, ajustesNegativos: 5, saldoCalculado: 498, cuadra: true });
    expect(res.body).toMatchObject({ total: 4, page: 1, pageSize: 20 });
    expect(res.body.datos.map((m: { tipo: string; stockResultante: number }) => [m.tipo, m.stockResultante])).toEqual([
      ["AJUSTE_POSITIVO", 498],
      ["ENTRADA", 495],
      ["AJUSTE_NEGATIVO", 475],
      ["ENTRADA", 480],
    ]);
    expect(res.body.datos[3]).toMatchObject({ motivo: "Inventario inicial", referencia: null, usuario: { nombre: "Jorge Alvarado Díaz" } });

    // El resumen no depende de la página ni de los filtros.
    const pagina = await get("ALMACENERO", `/api/inventario/kardex/${id["ACE-001"]}?page=2&pageSize=3&tipo=ENTRADA`);
    expect(pagina.body).toMatchObject({ total: 2, page: 2, pageSize: 3, datos: [] });
    expect(pagina.body.resumen.saldoCalculado).toBe(498);

    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
    expect((await get("ADMIN", `/api/inventario/kardex/${id["ACE-001"]}?desde=${hoy}`)).body.total).toBe(3);
    expect((await get("ADMIN", `/api/inventario/kardex/${id["ACE-001"]}?tipo=SALIDA`)).body.total).toBe(0);
  });

  it("detecta un descuadre (cuadra: false) si el stock no coincide con los movimientos", async () => {
    await prisma.producto.update({ where: { codigo: "ACE-002" }, data: { stock: 61 } });
    const res = await get("ADMIN", `/api/inventario/kardex/${id["ACE-002"]}`);
    expect(res.body.resumen).toMatchObject({ saldoCalculado: 60, cuadra: false });
  });

  it("permisos y errores: VENDEDOR 403, producto inexistente 404, filtros inválidos 400", async () => {
    expect((await get("VENDEDOR", `/api/inventario/kardex/${id["ACE-001"]}`)).status).toBe(403);
    expect((await get("ADMIN", "/api/inventario/kardex/999999")).status).toBe(404);
    expect((await get("ADMIN", "/api/inventario/kardex/abc")).status).toBe(400);
    expect((await get("ADMIN", `/api/inventario/kardex/${id["ACE-001"]}?tipo=ROBO`)).status).toBe(400);
    expect((await get("ADMIN", `/api/inventario/kardex/${id["ACE-001"]}?desde=2026-02-01&hasta=2026-01-01`)).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------------------------

describe("Alertas de stock (regla 18)", () => {
  it("lista los productos activos en alerta, del más crítico al menos, con cantidad sugerida", async () => {
    const res = await get("ALMACENERO", "/api/inventario/alertas");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(7);
    expect(res.body.datos.map((p: { codigo: string }) => p.codigo)).toEqual([
      "ARR-005", // 18/40
      "LIM-006", // 8/15
      "ACE-003", // 12/20
      "LAC-003", // 60/80
      "AZU-005", // 25/30
      "FID-005", // 90/100
      "BEB-007", // 30/30
    ]);
    expect(res.body.datos[0]).toEqual({
      id: id["ARR-005"],
      codigo: "ARR-005",
      nombre: "Frejol canario bolsa 1 kg",
      unidad: "UND",
      stock: 18,
      stockMinimo: 40,
      enAlerta: true,
      precio: "9.80",
      categoria: { id: expect.any(Number), nombre: "Arroz y menestras" },
      cantidadSugerida: 62, // 40 × 2 − 18
    });
    expect(res.body.datos.every((p: { stock: number; stockMinimo: number; cantidadSugerida: number }) => p.cantidadSugerida === p.stockMinimo * 2 - p.stock)).toBe(true);
  });

  it("un producto sale de la alerta al reponerlo y los inactivos no aparecen", async () => {
    await ajuste("ALMACENERO", "ARR-005", "ENTRADA", 30, "Reposición urgente");
    await prisma.producto.update({ where: { codigo: "LIM-006" }, data: { activo: false } });
    const res = await get("GERENTE", "/api/inventario/alertas");
    expect(res.body.datos.map((p: { codigo: string }) => p.codigo)).not.toContain("ARR-005");
    expect(res.body.datos.map((p: { codigo: string }) => p.codigo)).not.toContain("LIM-006");
    expect(res.body.total).toBe(5);
  });

  it("el VENDEDOR no tiene acceso", async () => {
    expect((await get("VENDEDOR", "/api/inventario/alertas")).status).toBe(403);
    expect((await get("ADMIN", "/api/inventario/alertas")).status).toBe(200);
  });
});
