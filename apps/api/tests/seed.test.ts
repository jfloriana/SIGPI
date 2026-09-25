// Valida el seed COMPLETO (con historial) sobre prisma/test.db.
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db.ts";
import { LIMITE_APROBACION_AUTOMATICA } from "../src/modules/pedidos/service.ts";
import { sembrar } from "../prisma/seed.ts";
import { app, tokenRapido, verificarKardex } from "./helpers.ts";

const AHORA = new Date();
const DIA = 86_400_000;
const OFFSET = 5 * 3_600_000;
const diaLima = (d: Date) => new Date(d.getTime() - OFFSET).toISOString().slice(0, 10);
const minutoLima = (d: Date) => {
  const l = new Date(d.getTime() - OFFSET);
  return l.getUTCHours() * 60 + l.getUTCMinutes();
};
const diaSemana = (dia: string) => new Date(`${dia}T12:00:00Z`).getUTCDay();

let msSembrar = 0;

/** Resumen independiente de los ids (que cambian entre cargas por el autoincremento). */
async function resumen() {
  const pedidos = await prisma.pedido.findMany({
    include: { detalles: { include: { producto: { select: { codigo: true } } }, orderBy: { id: "asc" } } },
    orderBy: { fecha: "asc" },
  });
  return pedidos.map((p) => [
    p.fecha.toISOString(),
    p.estado,
    p.condicionPago,
    p.total.toFixed(2),
    p.detalles.map((d) => `${d.producto.codigo}×${d.cantidad}`).join(","),
  ]);
}

let primeraCarga: Awaited<ReturnType<typeof resumen>>;

beforeAll(async () => {
  const inicio = Date.now();
  await sembrar({ ahora: AHORA });
  msSembrar = Date.now() - inicio;
  console.log(`sembrar() completo en test.db: ${msSembrar} ms`);
  primeraCarga = await resumen();
}, 120_000);

describe("Seed completo: volumen y fechas", () => {
  it("es rápido", () => {
    expect(msSembrar).toBeLessThan(15_000);
  });

  it("tiene ~300 pedidos de los últimos 90 días, registrados de lunes a sábado entre 8:00 y 19:00", async () => {
    const pedidos = await prisma.pedido.findMany();
    expect(pedidos.length).toBeGreaterThanOrEqual(270);
    expect(pedidos.length).toBeLessThanOrEqual(330);
    for (const p of pedidos) {
      expect(p.fecha.getTime()).toBeLessThanOrEqual(AHORA.getTime());
      expect(p.fecha.getTime()).toBeGreaterThan(AHORA.getTime() - 92 * DIA);
      expect(diaSemana(diaLima(p.fecha))).not.toBe(0);
      expect(minutoLima(p.fecha)).toBeGreaterThanOrEqual(8 * 60);
      expect(minutoLima(p.fecha)).toBeLessThan(19 * 60);
    }
    // Ambos vendedores y muchos clientes (solo activos).
    expect(new Set(pedidos.map((p) => p.vendedorId)).size).toBe(2);
    expect(new Set(pedidos.map((p) => p.clienteId)).size).toBeGreaterThan(40);
    const inactivos = await prisma.cliente.findMany({ where: { activo: false } });
    expect(pedidos.some((p) => inactivos.some((c) => c.id === p.clienteId))).toBe(false);
    // Mezcla de condiciones de pago.
    const credito = pedidos.filter((p) => p.condicionPago === "CREDITO").length;
    expect(credito / pedidos.length).toBeGreaterThan(0.15);
    expect(credito / pedidos.length).toBeLessThan(0.5);
  });

  it("estados variados y coherentes con la antigüedad; pendientes recientes para la demostración", async () => {
    const pedidos = await prisma.pedido.findMany();
    const cuenta = (e: string) => pedidos.filter((p) => p.estado === e).length;
    expect(cuenta("ENTREGADO") / pedidos.length).toBeGreaterThan(0.75);
    expect(cuenta("ANULADO")).toBeGreaterThan(5);
    const recientes = (e: string) => pedidos.filter((p) => p.estado === e && p.fecha.getTime() > AHORA.getTime() - 7 * DIA).length;
    expect(recientes("REGISTRADO")).toBeGreaterThanOrEqual(1);
    expect(recientes("APROBADO")).toBeGreaterThanOrEqual(1);
    expect(recientes("DESPACHADO")).toBeGreaterThanOrEqual(1);
    // Los pendientes son solo recientes; los antiguos están cerrados (ENTREGADO o ANULADO).
    for (const p of pedidos.filter((x) => x.fecha.getTime() < AHORA.getTime() - 10 * DIA)) {
      expect(["ENTREGADO", "ANULADO"]).toContain(p.estado);
    }
    for (const p of pedidos.filter((x) => x.estado === "ANULADO")) expect(p.motivoAnulacion?.length).toBeGreaterThanOrEqual(10);
  });

  it("fechas de aprobación, despacho y entrega posteriores al registro y consistentes con el estado", async () => {
    for (const p of await prisma.pedido.findMany()) {
      const t = (d: Date | null) => d?.getTime() ?? null;
      if (p.fechaAprobacion) expect(t(p.fechaAprobacion)!).toBeGreaterThanOrEqual(t(p.fecha)!);
      if (p.fechaDespacho) expect(t(p.fechaDespacho)!).toBeGreaterThan(t(p.fechaAprobacion)!);
      if (p.fechaEntrega) expect(t(p.fechaEntrega)!).toBeGreaterThan(t(p.fechaDespacho)!);
      for (const f of [p.fechaAprobacion, p.fechaDespacho, p.fechaEntrega]) if (f) expect(f.getTime()).toBeLessThanOrEqual(AHORA.getTime());
      const despachado = p.estado === "DESPACHADO" || p.estado === "ENTREGADO";
      expect(p.fechaDespacho !== null).toBe(despachado);
      expect(p.despachadoPorId !== null).toBe(despachado);
      expect(p.fechaEntrega !== null).toBe(p.estado === "ENTREGADO");
      if (p.estado === "REGISTRADO") expect(p.fechaAprobacion).toBeNull();
      if (["APROBADO", "DESPACHADO", "ENTREGADO"].includes(p.estado)) expect(p.fechaAprobacion).not.toBeNull();
    }
  });
});

describe("Seed completo: reglas de negocio", () => {
  it("el total de cada pedido es la suma de sus subtotales con el precio del producto (regla 4)", async () => {
    const pedidos = await prisma.pedido.findMany({ include: { detalles: { include: { producto: true } } } });
    for (const p of pedidos) {
      expect(p.detalles.length).toBeGreaterThanOrEqual(1);
      expect(p.detalles.length).toBeLessThanOrEqual(8);
      expect(new Set(p.detalles.map((d) => d.productoId)).size).toBe(p.detalles.length); // regla 3
      let suma = 0;
      for (const d of p.detalles) {
        expect(d.cantidad).toBeGreaterThan(0);
        expect(d.precioUnit.toFixed(2)).toBe(d.producto.precio.toFixed(2));
        expect(d.subtotal.toFixed(2)).toBe(d.precioUnit.mul(d.cantidad).toFixed(2));
        suma += Math.round(Number(d.subtotal) * 100);
      }
      expect(p.total.toFixed(2)).toBe((suma / 100).toFixed(2));
    }
  });

  it("aprobación automática exactamente cuando corresponde (regla 7)", async () => {
    for (const p of await prisma.pedido.findMany()) {
      const auto = p.condicionPago === "CONTADO" && p.total.lte(LIMITE_APROBACION_AUTOMATICA);
      if (auto) {
        // Nunca queda REGISTRADO y la aprobación es del sistema, en el mismo instante del registro.
        expect(p.estado).not.toBe("REGISTRADO");
        if (p.fechaAprobacion) {
          expect(p.aprobadoPorId).toBeNull();
          expect(p.fechaAprobacion.getTime()).toBe(p.fecha.getTime());
        }
      } else if (p.fechaAprobacion) {
        expect(p.aprobadoPorId).not.toBeNull();
      }
    }
    const gerente = await prisma.usuario.findUniqueOrThrow({ where: { email: "gerente@distrinorte.pe" } });
    const manuales = await prisma.pedido.findMany({ where: { aprobadoPorId: { not: null } } });
    expect(manuales.length).toBeGreaterThan(20);
    expect(manuales.every((p) => p.aprobadoPorId === gerente.id && p.vendedorId !== gerente.id)).toBe(true); // regla 11
  });

  it("cada producto cuadra con sus movimientos, paso a paso, sin stock negativo", async () => {
    await verificarKardex();
    const movs = await prisma.movInventario.findMany({ orderBy: [{ fecha: "asc" }, { id: "asc" }] });
    expect(movs.every((m) => m.stockResultante >= 0 && m.cantidad > 0)).toBe(true);
    const saldo = new Map<number, number>();
    for (const m of movs) {
      const nuevo = (saldo.get(m.productoId) ?? 0) + (m.tipo === "ENTRADA" || m.tipo === "AJUSTE_POSITIVO" ? m.cantidad : -m.cantidad);
      expect(m.stockResultante, `${m.productoId} ${m.motivo}`).toBe(nuevo);
      saldo.set(m.productoId, nuevo);
    }
    // El inventario inicial es anterior a todo lo demás.
    const iniciales = movs.filter((m) => m.motivo === "Inventario inicial");
    expect(iniciales).toHaveLength(60);
    const primerPedido = await prisma.pedido.findFirstOrThrow({ orderBy: { fecha: "asc" } });
    expect(iniciales.every((m) => m.fecha < primerPedido.fecha)).toBe(true);
  });

  it("al registrar cada pedido había stock suficiente (regla 5)", async () => {
    const movs = await prisma.movInventario.findMany({ orderBy: [{ fecha: "asc" }, { id: "asc" }] });
    const pedidos = await prisma.pedido.findMany({ include: { detalles: true } });
    const stockEn = (productoId: number, t: Date) => {
      let s = 0;
      for (const m of movs) {
        if (m.fecha >= t) break;
        if (m.productoId === productoId) s = m.stockResultante;
      }
      return s;
    };
    for (const p of pedidos) for (const d of p.detalles) expect(stockEn(d.productoId, p.fecha), p.codigo).toBeGreaterThanOrEqual(d.cantidad);
  });

  it("cada despacho tiene una SALIDA por línea, con el código del pedido y la fecha de despacho (regla 8)", async () => {
    const pedidos = await prisma.pedido.findMany({ include: { detalles: true } });
    const salidas = await prisma.movInventario.findMany({ where: { tipo: "SALIDA" } });
    const almacenero = await prisma.usuario.findUniqueOrThrow({ where: { email: "almacen@distrinorte.pe" } });
    for (const p of pedidos) {
      const propias = salidas.filter((m) => m.referencia === p.codigo);
      if (p.fechaDespacho) {
        expect(propias.map((m) => `${m.productoId}×${m.cantidad}`).sort()).toEqual(p.detalles.map((d) => `${d.productoId}×${d.cantidad}`).sort());
        expect(propias.every((m) => m.fecha.getTime() === p.fechaDespacho!.getTime() && m.motivo === `Despacho ${p.codigo}`)).toBe(true);
        expect(propias.every((m) => m.usuarioId === almacenero.id)).toBe(true);
      } else {
        expect(propias).toHaveLength(0);
      }
    }
    expect(salidas.length).toBe(pedidos.filter((p) => p.fechaDespacho).reduce((a, p) => a + p.detalles.length, 0));
  });

  it("siguen 6–8 productos en alerta, entre ellos ACE-003 con 12/20 (dato de la landing)", async () => {
    const alertas = await prisma.producto.findMany({ where: { activo: true, stock: { lte: prisma.producto.fields.stockMinimo } } });
    expect(alertas.length).toBeGreaterThanOrEqual(6);
    expect(alertas.length).toBeLessThanOrEqual(8);
    const ace = await prisma.producto.findUniqueOrThrow({ where: { codigo: "ACE-003" } });
    expect(ace).toMatchObject({ nombre: "Aceite vegetal bidón 5 L", stock: 12, stockMinimo: 20 });
    expect(alertas.map((p) => p.codigo)).toContain("ACE-003");
  });

  it("los pedidos pendientes se pueden aprobar y despachar con el stock actual", async () => {
    const pendientes = await prisma.pedido.findMany({ where: { estado: { in: ["REGISTRADO", "APROBADO"] } }, include: { detalles: true } });
    const comprometido = new Map<number, number>();
    for (const p of pendientes) for (const d of p.detalles) comprometido.set(d.productoId, (comprometido.get(d.productoId) ?? 0) + d.cantidad);
    for (const [productoId, cantidad] of comprometido) {
      const prod = await prisma.producto.findUniqueOrThrow({ where: { id: productoId } });
      expect(cantidad, prod.codigo).toBeLessThanOrEqual(prod.stock);
    }
  });
});

describe("Seed completo: órdenes de compra", () => {
  it("reposición histórica recibida, una APROBADA por recibir y una PENDIENTE", async () => {
    const ordenes = await prisma.ordenCompra.findMany({ include: { detalles: true } });
    const cuenta = (e: string) => ordenes.filter((o) => o.estado === e).length;
    expect(ordenes.length).toBeGreaterThanOrEqual(6);
    expect(ordenes.length).toBeLessThanOrEqual(12);
    expect(cuenta("RECIBIDA")).toBeGreaterThanOrEqual(4);
    expect(cuenta("APROBADA")).toBe(1);
    expect(cuenta("PENDIENTE")).toBe(1);

    const entradas = await prisma.movInventario.findMany({ where: { tipo: "ENTRADA", referencia: { not: null } } });
    for (const o of ordenes) {
      const propias = entradas.filter((m) => m.referencia === o.codigo);
      if (o.estado === "RECIBIDA") {
        expect(propias.map((m) => `${m.productoId}×${m.cantidad}`).sort()).toEqual(o.detalles.map((d) => `${d.productoId}×${d.cantidad}`).sort());
        expect(propias.every((m) => m.motivo === `Recepción ${o.codigo}`)).toBe(true);
      } else {
        expect(propias).toHaveLength(0);
      }
      for (const d of o.detalles) expect(d.costoUnit.gt(0)).toBe(true);
    }
    // La orden en curso no incluye ACE-003 (la landing muestra su alerta).
    const ace = await prisma.producto.findUniqueOrThrow({ where: { codigo: "ACE-003" } });
    const enCurso = ordenes.filter((o) => o.estado !== "RECIBIDA");
    expect(enCurso.flatMap((o) => o.detalles).some((d) => d.productoId === ace.id)).toBe(false);
  });
});

describe("Seed completo: bitácora", () => {
  it("cada pedido tiene su CREAR y la secuencia de estados coincide con su estado final", async () => {
    const pedidos = await prisma.pedido.findMany();
    const registros = await prisma.bitacora.findMany({ where: { entidad: "Pedido" }, orderBy: { id: "asc" } });
    const porPedido = new Map<string, typeof registros>();
    for (const r of registros) porPedido.set(r.entidadId!, [...(porPedido.get(r.entidadId!) ?? []), r]);

    for (const p of pedidos) {
      const propios = porPedido.get(String(p.id)) ?? [];
      expect(propios.filter((r) => r.accion === "CREAR"), p.codigo).toHaveLength(1);
      expect(propios[0].accion).toBe("CREAR");
      expect(propios[0].usuarioId).toBe(p.vendedorId);
      expect(propios[0].fecha.getTime()).toBe(p.fecha.getTime());
      const crear = JSON.parse(propios[0].detalle);
      expect(crear.despues).toMatchObject({ codigo: p.codigo, estado: "REGISTRADO", total: p.total.toFixed(2), condicionPago: p.condicionPago });

      // Cadena de estados: cada registro parte del estado en que dejó el anterior.
      let estado = "REGISTRADO";
      for (const r of propios.slice(1)) {
        const d = JSON.parse(r.detalle);
        expect(d.antes.estado, p.codigo).toBe(estado);
        estado = d.despues.estado;
        expect(r.accion).toBe(estado === "ANULADO" ? "ANULAR" : "CAMBIO_ESTADO");
        expect(r.fecha.getTime()).toBeGreaterThanOrEqual(p.fecha.getTime());
      }
      expect(estado).toBe(p.estado);
    }
  });

  it("los registros de despacho y recepción coinciden con los movimientos; LOGIN_OK moderado", async () => {
    const despachos = await prisma.bitacora.findMany({ where: { entidad: "Pedido", accion: "CAMBIO_ESTADO" } });
    const movs = await prisma.movInventario.findMany({ where: { tipo: "SALIDA" } });
    for (const r of despachos) {
      const d = JSON.parse(r.detalle);
      if (d.despues.estado !== "DESPACHADO") continue;
      for (const m of d.despues.movimientos) {
        expect(movs.some((x) => x.productoId === m.productoId && x.stockResultante === m.stockResultante && x.cantidad === m.cantidad)).toBe(true);
      }
    }
    expect(await prisma.bitacora.count({ where: { accion: "RECEPCION" } })).toBe(await prisma.ordenCompra.count({ where: { estado: "RECIBIDA" } }));

    const logins = await prisma.bitacora.findMany({ where: { accion: "LOGIN_OK" } });
    const claves = logins.map((l) => `${l.usuarioId}|${diaLima(l.fecha)}`);
    expect(new Set(claves).size).toBe(claves.length); // a lo más uno por usuario y día
    expect(logins.length).toBeLessThan(400);
    expect(logins.every((l) => l.fecha <= AHORA)).toBe(true);
    // Sin campos sensibles.
    expect(await prisma.bitacora.count({ where: { detalle: { contains: "hashClave" } } })).toBe(0);
  });
});

describe("Seed completo: tablero", () => {
  it("los últimos 30 días tienen ventas en la mayoría de los días hábiles", async () => {
    const token = await tokenRapido("gerente@distrinorte.pe");
    const t = (await request(app).get("/api/reportes/tablero").set("Authorization", `Bearer ${token}`)).body;
    expect(Number(t.ventasTotales)).toBeGreaterThan(0);
    const hoy = diaLima(AHORA);
    const habiles = t.ventasPorDia.filter((d: { fecha: string }) => d.fecha !== hoy && diaSemana(d.fecha) !== 0);
    const conVentas = habiles.filter((d: { pedidos: number }) => d.pedidos > 0);
    expect(conVentas.length / habiles.length).toBeGreaterThanOrEqual(0.7);
    expect(t.productosEnAlerta.length).toBeGreaterThanOrEqual(6);
    expect(t.top10Productos).toHaveLength(10);
  });
});

describe("Seed completo: idempotencia y determinismo", () => {
  it("volver a sembrar con la misma fecha produce exactamente los mismos datos", async () => {
    await sembrar({ ahora: AHORA });
    expect(await resumen()).toEqual(primeraCarga);
    await verificarKardex();
    expect(await prisma.usuario.count()).toBe(5);
    expect(await prisma.cliente.count()).toBe(80);
    expect(await prisma.producto.count()).toBe(60);
  }, 60_000);
});
