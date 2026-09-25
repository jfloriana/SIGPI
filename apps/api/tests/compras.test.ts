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
let proveedorId: number;
const id: Record<string, number> = {};

beforeEach(async () => {
  await sembrar();
  tokens = Object.fromEntries(
    await Promise.all((Object.keys(EMAIL) as Rol[]).map(async (r) => [r, await tokenRapido(EMAIL[r])])),
  ) as Record<Rol, string>;
  proveedorId = (await prisma.proveedor.findFirstOrThrow({ orderBy: { id: "asc" } })).id;
  for (const p of await prisma.producto.findMany()) id[p.codigo] = p.id;
});

const auth = (r: Rol) => ({ Authorization: `Bearer ${tokens[r]}` });
const get = (r: Rol, url: string) => request(app).get(url).set(auth(r));
const post = (r: Rol, url: string, body?: object) => {
  const req = request(app).post(url).set(auth(r));
  return body === undefined ? req : req.send(body);
};
const stockDe = async (codigo: string) => (await prisma.producto.findUniqueOrThrow({ where: { codigo } })).stock;

async function crearOrden(lineas: { codigo: string; cantidad: number; costoUnit: string | number }[], quien: Rol = "GERENTE") {
  const res = await post(quien, "/api/ordenes-compra", {
    proveedorId,
    lineas: lineas.map((l) => ({ productoId: id[l.codigo], cantidad: l.cantidad, costoUnit: l.costoUnit })),
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body;
}

// ---------------------------------------------------------------------------------------------

describe("Orden de compra sugerida", () => {
  it("propone los productos en alerta con cantidad = mínimo×2 − stock y costo = 80 % del precio, sin guardar nada", async () => {
    const { resultado: res, registros } = await conBitacora(() => post("GERENTE", "/api/ordenes-compra/sugerida", { proveedorId }));
    expect(res.status).toBe(200);
    expect(res.body.proveedor).toEqual({ id: proveedorId, ruc: expect.any(String), razonSocial: expect.any(String) });
    expect(res.body.supuestoCosto).toMatch(/80 %.*supuesto del demo/);
    expect(res.body.lineas).toHaveLength(7);
    const arr = res.body.lineas.find((l: { producto: { codigo: string } }) => l.producto.codigo === "ARR-005");
    expect(arr).toEqual({
      producto: { id: id["ARR-005"], codigo: "ARR-005", nombre: "Frejol canario bolsa 1 kg", unidad: "UND", stock: 18, stockMinimo: 40, precio: "9.80" },
      cantidad: 62,
      costoUnit: "7.84", // 9.80 × 0.80
      subtotal: "486.08",
    });
    const ace = res.body.lineas.find((l: { producto: { codigo: string } }) => l.producto.codigo === "ACE-003");
    expect(ace).toMatchObject({ cantidad: 28, costoUnit: "37.20" });
    const suma = res.body.lineas.reduce((a: number, l: { subtotal: string }) => a + Math.round(Number(l.subtotal) * 100), 0);
    expect(res.body.total).toBe((suma / 100).toFixed(2));

    expect(registros).toHaveLength(0);
    expect(await prisma.ordenCompra.count()).toBe(0);
  });

  it("acepta una lista de productos, sin cuerpo y sin proveedor; valida lo recibido", async () => {
    const res = await post("ADMIN", "/api/ordenes-compra/sugerida", { productoIds: [id["ACE-001"], id["ARR-005"]] });
    expect(res.body.proveedor).toBeNull();
    expect(res.body.lineas.map((l: { producto: { codigo: string }; cantidad: number; costoUnit: string }) => [l.producto.codigo, l.cantidad, l.costoUnit])).toEqual([
      ["ACE-001", 1, "7.92"], // no está en alerta: 120×2 − 480 < 1 → 1
      ["ARR-005", 62, "7.84"],
    ]);
    expect((await post("GERENTE", "/api/ordenes-compra/sugerida")).body.lineas).toHaveLength(7);
    expect((await post("GERENTE", "/api/ordenes-compra/sugerida", { proveedorId: 999999 })).body.error.campos).toHaveProperty("proveedorId");
    expect((await post("GERENTE", "/api/ordenes-compra/sugerida", { productoIds: [999999] })).body.error.campos).toHaveProperty("productoIds");
  });

  it("solo ADMIN y GERENTE la piden", async () => {
    expect((await post("ALMACENERO", "/api/ordenes-compra/sugerida", {})).status).toBe(403);
    expect((await post("VENDEDOR", "/api/ordenes-compra/sugerida", {})).status).toBe(403);
  });
});

// ---------------------------------------------------------------------------------------------

describe("Flujo de una orden de compra (regla 9 · prueba 10)", () => {
  it("sugerida → crear → aprobar → recepcionar suma stock, crea ENTRADAS y saca los productos de la alerta", async () => {
    const sug = (await post("GERENTE", "/api/ordenes-compra/sugerida", { proveedorId })).body;
    const lineas = sug.lineas.map((l: { producto: { id: number }; cantidad: number; costoUnit: string }) => ({
      productoId: l.producto.id,
      cantidad: l.cantidad,
      costoUnit: l.costoUnit,
    }));

    const creada = await conBitacora(() => post("GERENTE", "/api/ordenes-compra", { proveedorId, lineas }));
    expect(creada.resultado.status).toBe(201);
    const oc = creada.resultado.body;
    expect(oc).toMatchObject({ estado: "PENDIENTE", total: sug.total, motivoAnulacion: null, creadoPor: { nombre: "Carlos Mendoza Ríos" } });
    expect(oc.codigo).toBe(`OC-${String(oc.id).padStart(6, "0")}`);
    expect(creada.registros.map((r) => r.accion)).toEqual(["CREAR"]);

    const aprobada = await conBitacora(() => post("GERENTE", `/api/ordenes-compra/${oc.id}/aprobar`));
    expect(aprobada.resultado.body).toMatchObject({ estado: "APROBADA" });
    expect(aprobada.registros.map((r) => r.accion)).toEqual(["CAMBIO_ESTADO"]);

    const antes = await stockDe("ARR-005");
    const recibida = await conBitacora(() => post("ALMACENERO", `/api/ordenes-compra/${oc.id}/recepcionar`));
    expect(recibida.resultado.status).toBe(200);
    expect(recibida.resultado.body).toMatchObject({ estado: "RECIBIDA", acciones: [] });
    expect(recibida.registros.map((r) => r.accion)).toEqual(["RECEPCION"]);
    expect(JSON.parse(recibida.registros[0].detalle)).toMatchObject({ antes: { estado: "APROBADA" }, despues: { estado: "RECIBIDA" } });

    expect(await stockDe("ARR-005")).toBe(antes + 62);
    const entradas = await prisma.movInventario.findMany({ where: { referencia: oc.codigo }, orderBy: { id: "asc" } });
    expect(entradas).toHaveLength(7);
    expect(entradas.every((m) => m.tipo === "ENTRADA" && m.motivo === `Recepción ${oc.codigo}`)).toBe(true);
    const movArr = entradas.find((m) => m.productoId === id["ARR-005"])!;
    expect(movArr).toMatchObject({ cantidad: 62, stockResultante: 80 });

    expect((await get("ALMACENERO", "/api/inventario/alertas")).body.total).toBe(0);
    expect((await get("GERENTE", `/api/ordenes-compra/${oc.id}`)).body.historial.map((h: { accion: string }) => h.accion)).toEqual([
      "CREAR",
      "CAMBIO_ESTADO",
      "RECEPCION",
    ]);
    await verificarKardex();
  });

  it("recepcionar dos veces a la vez solo suma una vez", async () => {
    const oc = await crearOrden([{ codigo: "ACE-001", cantidad: 10, costoUnit: "7.90" }]);
    await post("GERENTE", `/api/ordenes-compra/${oc.id}/aprobar`);
    const r = await Promise.all([
      post("ALMACENERO", `/api/ordenes-compra/${oc.id}/recepcionar`),
      post("ALMACENERO", `/api/ordenes-compra/${oc.id}/recepcionar`),
    ]);
    expect(r.map((x) => x.status).sort()).toEqual([200, 422]);
    expect(await stockDe("ACE-001")).toBe(490);
    await verificarKardex();
  });

  it("anular desde PENDIENTE o APROBADA exige motivo y deja un ANULAR con el motivo", async () => {
    const oc = await crearOrden([{ codigo: "ACE-001", cantidad: 10, costoUnit: 7.9 }]);
    expect((await post("ADMIN", `/api/ordenes-compra/${oc.id}/anular`, { motivo: "corto" })).body.error.campos).toHaveProperty("motivo");

    const { resultado, registros } = await conBitacora(() =>
      post("ADMIN", `/api/ordenes-compra/${oc.id}/anular`, { motivo: "Proveedor sin stock disponible" }),
    );
    expect(resultado.body).toMatchObject({ estado: "ANULADA", motivoAnulacion: "Proveedor sin stock disponible", acciones: [] });
    expect(registros.map((r) => r.accion)).toEqual(["ANULAR"]);

    const ap = await crearOrden([{ codigo: "ACE-001", cantidad: 1, costoUnit: "7.90" }]);
    await post("GERENTE", `/api/ordenes-compra/${ap.id}/aprobar`);
    expect((await post("GERENTE", `/api/ordenes-compra/${ap.id}/anular`, { motivo: "Se compró a otro proveedor" })).body.estado).toBe("ANULADA");
  });

  it("transiciones inválidas → 422 sin bitácora", async () => {
    const oc = await crearOrden([{ codigo: "ACE-001", cantidad: 5, costoUnit: "7.90" }]);
    await post("GERENTE", `/api/ordenes-compra/${oc.id}/aprobar`);
    await post("ALMACENERO", `/api/ordenes-compra/${oc.id}/recepcionar`);

    const { registros } = await conBitacora(async () => {
      const r1 = await post("GERENTE", `/api/ordenes-compra/${oc.id}/aprobar`);
      expect(r1.status).toBe(422);
      expect(r1.body.error).toEqual({ codigo: "TRANSICION_INVALIDA", mensaje: "No se puede pasar de RECIBIDA a APROBADA" });
      expect((await post("ALMACENERO", `/api/ordenes-compra/${oc.id}/recepcionar`)).body.error.mensaje).toBe(
        "No se puede pasar de RECIBIDA a RECIBIDA",
      );
      expect((await post("GERENTE", `/api/ordenes-compra/${oc.id}/anular`, { motivo: "Ya no se necesita" })).body.error.mensaje).toBe(
        "No se puede pasar de RECIBIDA a ANULADA",
      );
    });
    expect(registros).toHaveLength(0);
    expect(await stockDe("ACE-001")).toBe(485);

    // Una anulada tampoco se aprueba.
    const an = await crearOrden([{ codigo: "ACE-001", cantidad: 1, costoUnit: "7.90" }]);
    await post("GERENTE", `/api/ordenes-compra/${an.id}/anular`, { motivo: "Error de digitación" });
    expect((await post("GERENTE", `/api/ordenes-compra/${an.id}/aprobar`)).status).toBe(422);
  });
});

// ---------------------------------------------------------------------------------------------

describe("Permisos y visibilidad de órdenes de compra", () => {
  it("el ADMIN crea y anula pero no aprueba; el almacenero solo recepciona; el vendedor no tiene acceso", async () => {
    const oc = await crearOrden([{ codigo: "ACE-001", cantidad: 5, costoUnit: "7.90" }], "ADMIN");
    const { registros } = await conBitacora(async () => {
      expect((await post("ADMIN", `/api/ordenes-compra/${oc.id}/aprobar`)).status).toBe(403);
      expect((await post("ALMACENERO", `/api/ordenes-compra/${oc.id}/aprobar`)).status).toBe(403);
      expect((await post("VENDEDOR", `/api/ordenes-compra/${oc.id}/aprobar`)).status).toBe(403);
      expect((await post("ALMACENERO", "/api/ordenes-compra", { proveedorId, lineas: [] })).status).toBe(403);
      expect((await post("ALMACENERO", `/api/ordenes-compra/${oc.id}/anular`, { motivo: "Motivo suficiente" })).status).toBe(403);
      expect((await get("VENDEDOR", "/api/ordenes-compra")).status).toBe(403);
      expect((await get("VENDEDOR", `/api/ordenes-compra/${oc.id}`)).status).toBe(403);
      // El almacenero no ve ni recepciona una orden PENDIENTE.
      expect((await post("ALMACENERO", `/api/ordenes-compra/${oc.id}/recepcionar`)).status).toBe(403);
      expect((await get("ALMACENERO", `/api/ordenes-compra/${oc.id}`)).status).toBe(403);
    });
    expect(registros).toHaveLength(0);

    await post("GERENTE", `/api/ordenes-compra/${oc.id}/aprobar`);
    expect((await post("GERENTE", `/api/ordenes-compra/${oc.id}/recepcionar`)).status).toBe(403);
    expect((await post("ADMIN", `/api/ordenes-compra/${oc.id}/recepcionar`)).status).toBe(403);
  });

  it("`acciones` refleja lo que cada rol puede hacer", async () => {
    const oc = await crearOrden([{ codigo: "ACE-001", cantidad: 5, costoUnit: "7.90" }]);
    expect(oc.acciones).toEqual(["aprobar", "anular"]);
    expect((await get("ADMIN", `/api/ordenes-compra/${oc.id}`)).body.acciones).toEqual(["anular"]);
    await post("GERENTE", `/api/ordenes-compra/${oc.id}/aprobar`);
    expect((await get("ALMACENERO", `/api/ordenes-compra/${oc.id}`)).body.acciones).toEqual(["recepcionar"]);
    expect((await get("GERENTE", `/api/ordenes-compra/${oc.id}`)).body.acciones).toEqual(["anular"]);
  });

  it("lista con filas documentadas, filtros y visibilidad del almacenero", async () => {
    const pendiente = await crearOrden([{ codigo: "ACE-001", cantidad: 3, costoUnit: "7.90" }, { codigo: "LAC-001", cantidad: 10, costoUnit: "3.28" }]);
    const aprobada = await crearOrden([{ codigo: "ACE-001", cantidad: 1, costoUnit: "7.90" }]);
    await post("GERENTE", `/api/ordenes-compra/${aprobada.id}/aprobar`);

    const res = await get("GERENTE", "/api/ordenes-compra");
    expect(res.body).toMatchObject({ total: 2, page: 1, pageSize: 20 });
    expect(res.body.datos[1]).toEqual({
      id: pendiente.id,
      codigo: pendiente.codigo,
      fecha: expect.any(String),
      estado: "PENDIENTE",
      proveedor: { id: proveedorId, ruc: expect.any(String), razonSocial: expect.any(String) },
      numLineas: 2,
      total: "56.50", // 3×7.90 + 10×3.28
    });
    expect((await get("GERENTE", "/api/ordenes-compra?estado=PENDIENTE")).body.total).toBe(1);
    expect((await get("GERENTE", `/api/ordenes-compra?proveedorId=${proveedorId}`)).body.total).toBe(2);
    expect((await get("GERENTE", "/api/ordenes-compra?proveedorId=999999")).body.total).toBe(0);
    expect((await get("GERENTE", "/api/ordenes-compra?hasta=2020-01-01")).body.total).toBe(0);

    const alm = await get("ALMACENERO", "/api/ordenes-compra");
    expect(alm.body.datos.map((o: { id: number }) => o.id)).toEqual([aprobada.id]);

    const detalle = await get("GERENTE", `/api/ordenes-compra/${pendiente.id}`);
    expect(detalle.body.lineas[0]).toEqual({
      id: expect.any(Number),
      producto: { id: id["ACE-001"], codigo: "ACE-001", nombre: expect.any(String), unidad: "UND", stock: 480, stockMinimo: 120 },
      cantidad: 3,
      costoUnit: "7.90",
      subtotal: "23.70",
    });
    expect((await get("GERENTE", "/api/ordenes-compra/999999")).status).toBe(404);
  });

  it("valida proveedor, productos repetidos o inexistentes y costos", async () => {
    const base = { proveedorId, lineas: [{ productoId: id["ACE-001"], cantidad: 1, costoUnit: "7.90" }] };
    expect((await post("GERENTE", "/api/ordenes-compra", { ...base, lineas: [] })).body.error.campos).toHaveProperty("lineas");
    const rep = await post("GERENTE", "/api/ordenes-compra", { ...base, lineas: [...base.lineas, ...base.lineas] });
    expect(rep.body.error.campos.lineas).toBe("No repita el mismo producto en dos líneas");
    expect((await post("GERENTE", "/api/ordenes-compra", { ...base, lineas: [{ ...base.lineas[0], costoUnit: 0 }] })).body.error.campos).toHaveProperty("lineas.0.costoUnit");
    expect((await post("GERENTE", "/api/ordenes-compra", { ...base, lineas: [{ ...base.lineas[0], costoUnit: "7.905" }] })).status).toBe(400);
    expect((await post("GERENTE", "/api/ordenes-compra", { ...base, proveedorId: 999999 })).body.error.campos).toHaveProperty("proveedorId");
    expect((await post("GERENTE", "/api/ordenes-compra", { ...base, lineas: [{ ...base.lineas[0], productoId: 999999 }] })).body.error.campos).toHaveProperty("lineas.0.productoId");
    expect(await prisma.ordenCompra.count()).toBe(0);
  });
});
