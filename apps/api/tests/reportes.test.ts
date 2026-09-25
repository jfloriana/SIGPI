import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/db.ts";
import { campoCsv } from "../src/modules/reportes/service.ts";
import { sembrarBase } from "../prisma/seed.ts";
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
const id: Record<string, number> = {};
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
const haceDias = (n: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date(Date.now() - n * 86_400_000));

beforeEach(async () => {
  await sembrarBase();
  tokens = Object.fromEntries(
    await Promise.all((Object.keys(EMAIL) as Quien[]).map(async (q) => [q, await tokenRapido(EMAIL[q])])),
  ) as Record<Quien, string>;
  clienteId = (await prisma.cliente.findFirstOrThrow({ where: { activo: true }, orderBy: { id: "asc" } })).id;
  for (const p of await prisma.producto.findMany()) id[p.codigo] = p.id;
});

const auth = (q: Quien) => ({ Authorization: `Bearer ${tokens[q]}` });
const get = (q: Quien, url: string) => request(app).get(url).set(auth(q));
const post = (q: Quien, url: string, body: object = {}) => request(app).post(url).set(auth(q)).send(body);

async function pedido(quien: Quien, lineas: [string, number][], condicionPago = "CONTADO", cliente = clienteId) {
  const res = await post(quien, "/api/pedidos", {
    clienteId: cliente,
    condicionPago,
    lineas: lineas.map(([codigo, cantidad]) => ({ productoId: id[codigo], cantidad })),
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as { id: number; codigo: string };
}
const despachar = async (p: { id: number }) => expect((await post("ALMACENERO", `/api/pedidos/${p.id}/despachar`)).status).toBe(200);

/**
 * Escenario:
 *  P1 vendedor1 ACE-001×10 = 99.00  → DESPACHADO
 *  P2 vendedor1 LAC-001×20 = 82.00  → ENTREGADO
 *  P3 vendedor2 ARR-001×2  = 370.00 → DESPACHADO
 *  P4 vendedor1 ACE-001×1  = 9.90   → REGISTRADO (crédito: no es venta)
 *  P5 vendedor2 ACE-001×5  = 49.50  → APROBADO   (no es venta)
 */
async function escenario() {
  const p1 = await pedido("VENDEDOR", [["ACE-001", 10]]);
  const p2 = await pedido("VENDEDOR", [["LAC-001", 20]]);
  const p3 = await pedido("VENDEDOR2", [["ARR-001", 2]]);
  const p4 = await pedido("VENDEDOR", [["ACE-001", 1]], "CREDITO");
  const p5 = await pedido("VENDEDOR2", [["ACE-001", 5]]);
  await despachar(p1);
  await despachar(p2);
  await despachar(p3);
  expect((await post("ALMACENERO", `/api/pedidos/${p2.id}/entregar`)).status).toBe(200);
  return { p1, p2, p3, p4, p5 };
}

// ---------------------------------------------------------------------------------------------

describe("Tablero (GET /reportes/tablero)", () => {
  it("GERENTE: solo DESPACHADO y ENTREGADO cuentan como venta; ticket = total / número", async () => {
    await escenario();
    const res = await get("GERENTE", "/api/reportes/tablero");
    expect(res.status).toBe(200);
    const t = res.body;
    expect(t.alcance).toBe("TOTAL");
    expect(t.periodo).toEqual({ desde: haceDias(29), hasta: hoy() });
    expect(t.ventasTotales).toBe("551.00");
    expect(t.numPedidos).toBe(3);
    expect(t.ticketPromedio).toBe("183.67"); // 551 / 3 = 183.666…
    expect(t.pedidosPorEstado).toEqual([
      { estado: "REGISTRADO", cantidad: 1 },
      { estado: "APROBADO", cantidad: 1 },
      { estado: "DESPACHADO", cantidad: 2 },
      { estado: "ENTREGADO", cantidad: 1 },
      { estado: "ANULADO", cantidad: 0 },
    ]);
    expect(t.top10Productos).toEqual([
      { productoId: id["ARR-001"], codigo: "ARR-001", nombre: "Arroz extra superior saco 50 kg", cantidad: 2, total: "370.00" },
      { productoId: id["ACE-001"], codigo: "ACE-001", nombre: "Aceite vegetal botella 1 L", cantidad: 10, total: "99.00" },
      { productoId: id["LAC-001"], codigo: "LAC-001", nombre: "Leche evaporada entera lata 400 g", cantidad: 20, total: "82.00" },
    ]);
    expect(t.ventasPorVendedor).toEqual([
      { vendedorId: expect.any(Number), nombre: "Ana Villanueva Soto", total: "370.00", pedidos: 1 },
      { vendedorId: expect.any(Number), nombre: "Luis Paredes Castillo", total: "181.00", pedidos: 2 },
    ]);
    expect(t.ventasPorZona).toHaveLength(6);
    expect(t.ventasPorZona[0]).toEqual({ zona: "Centro", total: "551.00", pedidos: 3 });
    expect(t.ventasPorZona.slice(1).every((z: { total: string; pedidos: number }) => z.total === "0.00" && z.pedidos === 0)).toBe(true);
    expect(t.productosEnAlerta).toHaveLength(7);
    expect(t.productosEnAlerta[0]).toEqual({ id: id["ARR-005"], codigo: "ARR-005", nombre: "Frejol canario bolsa 1 kg", stock: 18, stockMinimo: 40, cantidadSugerida: 62 });
  });

  it("ventasPorDia cubre todos los días del período (con ceros) y usa la fecha de despacho", async () => {
    const { p3 } = await escenario();
    // P3 se despachó hace 5 días (hora de Lima, 10:00).
    await prisma.pedido.update({ where: { id: p3.id }, data: { fechaDespacho: new Date(`${haceDias(5)}T10:00:00-05:00`) } });

    const t = (await get("ADMIN", "/api/reportes/tablero")).body;
    expect(t.ventasPorDia).toHaveLength(30);
    expect(t.ventasPorDia[0].fecha).toBe(haceDias(29));
    expect(t.ventasPorDia[29]).toEqual({ fecha: hoy(), total: "181.00", pedidos: 2 });
    expect(t.ventasPorDia.find((d: { fecha: string }) => d.fecha === haceDias(5))).toEqual({ fecha: haceDias(5), total: "370.00", pedidos: 1 });
    const conVentas = t.ventasPorDia.filter((d: { pedidos: number }) => d.pedidos > 0);
    expect(conVentas).toHaveLength(2);
    expect(t.ventasPorDia.filter((d: { total: string }) => d.total === "0.00")).toHaveLength(28);

    const soloHoy = (await get("GERENTE", `/api/reportes/tablero?desde=${hoy()}&hasta=${hoy()}`)).body;
    expect(soloHoy).toMatchObject({ periodo: { desde: hoy(), hasta: hoy() }, ventasTotales: "181.00", numPedidos: 2 });
    expect(soloHoy.ventasPorDia).toHaveLength(1);
  });

  it("sin ventas: montos en 0.00 y ticket 0.00", async () => {
    const t = (await get("GERENTE", "/api/reportes/tablero")).body;
    expect(t).toMatchObject({ ventasTotales: "0.00", numPedidos: 0, ticketPromedio: "0.00", top10Productos: [], ventasPorVendedor: [] });
  });

  it("VENDEDOR: alcance PROPIO, métricas solo de sus pedidos y sin alertas", async () => {
    await escenario();
    const t = (await get("VENDEDOR", "/api/reportes/tablero")).body;
    expect(t.alcance).toBe("PROPIO");
    expect(t).toMatchObject({ ventasTotales: "181.00", numPedidos: 2, ticketPromedio: "90.50", productosEnAlerta: [] });
    expect(t.pedidosPorEstado).toEqual([
      { estado: "REGISTRADO", cantidad: 1 },
      { estado: "APROBADO", cantidad: 0 },
      { estado: "DESPACHADO", cantidad: 1 },
      { estado: "ENTREGADO", cantidad: 1 },
      { estado: "ANULADO", cantidad: 0 },
    ]);
    expect(t.ventasPorVendedor).toEqual([{ vendedorId: expect.any(Number), nombre: "Luis Paredes Castillo", total: "181.00", pedidos: 2 }]);
    expect(t.top10Productos.map((p: { codigo: string }) => p.codigo)).toEqual(["ACE-001", "LAC-001"]);

    // Un vendedor sin ventas se ve a sí mismo con cero.
    await prisma.pedido.deleteMany({ where: { vendedor: { email: EMAIL.VENDEDOR2 } } });
    const v2 = (await get("VENDEDOR2", "/api/reportes/tablero")).body;
    expect(v2.ventasPorVendedor).toEqual([{ vendedorId: expect.any(Number), nombre: "Ana Villanueva Soto", total: "0.00", pedidos: 0 }]);
  });

  it("ALMACENERO: alcance STOCK, sin métricas de ventas y con todas las alertas", async () => {
    await escenario();
    const t = (await get("ALMACENERO", "/api/reportes/tablero")).body;
    expect(t).toMatchObject({
      alcance: "STOCK",
      ventasTotales: null,
      numPedidos: null,
      ticketPromedio: null,
      pedidosPorEstado: [],
      ventasPorDia: [],
      top10Productos: [],
      ventasPorVendedor: [],
      ventasPorZona: [],
    });
    expect(t.productosEnAlerta).toHaveLength(7);
  });

  it("valida el período", async () => {
    expect((await get("GERENTE", "/api/reportes/tablero?desde=2026-02-01&hasta=2026-01-01")).status).toBe(400);
    expect((await get("GERENTE", "/api/reportes/tablero?desde=24-09-2026")).status).toBe(400);
    const largo = await get("GERENTE", "/api/reportes/tablero?desde=2024-01-01&hasta=2026-01-01");
    expect(largo.status).toBe(400);
    expect(largo.body.error.campos).toHaveProperty("desde");
    const soloHasta = (await get("GERENTE", "/api/reportes/tablero?hasta=2026-03-31")).body;
    expect(soloHasta.periodo).toEqual({ desde: "2026-03-02", hasta: "2026-03-31" });
    expect((await request(app).get("/api/reportes/tablero")).status).toBe(401);
  });
});

// ---------------------------------------------------------------------------------------------

/** Descarga el CSV como bytes para comprobar el BOM sin que el cliente HTTP lo altere. */
async function csv(quien: Quien, query = "") {
  const res = await request(app)
    .get(`/api/reportes/ventas.csv${query}`)
    .set(auth(quien))
    .buffer(true)
    .parse((r, cb) => {
      const partes: Buffer[] = [];
      r.on("data", (c: Buffer) => partes.push(c));
      r.on("end", () => cb(null, Buffer.concat(partes)));
    });
  return { res, bytes: res.body as Buffer };
}

describe("Exportación CSV (GET /reportes/ventas.csv)", () => {
  it("tiene BOM UTF-8, separador ;, cabecera fija y una fila por venta", async () => {
    const { p1, p2, p3 } = await escenario();
    const { res, bytes } = await csv("GERENTE");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^text\/csv; charset=utf-8/);
    expect(res.headers["content-disposition"]).toBe(`attachment; filename="ventas_${haceDias(29)}_${hoy()}.csv"`);
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);

    const lineas = bytes.subarray(3).toString("utf8").split("\r\n");
    expect(lineas[0]).toBe("Código;Fecha despacho;Cliente;Documento;Zona;Vendedor;Condición;Estado;Total");
    expect(lineas.at(-1)).toBe(""); // termina en CRLF
    const filas = lineas.slice(1, -1);
    expect(filas.map((f) => f.split(";")[0])).toEqual([p1.codigo, p2.codigo, p3.codigo]);

    const cliente = await prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } });
    const campos = filas[1].split(";");
    expect(campos[1]).toMatch(new RegExp(`^${hoy()} \\d{2}:\\d{2}$`));
    expect(campos.slice(2)).toEqual([
      cliente.razonSocial,
      `${cliente.tipoDoc} ${cliente.numDoc}`,
      "Centro",
      "Luis Paredes Castillo",
      "CONTADO",
      "ENTREGADO",
      "82.00",
    ]);
  });

  it("escapa comillas y separadores y neutraliza fórmulas", async () => {
    const raro = await prisma.cliente.create({
      data: { tipoDoc: "DNI", numDoc: "71112223", razonSocial: '=Bodega "La; Unión"', direccion: "Jr. Pizarro 100", zona: "Centro" },
    });
    const p = await pedido("VENDEDOR", [["ACE-001", 1]], "CONTADO", raro.id);
    await despachar(p);
    const texto = (await csv("ADMIN")).bytes.toString("utf8");
    expect(texto).toContain(`;"'=Bodega ""La; Unión""";DNI 71112223;`);

    expect(campoCsv("normal")).toBe("normal");
    expect(campoCsv('a"b')).toBe('"a""b"');
    expect(campoCsv("a;b")).toBe('"a;b"');
    expect(campoCsv("línea\nnueva")).toBe('"línea\nnueva"');
    expect(campoCsv("+51 944")).toBe("'+51 944");
    expect(campoCsv("-5.00", false)).toBe("-5.00");
  });

  it("el VENDEDOR descarga solo lo suyo; el ALMACENERO no tiene acceso", async () => {
    const { p3 } = await escenario();
    const propio = (await csv("VENDEDOR")).bytes.toString("utf8");
    expect(propio.split("\r\n").slice(1, -1)).toHaveLength(2);
    expect(propio).not.toContain(p3.codigo);
    expect(propio).not.toContain("Ana Villanueva Soto");
    expect((await get("ALMACENERO", "/api/reportes/ventas.csv")).status).toBe(403);
  });

  it("respeta el período y el nombre del archivo", async () => {
    await escenario();
    const { res, bytes } = await csv("GERENTE", "?desde=2026-01-01&hasta=2026-01-31");
    expect(res.headers["content-disposition"]).toBe('attachment; filename="ventas_2026-01-01_2026-01-31.csv"');
    expect(bytes.subarray(3).toString("utf8").split("\r\n").slice(1, -1)).toHaveLength(0);
  });
});
