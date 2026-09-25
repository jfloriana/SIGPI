import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/db.ts";
import { sembrar } from "../prisma/seed.ts";
import { app, tokenRapido } from "./helpers.ts";

type Quien = "ADMIN" | "GERENTE" | "VENDEDOR" | "VENDEDOR2" | "ALMACENERO";
const EMAIL: Record<Quien, string> = {
  ADMIN: "admin@distrinorte.pe",
  GERENTE: "gerente@distrinorte.pe",
  VENDEDOR: "vendedor1@distrinorte.pe",
  VENDEDOR2: "vendedor2@distrinorte.pe",
  ALMACENERO: "almacen@distrinorte.pe",
};

let tokens: Record<Quien, string>;
let clienteId: number;
const prod: Record<string, { id: number; stock: number; precio: string }> = {};

beforeEach(async () => {
  await sembrar();
  tokens = Object.fromEntries(
    await Promise.all((Object.keys(EMAIL) as Quien[]).map(async (q) => [q, await tokenRapido(EMAIL[q])])),
  ) as Record<Quien, string>;
  clienteId = (await prisma.cliente.findFirstOrThrow({ where: { activo: true }, orderBy: { id: "asc" } })).id;
  for (const p of await prisma.producto.findMany()) {
    prod[p.codigo] = { id: p.id, stock: p.stock, precio: p.precio.toFixed(2) };
  }
});

const auth = (q: Quien) => ({ Authorization: `Bearer ${tokens[q]}` });
const get = (q: Quien, url: string) => request(app).get(url).set(auth(q));
const post = (q: Quien, url: string, body: object = {}) => request(app).post(url).set(auth(q)).send(body);

const linea = (codigo: string, cantidad: number) => ({ productoId: prod[codigo].id, cantidad });

/** Registra un pedido como vendedor1 (o vendedor2) y devuelve el cuerpo de la respuesta. */
async function registrar(lineas: { productoId: number; cantidad: number }[], condicionPago = "CONTADO", quien: Quien = "VENDEDOR") {
  const res = await post(quien, "/api/pedidos", { clienteId, condicionPago, lineas });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body;
}

const stockDe = async (codigo: string) => (await prisma.producto.findUniqueOrThrow({ where: { codigo } })).stock;
const ultimoIdBitacora = async () => (await prisma.bitacora.aggregate({ _max: { id: true } }))._max.id ?? 0;
const bitacoraDesde = (id: number) => prisma.bitacora.findMany({ where: { id: { gt: id } }, orderBy: { id: "asc" } });

async function acciones<T>(operacion: () => Promise<T>) {
  const desde = await ultimoIdBitacora();
  const resultado = await operacion();
  return { resultado, registros: await bitacoraDesde(desde) };
}

async function kardexCuadra() {
  for (const p of await prisma.producto.findMany({ include: { movimientos: true } })) {
    const suma = p.movimientos.reduce(
      (a, m) => a + (m.tipo === "ENTRADA" || m.tipo === "AJUSTE_POSITIVO" ? m.cantidad : -m.cantidad),
      0,
    );
    expect(suma, p.codigo).toBe(p.stock);
    expect(p.stock).toBeGreaterThanOrEqual(0);
  }
}

// ---------------------------------------------------------------------------------------------

describe("Registro de pedidos (reglas 3, 4, 5 y 7)", () => {
  it("calcula el total en el servidor e ignora total y precioUnit enviados (prueba 2)", async () => {
    const res = await post("VENDEDOR", "/api/pedidos", {
      clienteId,
      condicionPago: "CONTADO",
      total: "1.00",
      lineas: [
        { ...linea("ACE-001", 3), precioUnit: "0.01", subtotal: "0.03" },
        linea("LAC-001", 7),
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.total).toBe("58.40"); // 9.90×3 + 4.10×7
    expect(res.body.codigo).toMatch(/^PED-\d{6}$/);
    expect(res.body.codigo).toBe(`PED-${String(res.body.id).padStart(6, "0")}`);
    expect(res.body.lineas).toEqual([
      { id: expect.any(Number), producto: { id: prod["ACE-001"].id, codigo: "ACE-001", nombre: expect.any(String), unidad: "UND" }, cantidad: 3, precioUnit: "9.90", subtotal: "29.70" },
      { id: expect.any(Number), producto: expect.objectContaining({ codigo: "LAC-001" }), cantidad: 7, precioUnit: "4.10", subtotal: "28.70" },
    ]);
    const enBase = await prisma.pedido.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(enBase.total.toFixed(2)).toBe("58.40");
    // El stock no se descuenta al registrar.
    expect(await stockDe("ACE-001")).toBe(prod["ACE-001"].stock);
  });

  it("cantidad > stock → 409 STOCK_INSUFICIENTE con producto y stock, y no crea nada (prueba 3)", async () => {
    const { resultado: res, registros } = await acciones(() =>
      post("VENDEDOR", "/api/pedidos", { clienteId, condicionPago: "CONTADO", lineas: [linea("ACE-001", 1), linea("ARR-005", 20)] }),
    );
    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("STOCK_INSUFICIENTE");
    expect(res.body.error.mensaje).toContain("Frejol canario bolsa 1 kg");
    expect(res.body.error.mensaje).toContain("stock disponible 18");
    expect(res.body.error.productos).toEqual([
      { productoId: prod["ARR-005"].id, codigo: "ARR-005", nombre: "Frejol canario bolsa 1 kg", stockDisponible: 18, solicitado: 20 },
    ]);
    expect(res.body.error.campos).toEqual({ "lineas.1.cantidad": "Stock disponible: 18" });
    expect(registros).toHaveLength(0);
    expect(await prisma.pedido.count()).toBe(0);
    expect(await prisma.detallePedido.count()).toBe(0);
  });

  it("contado ≤ S/ 2 000 se aprueba automáticamente (CREAR + CAMBIO_ESTADO AUTOMATICA)", async () => {
    // 185×10 + 25×6 = 2000.00 exacto → automático.
    const { resultado: p, registros } = await acciones(() => registrar([linea("ARR-001", 10), linea("BEB-008", 6)]));
    expect(p.total).toBe("2000.00");
    expect(p).toMatchObject({ estado: "APROBADO", aprobadoPor: null, aprobacionAutomatica: true, fechaAprobacion: expect.any(String) });
    expect(registros.map((r) => r.accion)).toEqual(["CREAR", "CAMBIO_ESTADO"]);
    expect(JSON.parse(registros[1].detalle)).toMatchObject({
      antes: { estado: "REGISTRADO" },
      despues: { estado: "APROBADO", aprobacion: "AUTOMATICA" },
    });
  });

  it("contado > S/ 2 000 y crédito quedan REGISTRADOS (solo CREAR)", async () => {
    const { resultado: grande, registros } = await acciones(() => registrar([linea("ARR-001", 11)]));
    expect(grande).toMatchObject({ total: "2035.00", estado: "REGISTRADO", aprobacionAutomatica: false, fechaAprobacion: null });
    expect(registros.map((r) => r.accion)).toEqual(["CREAR"]);

    const credito = await registrar([linea("ACE-001", 1)], "CREDITO");
    expect(credito).toMatchObject({ total: "9.90", estado: "REGISTRADO" });
  });

  it("valida líneas, productos repetidos, cliente y producto inactivos", async () => {
    const vacio = await post("VENDEDOR", "/api/pedidos", { clienteId, condicionPago: "CONTADO", lineas: [] });
    expect(vacio.status).toBe(400);
    expect(vacio.body.error.campos).toHaveProperty("lineas");

    const repetido = await post("VENDEDOR", "/api/pedidos", { clienteId, condicionPago: "CONTADO", lineas: [linea("ACE-001", 1), linea("ACE-001", 2)] });
    expect(repetido.status).toBe(400);
    expect(repetido.body.error.campos.lineas).toBe("No repita el mismo producto en dos líneas");

    const cero = await post("VENDEDOR", "/api/pedidos", { clienteId, condicionPago: "CONTADO", lineas: [linea("ACE-001", 0)] });
    expect(cero.body.error.campos).toHaveProperty("lineas.0.cantidad");

    const pago = await post("VENDEDOR", "/api/pedidos", { clienteId, condicionPago: "TARJETA", lineas: [linea("ACE-001", 1)] });
    expect(pago.body.error.campos).toHaveProperty("condicionPago");

    const inactivo = await prisma.cliente.findFirstOrThrow({ where: { activo: false } });
    const cli = await post("VENDEDOR", "/api/pedidos", { clienteId: inactivo.id, condicionPago: "CONTADO", lineas: [linea("ACE-001", 1)] });
    expect(cli.status).toBe(400);
    expect(cli.body.error.campos).toHaveProperty("clienteId");

    await prisma.producto.update({ where: { codigo: "ACE-001" }, data: { activo: false } });
    const pr = await post("VENDEDOR", "/api/pedidos", { clienteId, condicionPago: "CONTADO", lineas: [linea("LAC-001", 1), linea("ACE-001", 1)] });
    expect(pr.status).toBe(400);
    expect(pr.body.error.campos).toHaveProperty("lineas.1.productoId");
    expect(await prisma.pedido.count()).toBe(0);
  });

  it("solo el VENDEDOR registra pedidos", async () => {
    for (const q of ["ADMIN", "GERENTE", "ALMACENERO"] as const) {
      expect((await post(q, "/api/pedidos", { clienteId, condicionPago: "CONTADO", lineas: [linea("ACE-001", 1)] })).status).toBe(403);
    }
  });
});

// ---------------------------------------------------------------------------------------------

describe("Máquina de estados (regla 6 · prueba 4)", () => {
  it("recorre REGISTRADO → APROBADO → DESPACHADO → ENTREGADO con un registro de bitácora por paso", async () => {
    const p = await registrar([linea("ACE-001", 2)], "CREDITO");

    const a = await acciones(() => post("GERENTE", `/api/pedidos/${p.id}/aprobar`));
    expect(a.resultado.status).toBe(200);
    expect(a.resultado.body).toMatchObject({ estado: "APROBADO", aprobadoPor: { nombre: "Carlos Mendoza Ríos" }, aprobacionAutomatica: false });
    expect(a.registros.map((r) => r.accion)).toEqual(["CAMBIO_ESTADO"]);
    expect(JSON.parse(a.registros[0].detalle)).toEqual({ antes: { estado: "REGISTRADO" }, despues: { estado: "APROBADO", aprobacion: "MANUAL" } });

    const d = await acciones(() => post("ALMACENERO", `/api/pedidos/${p.id}/despachar`));
    expect(d.resultado.body).toMatchObject({ estado: "DESPACHADO", despachadoPor: { nombre: "Jorge Alvarado Díaz" }, fechaDespacho: expect.any(String) });
    expect(d.registros.map((r) => r.accion)).toEqual(["CAMBIO_ESTADO"]);

    const e = await acciones(() => post("ALMACENERO", `/api/pedidos/${p.id}/entregar`));
    expect(e.resultado.body).toMatchObject({ estado: "ENTREGADO", fechaEntrega: expect.any(String), acciones: [] });
    expect(e.registros.map((r) => r.accion)).toEqual(["CAMBIO_ESTADO"]);

    const detalle = await get("GERENTE", `/api/pedidos/${p.id}`);
    expect(detalle.body.historial.map((h: { accion: string; despues: { estado: string } }) => [h.accion, h.despues.estado])).toEqual([
      ["CREAR", "REGISTRADO"],
      ["CAMBIO_ESTADO", "APROBADO"],
      ["CAMBIO_ESTADO", "DESPACHADO"],
      ["CAMBIO_ESTADO", "ENTREGADO"],
    ]);
    expect(detalle.body.historial[0]).toMatchObject({ usuario: { nombre: "Luis Paredes Castillo" }, fecha: expect.any(String), antes: null });

    // ENTREGADO → APROBADO y demás transiciones inválidas → 422, sin bitácora.
    const inval = await acciones(async () => {
      const r1 = await post("GERENTE", `/api/pedidos/${p.id}/aprobar`);
      expect(r1.status).toBe(422);
      expect(r1.body.error).toEqual({ codigo: "TRANSICION_INVALIDA", mensaje: "No se puede pasar de ENTREGADO a APROBADO" });
      expect((await post("ALMACENERO", `/api/pedidos/${p.id}/despachar`)).status).toBe(422);
      expect((await post("GERENTE", `/api/pedidos/${p.id}/anular`, { motivo: "Cliente ya no lo quiere" })).status).toBe(422);
    });
    expect(inval.registros).toHaveLength(0);
  });

  it("no se puede anular un DESPACHADO ni saltarse estados", async () => {
    const p = await registrar([linea("ACE-001", 1)]); // APROBADO (automático)
    const saltar = await post("ALMACENERO", `/api/pedidos/${p.id}/entregar`);
    expect(saltar.status).toBe(422);
    expect(saltar.body.error.mensaje).toBe("No se puede pasar de APROBADO a ENTREGADO");

    await post("ALMACENERO", `/api/pedidos/${p.id}/despachar`);
    const anular = await post("GERENTE", `/api/pedidos/${p.id}/anular`, { motivo: "Cliente canceló el pedido" });
    expect(anular.status).toBe(422);
    expect(anular.body.error.mensaje).toBe("No se puede pasar de DESPACHADO a ANULADO");

    const r = await registrar([linea("ACE-001", 1)], "CREDITO");
    const despacharRegistrado = await post("ALMACENERO", `/api/pedidos/${r.id}/despachar`);
    expect(despacharRegistrado.status).toBe(403); // el almacenero ni siquiera ve pedidos REGISTRADOS
  });

  it("anular exige motivo de 10+ caracteres y registra un ANULAR", async () => {
    const p = await registrar([linea("ACE-001", 1)], "CREDITO");
    const corto = await post("GERENTE", `/api/pedidos/${p.id}/anular`, { motivo: "corto" });
    expect(corto.status).toBe(400);
    expect(corto.body.error.campos).toHaveProperty("motivo");
    expect((await post("GERENTE", `/api/pedidos/${p.id}/anular`)).status).toBe(400);

    const { resultado, registros } = await acciones(() =>
      post("GERENTE", `/api/pedidos/${p.id}/anular`, { motivo: "  Cliente canceló por teléfono  " }),
    );
    expect(resultado.body).toMatchObject({ estado: "ANULADO", motivoAnulacion: "Cliente canceló por teléfono" });
    expect(registros.map((r) => r.accion)).toEqual(["ANULAR"]);
    expect(JSON.parse(registros[0].detalle)).toEqual({
      antes: { estado: "REGISTRADO" },
      despues: { estado: "ANULADO", motivo: "Cliente canceló por teléfono" },
    });

    // Un APROBADO también se puede anular (por el gerente).
    const ap = await registrar([linea("ACE-001", 1)]);
    expect((await post("GERENTE", `/api/pedidos/${ap.id}/anular`, { motivo: "Error en la dirección" })).status).toBe(200);
  });

  it("el VENDEDOR anula solo sus pedidos y solo en REGISTRADO", async () => {
    const propio = await registrar([linea("ACE-001", 1)], "CREDITO");
    const ajeno = await registrar([linea("ACE-001", 1)], "CREDITO", "VENDEDOR2");
    const aprobado = await registrar([linea("ACE-001", 1)]);

    expect((await post("VENDEDOR", `/api/pedidos/${ajeno.id}/anular`, { motivo: "Motivo suficiente" })).status).toBe(403);
    const ap = await post("VENDEDOR", `/api/pedidos/${aprobado.id}/anular`, { motivo: "Motivo suficiente" });
    expect(ap.status).toBe(403);
    expect(ap.body.error.mensaje).toMatch(/REGISTRADO/);
    const ok = await post("VENDEDOR", `/api/pedidos/${propio.id}/anular`, { motivo: "Motivo suficiente" });
    expect(ok.status).toBe(200);
    expect(ok.body.estado).toBe("ANULADO");
  });
});

// ---------------------------------------------------------------------------------------------

describe("Despacho atómico (regla 8 · pruebas 5 y 6)", () => {
  it("descuenta stock, crea un movimiento SALIDA por línea y cambia el estado", async () => {
    const p = await registrar([linea("ACE-001", 5), linea("LAC-001", 12)]);
    const res = await post("ALMACENERO", `/api/pedidos/${p.id}/despachar`);
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("DESPACHADO");

    expect(await stockDe("ACE-001")).toBe(prod["ACE-001"].stock - 5);
    expect(await stockDe("LAC-001")).toBe(prod["LAC-001"].stock - 12);
    const movs = await prisma.movInventario.findMany({ where: { tipo: "SALIDA" }, orderBy: { id: "asc" } });
    expect(movs).toHaveLength(2);
    expect(movs[0]).toMatchObject({
      productoId: prod["ACE-001"].id,
      cantidad: 5,
      stockResultante: prod["ACE-001"].stock - 5,
      motivo: `Despacho ${p.codigo}`,
      referencia: p.codigo,
    });
    const almacenero = await prisma.usuario.findUniqueOrThrow({ where: { email: EMAIL.ALMACENERO } });
    expect(movs.every((m) => m.usuarioId === almacenero.id)).toBe(true);
    await kardexCuadra();
  });

  it("si una línea no tiene stock, NADA cambia: stock, movimientos, estado ni bitácora", async () => {
    const a = await registrar([linea("ARR-005", 15)]); // stock 18
    const b = await registrar([linea("ACE-001", 5), linea("ARR-005", 10)]);
    expect((await post("ALMACENERO", `/api/pedidos/${a.id}/despachar`)).status).toBe(200); // quedan 3

    const movsAntes = await prisma.movInventario.count();
    const aceAntes = await stockDe("ACE-001");
    const { resultado, registros } = await acciones(() => post("ALMACENERO", `/api/pedidos/${b.id}/despachar`));
    expect(resultado.status).toBe(409);
    expect(resultado.body.error).toMatchObject({
      codigo: "STOCK_INSUFICIENTE",
      productos: [{ codigo: "ARR-005", stockDisponible: 3, solicitado: 10 }],
    });
    expect(registros).toHaveLength(0);
    expect(await stockDe("ACE-001")).toBe(aceAntes); // la primera línea se revirtió
    expect(await stockDe("ARR-005")).toBe(3);
    expect(await prisma.movInventario.count()).toBe(movsAntes);
    const pb = await prisma.pedido.findUniqueOrThrow({ where: { id: b.id } });
    expect(pb).toMatchObject({ estado: "APROBADO", despachadoPorId: null, fechaDespacho: null });
    await kardexCuadra();
  });

  it("dos despachos concurrentes del mismo stock: solo uno tiene éxito y el stock nunca es negativo", async () => {
    // ACE-003 tiene 12: dos pedidos de 8 caben al registrar, pero no juntos al despachar.
    const p1 = await registrar([linea("ACE-003", 8)]);
    const p2 = await registrar([linea("ACE-003", 8)], "CONTADO", "VENDEDOR2");
    const respuestas = await Promise.all([
      post("ALMACENERO", `/api/pedidos/${p1.id}/despachar`),
      post("ALMACENERO", `/api/pedidos/${p2.id}/despachar`),
    ]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await stockDe("ACE-003")).toBe(4);
    expect(await prisma.movInventario.count({ where: { tipo: "SALIDA" } })).toBe(1);
    expect(await prisma.pedido.count({ where: { estado: "DESPACHADO" } })).toBe(1);
    await kardexCuadra();
  });

  it("el mismo pedido despachado dos veces a la vez solo descuenta una vez", async () => {
    const p = await registrar([linea("ACE-001", 4)]);
    const respuestas = await Promise.all([
      post("ALMACENERO", `/api/pedidos/${p.id}/despachar`),
      post("ALMACENERO", `/api/pedidos/${p.id}/despachar`),
    ]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 422]);
    expect(await stockDe("ACE-001")).toBe(prod["ACE-001"].stock - 4);
    expect(await prisma.bitacora.count({ where: { entidad: "Pedido", entidadId: String(p.id), accion: "CAMBIO_ESTADO" } })).toBe(2); // automática + despacho
    await kardexCuadra();
  });
});

// ---------------------------------------------------------------------------------------------

describe("Permisos, visibilidad y segregación (reglas 11 y 13 · prueba 7)", () => {
  it("VENDEDOR no puede aprobar ni despachar; ADMIN no aprueba ni anula (403)", async () => {
    const r = await registrar([linea("ACE-001", 1)], "CREDITO");
    const ap = await registrar([linea("ACE-001", 1)]);
    const sin = await acciones(async () => {
      expect((await post("VENDEDOR", `/api/pedidos/${r.id}/aprobar`)).status).toBe(403);
      expect((await post("VENDEDOR", `/api/pedidos/${ap.id}/despachar`)).status).toBe(403);
      expect((await post("ADMIN", `/api/pedidos/${r.id}/aprobar`)).status).toBe(403);
      expect((await post("ADMIN", `/api/pedidos/${r.id}/anular`, { motivo: "Motivo suficiente" })).status).toBe(403);
      expect((await post("ADMIN", `/api/pedidos/${ap.id}/despachar`)).status).toBe(403);
      expect((await post("GERENTE", `/api/pedidos/${ap.id}/despachar`)).status).toBe(403);
      expect((await post("ALMACENERO", `/api/pedidos/${r.id}/aprobar`)).status).toBe(403);
    });
    expect(sin.registros).toHaveLength(0);
  });

  it("un vendedor no ve los pedidos de otro (lista y detalle), aunque pida su vendedorId", async () => {
    const propio = await registrar([linea("ACE-001", 1)]);
    const ajeno = await registrar([linea("ACE-001", 1)], "CONTADO", "VENDEDOR2");

    const lista = await get("VENDEDOR", "/api/pedidos");
    expect(lista.body.total).toBe(1);
    expect(lista.body.datos[0].id).toBe(propio.id);

    const v2 = await prisma.usuario.findUniqueOrThrow({ where: { email: EMAIL.VENDEDOR2 } });
    const truco = await get("VENDEDOR", `/api/pedidos?vendedorId=${v2.id}`);
    expect(truco.body.datos.map((p: { id: number }) => p.id)).toEqual([propio.id]);

    const detalle = await get("VENDEDOR", `/api/pedidos/${ajeno.id}`);
    expect(detalle.status).toBe(403);

    // GERENTE y ADMIN ven todos; y sí pueden filtrar por vendedor.
    expect((await get("ADMIN", "/api/pedidos")).body.total).toBe(2);
    expect((await get("GERENTE", `/api/pedidos?vendedorId=${v2.id}`)).body.datos.map((p: { id: number }) => p.id)).toEqual([ajeno.id]);
  });

  it("el ALMACENERO solo ve pedidos aprobados, despachados o entregados", async () => {
    const registrado = await registrar([linea("ACE-001", 1)], "CREDITO");
    const aprobado = await registrar([linea("ACE-001", 1)]);
    const lista = await get("ALMACENERO", "/api/pedidos");
    expect(lista.body.datos.map((p: { id: number }) => p.id)).toEqual([aprobado.id]);
    expect((await get("ALMACENERO", `/api/pedidos/${registrado.id}`)).status).toBe(403);
    expect((await get("ALMACENERO", "/api/pedidos?estado=REGISTRADO")).body.total).toBe(0);
  });

  it("segregación: quien registró no aprueba ni despacha aunque se le cambie el rol", async () => {
    const credito = await registrar([linea("ACE-001", 1)], "CREDITO");
    const aprobado = await registrar([linea("ACE-001", 1)]);
    const vendedor = await prisma.usuario.findUniqueOrThrow({ where: { email: EMAIL.VENDEDOR } });

    const rolGerente = await prisma.rol.findUniqueOrThrow({ where: { nombre: "GERENTE" } });
    await prisma.usuario.update({ where: { id: vendedor.id }, data: { rolId: rolGerente.id } });
    const aprobar = await post("VENDEDOR", `/api/pedidos/${credito.id}/aprobar`);
    expect(aprobar.status).toBe(403);
    expect(aprobar.body.error.codigo).toBe("SEGREGACION_FUNCIONES");
    expect((await get("VENDEDOR", `/api/pedidos/${credito.id}`)).body.acciones).toEqual(["anular"]);

    const rolAlmacen = await prisma.rol.findUniqueOrThrow({ where: { nombre: "ALMACENERO" } });
    await prisma.usuario.update({ where: { id: vendedor.id }, data: { rolId: rolAlmacen.id } });
    const despachar = await post("VENDEDOR", `/api/pedidos/${aprobado.id}/despachar`);
    expect(despachar.status).toBe(403);
    expect(despachar.body.error.codigo).toBe("SEGREGACION_FUNCIONES");

    const p = await prisma.pedido.findUniqueOrThrow({ where: { id: aprobado.id } });
    expect(p.estado).toBe("APROBADO");
    expect(await stockDe("ACE-001")).toBe(prod["ACE-001"].stock);
  });

  it("`acciones` refleja lo que cada usuario puede hacer", async () => {
    const r = await registrar([linea("ACE-001", 1)], "CREDITO");
    expect(r.acciones).toEqual(["anular"]); // el vendedor, sobre su pedido REGISTRADO
    expect((await get("GERENTE", `/api/pedidos/${r.id}`)).body.acciones).toEqual(["aprobar", "anular"]);
    expect((await get("ADMIN", `/api/pedidos/${r.id}`)).body.acciones).toEqual([]);

    const a = await registrar([linea("ACE-001", 1)]);
    expect(a.acciones).toEqual([]);
    expect((await get("ALMACENERO", `/api/pedidos/${a.id}`)).body.acciones).toEqual(["despachar"]);
    expect((await get("GERENTE", `/api/pedidos/${a.id}`)).body.acciones).toEqual(["anular"]);
    await post("ALMACENERO", `/api/pedidos/${a.id}/despachar`);
    expect((await get("ALMACENERO", `/api/pedidos/${a.id}`)).body.acciones).toEqual(["entregar"]);
  });
});

// ---------------------------------------------------------------------------------------------

describe("Listado de pedidos", () => {
  it("devuelve filas con la forma documentada, filtra y ordena", async () => {
    const p1 = await registrar([linea("ACE-001", 1), linea("LAC-001", 2)]);
    const p2 = await registrar([linea("ACE-001", 1)], "CREDITO");
    const p3 = await registrar([linea("ACE-001", 1)]);

    const res = await get("GERENTE", "/api/pedidos");
    expect(res.body).toMatchObject({ total: 3, page: 1, pageSize: 20 });
    expect(res.body.datos.map((p: { id: number }) => p.id)).toEqual([p3.id, p2.id, p1.id]);
    expect(res.body.datos[2]).toEqual({
      id: p1.id,
      codigo: p1.codigo,
      fecha: expect.any(String),
      estado: "APROBADO",
      condicionPago: "CONTADO",
      total: "18.10",
      cliente: { id: clienteId, razonSocial: expect.any(String), zona: expect.any(String) },
      vendedor: { id: expect.any(Number), nombre: "Luis Paredes Castillo" },
      numLineas: 2,
    });

    const cola = await get("ALMACENERO", "/api/pedidos?estado=APROBADO&orden=antiguedad");
    expect(cola.body.datos.map((p: { id: number }) => p.id)).toEqual([p1.id, p3.id]);

    expect((await get("GERENTE", "/api/pedidos?estado=REGISTRADO")).body.total).toBe(1);
    expect((await get("GERENTE", `/api/pedidos?buscar=${p2.codigo.toLowerCase()}`)).body.datos[0].id).toBe(p2.id);
    expect((await get("GERENTE", `/api/pedidos?clienteId=${clienteId}`)).body.total).toBe(3);
    expect((await get("GERENTE", "/api/pedidos?page=2&pageSize=2")).body.datos).toHaveLength(1);

    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
    expect((await get("GERENTE", `/api/pedidos?desde=${hoy}&hasta=${hoy}`)).body.total).toBe(3);
    expect((await get("GERENTE", "/api/pedidos?hasta=2020-01-01")).body.total).toBe(0);
    expect((await get("GERENTE", "/api/pedidos?desde=2030-01-01")).body.total).toBe(0);
    expect((await get("GERENTE", "/api/pedidos?desde=01-01-2026")).status).toBe(400);
    expect((await get("GERENTE", "/api/pedidos?desde=2026-02-01&hasta=2026-01-01")).status).toBe(400);
    expect((await get("GERENTE", "/api/pedidos?estado=PERDIDO")).status).toBe(400);
  });

  it("interpreta desde/hasta en hora de Lima (hasta inclusive)", async () => {
    const p = await registrar([linea("ACE-001", 1)]);
    // 2026-03-10 23:30 en Lima = 2026-03-11 04:30 UTC.
    await prisma.pedido.update({ where: { id: p.id }, data: { fecha: new Date("2026-03-11T04:30:00Z") } });
    expect((await get("GERENTE", "/api/pedidos?desde=2026-03-10&hasta=2026-03-10")).body.total).toBe(1);
    expect((await get("GERENTE", "/api/pedidos?desde=2026-03-11")).body.total).toBe(0);
  });

  it("detalle: 404 si no existe, 400 si el id no es válido", async () => {
    expect((await get("GERENTE", "/api/pedidos/999999")).status).toBe(404);
    expect((await get("GERENTE", "/api/pedidos/abc")).status).toBe(400);
    expect((await post("GERENTE", "/api/pedidos/999999/aprobar")).status).toBe(404);
  });
});
