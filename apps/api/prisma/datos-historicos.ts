// Historial de demostración: ~300 pedidos y ~9 órdenes de compra en los últimos 90 días.
//
// Se SIMULA en memoria con la misma lógica de negocio que los servicios (totales con `calcularLineas`,
// regla 7 con `seApruebaAutomaticamente`, costo sugerido con `costoSugerido`) y con un reloj simulado.
// El resultado es determinista para una misma fecha de ejecución (PRNG con semilla fija).
//
// Stock: se fija el stock FINAL de cada producto (el del catálogo, para conservar las mismas alertas)
// y se deduce el inventario inicial = final + despachado − recibido. Así, la trayectoria de stock es
//   stock antes del evento i = final + Σ salidas desde i − Σ entradas desde i,
// y se verifican las reglas en cada instante: al registrar, cantidad ≤ stock (regla 5); al despachar,
// el stock nunca queda negativo (regla 8). Las recepciones se dimensionan para no romper ninguna.
import type { Prisma } from "../src/generated/prisma/client.ts";
import { costoSugerido } from "../src/modules/compras/service.ts";
import { calcularLineas, seApruebaAutomaticamente, type LineaCalculada } from "../src/modules/pedidos/service.ts";
import { mulberry32 } from "./datos-maestros.ts";

// ---------------------------------------------------------------------------------------------
// Tipos de entrada y salida

export interface ProductoSim {
  id: number;
  codigo: string;
  nombre: string;
  unidad: string;
  precio: Prisma.Decimal;
  /** Stock final deseado (el del catálogo). */
  stock: number;
  stockMinimo: number;
  categoria: string;
}
export interface ClienteSim {
  id: number;
  razonSocial: string;
}
export interface ProveedorSim {
  id: number;
  razonSocial: string;
  categorias: string[];
}
export interface Actores {
  vendedores: number[];
  gerente: number;
  almacenero: number;
  admin: number;
}

export type EstadoPedido = "REGISTRADO" | "APROBADO" | "DESPACHADO" | "ENTREGADO" | "ANULADO";
export interface EventoPedido {
  tipo: "CREAR" | "APROBACION_AUTO" | "APROBACION" | "DESPACHO" | "ENTREGA" | "ANULACION";
  fecha: Date;
  usuarioId: number;
  estadoPrevio: string;
  /** Solo en ANULACION. */
  motivo?: string;
}

export interface PedidoSim {
  indice: number;
  cliente: ClienteSim;
  vendedorId: number;
  condicionPago: "CONTADO" | "CREDITO";
  fecha: Date;
  estado: EstadoPedido;
  lineas: LineaCalculada[];
  total: Prisma.Decimal;
  aprobadoPorId: number | null;
  fechaAprobacion: Date | null;
  despachadoPorId: number | null;
  fechaDespacho: Date | null;
  fechaEntrega: Date | null;
  motivoAnulacion: string | null;
  eventos: EventoPedido[];
}

export interface LineaOrdenSim {
  productoId: number;
  codigo: string;
  cantidad: number;
  costoUnit: string;
}
export interface OrdenSim {
  indice: number;
  proveedor: ProveedorSim;
  fecha: Date;
  estado: "PENDIENTE" | "APROBADA" | "RECIBIDA";
  lineas: LineaOrdenSim[];
  eventos: { tipo: "CREAR" | "APROBACION" | "RECEPCION"; fecha: Date; usuarioId: number; estadoPrevio: string }[];
}

export interface MovimientoSim {
  productoId: number;
  tipo: "ENTRADA" | "SALIDA";
  cantidad: number;
  stockResultante: number;
  fecha: Date;
  origen: { tipo: "PEDIDO" | "ORDEN"; indice: number };
}

export interface Historial {
  pedidos: PedidoSim[];
  ordenes: OrdenSim[];
  /** Movimientos de pedidos y órdenes en orden cronológico (sin el inventario inicial). */
  movimientos: MovimientoSim[];
  /** Inventario inicial por producto (id → cantidad). */
  inicial: Map<number, number>;
  logins: { usuarioId: number; fecha: Date }[];
}

// ---------------------------------------------------------------------------------------------
// Reloj simulado (hora de Lima, UTC−5 fijo; lunes a sábado de 8:00 a 19:00)

const MIN = 60_000;
const OFFSET = 5 * 60 * MIN;
const APERTURA = 8 * 60;
const CIERRE = 19 * 60;

const diaLima = (d: Date) => new Date(d.getTime() - OFFSET).toISOString().slice(0, 10);
const sumarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const diaSemana = (dia: string) => new Date(`${dia}T12:00:00Z`).getUTCDay(); // 0 = domingo
/** Instante del día `dia` a `minuto` minutos desde la medianoche de Lima. */
const enLima = (dia: string, minuto: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + OFFSET + minuto * MIN);

/** Suma minutos de horario laboral (lunes a sábado, 8:00–19:00). */
export function sumarLaborales(desde: Date, minutos: number): Date {
  let t = desde.getTime();
  let resto = minutos;
  for (let guarda = 0; guarda < 400; guarda++) {
    const dia = diaLima(new Date(t));
    const minutoDia = Math.round((t - enLima(dia, 0).getTime()) / MIN);
    if (diaSemana(dia) === 0 || minutoDia >= CIERRE) {
      t = enLima(sumarDias(dia, 1), APERTURA).getTime();
      continue;
    }
    if (minutoDia < APERTURA) {
      t = enLima(dia, APERTURA).getTime();
      continue;
    }
    const disponible = CIERRE - minutoDia;
    if (resto <= disponible) return new Date(t + resto * MIN);
    resto -= disponible;
    t += disponible * MIN;
  }
  throw new Error("sumarLaborales: demasiadas iteraciones");
}

// ---------------------------------------------------------------------------------------------
// Parámetros de la simulación

const PATRON_RECIENTE: EstadoPedido[] = [
  "ENTREGADO",
  "DESPACHADO",
  "ENTREGADO",
  "DESPACHADO",
  "APROBADO",
  "DESPACHADO",
  "REGISTRADO",
  "APROBADO",
  "DESPACHADO",
  "APROBADO",
  "REGISTRADO",
  "APROBADO",
  "REGISTRADO",
  "APROBADO",
];

const MOTIVOS_ANULACION = [
  "Cliente canceló el pedido por teléfono",
  "Cliente pidió cambiar productos; se registrará un nuevo pedido",
  "Dirección de entrega incorrecta",
  "Pedido duplicado por error de digitación",
  "Cliente sin línea de crédito disponible",
  "Cliente cerró temporalmente el local",
];

/** Productos de alta rotación (se venden más a menudo). */
const ALTA_ROTACION = new Set([
  "ARR-001", "ARR-003", "ARR-004", "ACE-001", "ACE-002", "AZU-001", "AZU-003", "LAC-001", "LAC-002",
  "FID-001", "FID-002", "BEB-001", "BEB-003", "LIM-002", "LIM-003", "LIM-004", "CON-001", "CON-003",
]);

/** Fechas (días atrás) de las órdenes de compra recibidas y su proveedor (índice). */
const ORDENES_RECIBIDAS: [diasAtras: number, proveedor: number][] = [
  [80, 0], [71, 1], [62, 2], [53, 0], [44, 1], [35, 0], [26, 1], [17, 2], [9, 0],
];

// ---------------------------------------------------------------------------------------------

export function generarHistorial(p: {
  ahora: Date;
  productos: ProductoSim[];
  clientes: ClienteSim[];
  proveedores: ProveedorSim[];
  actores: Actores;
  dias?: number;
  cantidad?: number;
  semilla?: number;
}): Historial {
  const { ahora, productos, clientes, proveedores, actores } = p;
  const dias = p.dias ?? 90;
  const cantidad = p.cantidad ?? 300;
  const rnd = mulberry32(p.semilla ?? 20260925);
  const entre = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const elegir = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const limite = ahora.getTime() - 2 * MIN;
  const porId = new Map(productos.map((x) => [x.id, x]));
  const enAlertaFinal = new Set(productos.filter((x) => x.stock <= x.stockMinimo).map((x) => x.id));

  /** Evento posterior a `previo`; si caería después de "ahora", se comprime entre `previo` y "ahora". */
  const despues = (previo: Date, minutos: number) => {
    const t = sumarLaborales(previo, minutos);
    if (t.getTime() <= limite) return t;
    return new Date(previo.getTime() + Math.max(MIN, (limite - previo.getTime()) * (0.3 + rnd() * 0.4)));
  };

  // 1) Instantes de registro: lunes a sábado, 8:00–18:30, repartidos para sumar ~`cantidad`.
  const hoy = diaLima(ahora);
  const diasHabiles: string[] = [];
  for (let i = dias; i >= 0; i--) {
    const d = sumarDias(hoy, -i);
    if (diaSemana(d) !== 0) diasHabiles.push(d);
  }
  const pesos = diasHabiles.map((d) => (diaSemana(d) === 6 ? 0.7 : 1) * (0.75 + rnd() * 0.5));
  const sumaPesos = pesos.reduce((a, b) => a + b, 0);
  const instantes: Date[] = [];
  diasHabiles.forEach((d, i) => {
    const n = Math.round((cantidad * pesos[i]) / sumaPesos);
    for (let k = 0; k < n; k++) {
      const t = enLima(d, entre(APERTURA, 18 * 60 + 30));
      if (t.getTime() <= ahora.getTime() - 45 * MIN) instantes.push(t);
    }
  });
  instantes.sort((a, b) => a.getTime() - b.getTime());

  // 2) Estado final: los 14 más recientes siguen un patrón fijo (pendientes para la demo);
  //    los demás, entregados salvo ~7 % anulados.
  const N = instantes.length;
  const estados: EstadoPedido[] = instantes.map((_, i) =>
    i >= N - PATRON_RECIENTE.length ? PATRON_RECIENTE[i - (N - PATRON_RECIENTE.length)] : rnd() < 0.07 ? "ANULADO" : "ENTREGADO",
  );

  // 3) Líneas pedidas (cantidades acordes a la unidad y al precio).
  const pesoProducto = (x: ProductoSim) => (ALTA_ROTACION.has(x.codigo) ? 4 : 1);
  const cantidadPara = (x: ProductoSim) => {
    if (x.unidad === "SACO") return entre(1, 4);
    if (x.unidad === "CAJA") return entre(1, 5);
    if (x.unidad === "PAQ") return entre(2, 10);
    return Number(x.precio) < 3 ? elegir([12, 24, 24, 36, 48]) : elegir([6, 6, 12, 12, 18, 24]);
  };
  const numLineas = () => {
    const r = rnd();
    return r < 0.1 ? 1 : r < 0.28 ? 2 : r < 0.5 ? 3 : r < 0.7 ? 4 : r < 0.83 ? 5 : r < 0.91 ? 6 : r < 0.96 ? 7 : 8;
  };
  const elegirProductos = (k: number, pool: ProductoSim[]) => {
    const elegidos: ProductoSim[] = [];
    const disponibles = [...pool];
    while (elegidos.length < k && disponibles.length) {
      const total = disponibles.reduce((a, x) => a + pesoProducto(x), 0);
      let r = rnd() * total;
      let idx = 0;
      for (; idx < disponibles.length - 1; idx++) {
        r -= pesoProducto(disponibles[idx]);
        if (r <= 0) break;
      }
      elegidos.push(disponibles.splice(idx, 1)[0]);
    }
    return elegidos;
  };
  const sinAlerta = productos.filter((x) => !enAlertaFinal.has(x.id));

  type Borrador = {
    indice: number;
    fecha: Date;
    estado: EstadoPedido;
    cliente: ClienteSim;
    vendedorId: number;
    condicionPago: "CONTADO" | "CREDITO";
    pedido: { productoId: number; cantidad: number }[];
  };
  const borradores: Borrador[] = instantes.map((fecha, indice) => {
    const estado = estados[indice];
    const pendiente = estado === "REGISTRADO" || estado === "APROBADO";
    const pool = pendiente ? sinAlerta : productos;
    const pedido = elegirProductos(numLineas(), pool).map((x) => ({
      productoId: x.id,
      cantidad: pendiente ? Math.max(1, Math.min(cantidadPara(x), Math.floor(x.stock * 0.08))) : cantidadPara(x),
    }));
    // Clientes frecuentes: sesgo hacia el inicio de la lista.
    const cliente = clientes[Math.floor(Math.pow(rnd(), 1.4) * clientes.length)];
    const vendedorId = rnd() < 0.55 ? actores.vendedores[0] : actores.vendedores[1 % actores.vendedores.length];
    const condicionPago = estado === "REGISTRADO" || rnd() < 0.3 ? "CREDITO" : "CONTADO";
    return { indice, fecha, estado, cliente, vendedorId, condicionPago, pedido };
  });

  // 4) Eventos de los pedidos que se despachan (sus líneas quedan fijas).
  const pedidos: PedidoSim[] = [];
  const armar = (b: Borrador): PedidoSim => {
    const { lineas, total } = calcularLineas(b.pedido, porId);
    const auto = seApruebaAutomaticamente(b.condicionPago, total);
    const ps: PedidoSim = {
      indice: b.indice,
      cliente: b.cliente,
      vendedorId: b.vendedorId,
      condicionPago: b.condicionPago,
      fecha: b.fecha,
      estado: b.estado,
      lineas,
      total,
      aprobadoPorId: null,
      fechaAprobacion: null,
      despachadoPorId: null,
      fechaDespacho: null,
      fechaEntrega: null,
      motivoAnulacion: null,
      eventos: [{ tipo: "CREAR", fecha: b.fecha, usuarioId: b.vendedorId, estadoPrevio: "" }],
    };
    let t = b.fecha;
    let estado = "REGISTRADO";
    const aprobar = () => {
      if (auto) {
        ps.eventos.push({ tipo: "APROBACION_AUTO", fecha: t, usuarioId: b.vendedorId, estadoPrevio: estado });
        ps.fechaAprobacion = t;
      } else {
        t = despues(t, entre(30, 300));
        ps.eventos.push({ tipo: "APROBACION", fecha: t, usuarioId: actores.gerente, estadoPrevio: estado });
        ps.aprobadoPorId = actores.gerente;
        ps.fechaAprobacion = t;
      }
      estado = "APROBADO";
    };

    if (b.estado === "ANULADO") {
      // Desde REGISTRADO (solo si requería aprobación manual) o desde APROBADO.
      const desdeRegistrado = !auto && rnd() < 0.5;
      if (!desdeRegistrado) aprobar();
      t = despues(t, entre(30, 420));
      const motivo = elegir(MOTIVOS_ANULACION);
      const quien = desdeRegistrado && rnd() < 0.3 ? b.vendedorId : actores.gerente;
      ps.eventos.push({ tipo: "ANULACION", fecha: t, usuarioId: quien, estadoPrevio: estado, motivo });
      ps.motivoAnulacion = motivo;
      return ps;
    }
    if (b.estado === "REGISTRADO") {
      if (auto) throw new Error("Un pedido REGISTRADO no puede cumplir la aprobación automática");
      return ps;
    }
    aprobar();
    if (b.estado === "APROBADO") return ps;
    t = despues(t, entre(60, 1200));
    ps.eventos.push({ tipo: "DESPACHO", fecha: t, usuarioId: actores.almacenero, estadoPrevio: estado });
    ps.despachadoPorId = actores.almacenero;
    ps.fechaDespacho = t;
    estado = "DESPACHADO";
    if (b.estado === "DESPACHADO") return ps;
    t = despues(t, entre(120, 1560));
    ps.eventos.push({ tipo: "ENTREGA", fecha: t, usuarioId: actores.almacenero, estadoPrevio: estado });
    ps.fechaEntrega = t;
    return ps;
  };

  const seDespacha = (e: EstadoPedido) => e === "DESPACHADO" || e === "ENTREGADO";
  const despachados = borradores.filter((b) => seDespacha(b.estado)).map(armar);

  // Salidas por producto (instante, cantidad), para evaluar la trayectoria de stock.
  type Salida = { t: number; cantidad: number };
  const salidas = new Map<number, Salida[]>();
  for (const ps of despachados) {
    for (const l of ps.lineas) {
      const lista = salidas.get(l.productoId) ?? [];
      lista.push({ t: ps.fechaDespacho!.getTime(), cantidad: l.cantidad });
      salidas.set(l.productoId, lista);
    }
  }
  const salidasDesde = (productoId: number, t: number) =>
    (salidas.get(productoId) ?? []).reduce((a, s) => (s.t >= t ? a + s.cantidad : a), 0);

  // 5) Pedidos que no se despachan: ajustar cantidades para cumplir la regla 5 en su instante y, en los
  //    pendientes, que el stock final alcance para aprobarlos y despacharlos durante la demostración.
  const comprometido = new Map<number, number>();
  for (const b of borradores.filter((x) => !seDespacha(x.estado))) {
    const pendiente = b.estado !== "ANULADO";
    b.pedido = b.pedido
      .map((l) => {
        const x = porId.get(l.productoId)!;
        const enSuMomento = x.stock + salidasDesde(l.productoId, b.fecha.getTime());
        const tope = pendiente ? Math.min(enSuMomento, x.stock - (comprometido.get(l.productoId) ?? 0)) : enSuMomento;
        return { ...l, cantidad: Math.min(l.cantidad, tope) };
      })
      .filter((l) => l.cantidad >= 1);
    if (!b.pedido.length) {
      const reserva = [...sinAlerta].sort((a, c) => c.stock - a.stock)[0];
      b.pedido = [{ productoId: reserva.id, cantidad: 1 }];
    }
    if (pendiente) for (const l of b.pedido) comprometido.set(l.productoId, (comprometido.get(l.productoId) ?? 0) + l.cantidad);
  }

  for (const b of borradores) pedidos.push(seDespacha(b.estado) ? despachados.find((d) => d.indice === b.indice)! : armar(b));

  // 6) Órdenes de compra recibidas: reponen lo que se despachará en las 2 semanas siguientes a la recepción,
  //    limitadas para no violar ninguna regla (holgura de la trayectoria de stock).
  type Restriccion = { t: number; necesita: number };
  const restricciones = new Map<number, Restriccion[]>();
  const agregarRestriccion = (productoId: number, r: Restriccion) => {
    const lista = restricciones.get(productoId) ?? [{ t: -Infinity, necesita: 0 }];
    lista.push(r);
    restricciones.set(productoId, lista);
  };
  for (const ps of pedidos) {
    for (const l of ps.lineas) {
      agregarRestriccion(l.productoId, { t: ps.fecha.getTime(), necesita: l.cantidad }); // regla 5
      if (ps.fechaDespacho) agregarRestriccion(l.productoId, { t: ps.fechaDespacho.getTime(), necesita: l.cantidad }); // regla 8
    }
  }
  const entradas = new Map<number, { t: number; cantidad: number }[]>();
  const entradasDesde = (productoId: number, t: number) =>
    (entradas.get(productoId) ?? []).reduce((a, e) => (e.t >= t ? a + e.cantidad : a), 0);
  /** Stock justo antes del instante t (incluye las salidas en t, que aún no ocurrieron). */
  const stockAntes = (productoId: number, t: number) =>
    porId.get(productoId)!.stock + salidasDesde(productoId, t) - entradasDesde(productoId, t);

  const ordenes: OrdenSim[] = [];
  const planOrdenes = ORDENES_RECIBIDAS.map(([diasAtras, prov]) => {
    let dia = sumarDias(hoy, -diasAtras);
    if (diaSemana(dia) === 0) dia = sumarDias(dia, 1);
    const creada = enLima(dia, entre(9 * 60, 11 * 60));
    const aprobada = despues(creada, entre(60, 240));
    const recibida = despues(aprobada, entre(8 * 60, 16 * 60));
    return { proveedor: proveedores[prov % proveedores.length], creada, aprobada, recibida };
  });
  // Se dimensionan de la más reciente a la más antigua: cada recepción reduce el stock previo a ella.
  const lineasPorOrden = new Map<number, LineaOrdenSim[]>();
  [...planOrdenes.keys()].reverse().forEach((k) => {
    const o = planOrdenes[k];
    const tRec = o.recibida.getTime();
    const candidatos = productos
      .filter((x) => o.proveedor.categorias.includes(x.categoria))
      .map((x) => ({
        x,
        volumen: (salidas.get(x.id) ?? []).reduce((a, s) => (s.t > tRec && s.t <= tRec + 14 * 86_400_000 ? a + s.cantidad : a), 0),
      }))
      .filter((c) => c.volumen > 0)
      .sort((a, c) => c.volumen - a.volumen)
      .slice(0, 5);
    const lineas: LineaOrdenSim[] = [];
    for (const { x, volumen } of candidatos) {
      const paso = x.unidad === "SACO" || x.unidad === "CAJA" ? 5 : 10;
      const deseado = Math.ceil(volumen / paso) * paso;
      const holgura = Math.min(
        ...(restricciones.get(x.id) ?? [{ t: -Infinity, necesita: 0 }])
          .filter((r) => r.t < tRec)
          .map((r) => stockAntes(x.id, r.t === -Infinity ? -8.64e15 : r.t) - r.necesita),
      );
      const q = Math.min(deseado, Number.isFinite(holgura) ? holgura : deseado);
      if (q < 1) continue;
      const lista = entradas.get(x.id) ?? [];
      lista.push({ t: tRec, cantidad: q });
      entradas.set(x.id, lista);
      lineas.push({ productoId: x.id, codigo: x.codigo, cantidad: q, costoUnit: costoSugerido(x.precio).toFixed(2) });
    }
    lineasPorOrden.set(k, lineas);
  });
  planOrdenes.forEach((o, k) => {
    const lineas = lineasPorOrden.get(k)!;
    if (!lineas.length) return;
    ordenes.push({
      indice: ordenes.length,
      proveedor: o.proveedor,
      fecha: o.creada,
      estado: "RECIBIDA",
      lineas,
      eventos: [
        { tipo: "CREAR", fecha: o.creada, usuarioId: actores.gerente, estadoPrevio: "" },
        { tipo: "APROBACION", fecha: o.aprobada, usuarioId: actores.gerente, estadoPrevio: "PENDIENTE" },
        { tipo: "RECEPCION", fecha: o.recibida, usuarioId: actores.almacenero, estadoPrevio: "APROBADA" },
      ],
    });
  });

  // Órdenes en curso para la demostración (no mueven stock): una APROBADA por recibir y una PENDIENTE,
  // con productos en alerta y la cantidad sugerida de la regla 18. ACE-003 queda sin orden (dato de la landing).
  const enCurso: { estado: "APROBADA" | "PENDIENTE"; diasAtras: number; proveedor: number }[] = [
    { estado: "APROBADA", diasAtras: 2, proveedor: 0 },
    { estado: "PENDIENTE", diasAtras: 1, proveedor: 2 },
  ];
  for (const e of enCurso) {
    const proveedor = proveedores[e.proveedor % proveedores.length];
    const lineas = productos
      .filter((x) => enAlertaFinal.has(x.id) && x.codigo !== "ACE-003" && proveedor.categorias.includes(x.categoria))
      .map((x) => ({
        productoId: x.id,
        codigo: x.codigo,
        cantidad: Math.max(x.stockMinimo * 2 - x.stock, 1),
        costoUnit: costoSugerido(x.precio).toFixed(2),
      }));
    if (!lineas.length) continue;
    let dia = sumarDias(hoy, -e.diasAtras);
    if (diaSemana(dia) === 0) dia = sumarDias(dia, -1);
    let creada = enLima(dia, entre(9 * 60, 11 * 60));
    if (creada.getTime() > limite) creada = new Date(limite - 3 * 60 * MIN);
    const eventos: OrdenSim["eventos"] = [{ tipo: "CREAR", fecha: creada, usuarioId: actores.gerente, estadoPrevio: "" }];
    if (e.estado === "APROBADA") {
      eventos.push({ tipo: "APROBACION", fecha: despues(creada, entre(60, 180)), usuarioId: actores.gerente, estadoPrevio: "PENDIENTE" });
    }
    ordenes.push({ indice: ordenes.length, proveedor, fecha: creada, estado: e.estado, lineas, eventos });
  }

  // 7) Inventario inicial y movimientos en orden cronológico, verificando cada regla.
  type Evento = { t: number; orden: number; productoId: number; delta: number; origen: MovimientoSim["origen"] };
  const eventos: Evento[] = [];
  for (const ps of pedidos) {
    if (!ps.fechaDespacho) continue;
    ps.lineas.forEach((l, i) =>
      eventos.push({ t: ps.fechaDespacho!.getTime(), orden: ps.indice * 100 + i, productoId: l.productoId, delta: -l.cantidad, origen: { tipo: "PEDIDO", indice: ps.indice } }),
    );
  }
  for (const o of ordenes) {
    const rec = o.eventos.find((e) => e.tipo === "RECEPCION");
    if (!rec) continue;
    o.lineas.forEach((l, i) =>
      eventos.push({ t: rec.fecha.getTime(), orden: 1e6 + o.indice * 100 + i, productoId: l.productoId, delta: l.cantidad, origen: { tipo: "ORDEN", indice: o.indice } }),
    );
  }
  eventos.sort((a, b) => a.t - b.t || a.orden - b.orden);

  const inicial = new Map<number, number>();
  for (const x of productos) {
    const neto = eventos.filter((e) => e.productoId === x.id).reduce((a, e) => a + e.delta, 0);
    inicial.set(x.id, x.stock - neto);
  }

  const stock = new Map(inicial);
  const movimientos: MovimientoSim[] = eventos.map((e) => {
    const nuevo = stock.get(e.productoId)! + e.delta;
    if (nuevo < 0) throw new Error(`Historial inválido: stock negativo del producto ${e.productoId}`);
    stock.set(e.productoId, nuevo);
    return {
      productoId: e.productoId,
      tipo: e.delta > 0 ? "ENTRADA" : "SALIDA",
      cantidad: Math.abs(e.delta),
      stockResultante: nuevo,
      fecha: new Date(e.t),
      origen: e.origen,
    };
  });
  for (const x of productos) {
    if (stock.get(x.id) !== x.stock) throw new Error(`Historial inválido: stock final de ${x.codigo}`);
    for (const r of restricciones.get(x.id) ?? []) {
      if (r.t !== -Infinity && stockAntes(x.id, r.t) < r.necesita) {
        throw new Error(`Historial inválido: ${x.codigo} sin stock suficiente en ${new Date(r.t).toISOString()}`);
      }
    }
  }

  // 8) Inicios de sesión: uno por usuario y día con actividad, minutos antes de su primera acción.
  const primeraAccion = new Map<string, number>();
  const anotar = (usuarioId: number, fecha: Date) => {
    const clave = `${usuarioId}|${diaLima(fecha)}`;
    primeraAccion.set(clave, Math.min(primeraAccion.get(clave) ?? Infinity, fecha.getTime()));
  };
  for (const ps of pedidos) for (const e of ps.eventos) anotar(e.usuarioId, e.fecha);
  for (const o of ordenes) for (const e of o.eventos) anotar(e.usuarioId, e.fecha);
  for (const d of diasHabiles) if (diaSemana(d) === 1) anotar(actores.admin, enLima(d, entre(8 * 60 + 20, 9 * 60)));
  const logins = [...primeraAccion]
    .map(([clave, t]) => {
      const usuarioId = Number(clave.split("|")[0]);
      const apertura = enLima(clave.split("|")[1], 7 * 60 + 45).getTime();
      // Nunca después de su primera acción (eventos comprimidos cerca de "ahora" pueden caer fuera de horario).
      return { usuarioId, fecha: new Date(Math.min(t - MIN, Math.max(apertura, t - entre(3, 20) * MIN))) };
    })
    .filter((l) => l.fecha.getTime() <= limite)
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  return { pedidos, ordenes, movimientos, inicial, logins };
}
