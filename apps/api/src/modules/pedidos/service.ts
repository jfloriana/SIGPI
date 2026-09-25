import { randomUUID } from "node:crypto";
import { prisma, type Tx } from "../../db.ts";
import { Prisma } from "../../generated/prisma/client.ts";
import { auditar } from "../../services/auditoria.ts";
import { contiene, type Contexto } from "../../utils/consultas.ts";
import { AppError, accesoDenegado, noEncontrado } from "../../utils/errores.ts";
import { paginado, rango } from "../../utils/paginacion.ts";
import { ROLES, type Rol } from "../../utils/roles.ts";
import type { CrearPedido, EstadoPedido, ListarPedidos } from "./schemas.ts";

const ENTIDAD = "Pedido";
const { GERENTE, VENDEDOR, ALMACENERO } = ROLES;

/** Regla 7: al contado y hasta este total se aprueba automáticamente. */
export const LIMITE_APROBACION_AUTOMATICA = new Prisma.Decimal("2000.00");

export type AccionPedido = "aprobar" | "despachar" | "entregar" | "anular";
export const ACCIONES: AccionPedido[] = ["aprobar", "despachar", "entregar", "anular"];

/** Roles que pueden ejecutar cada acción (el ADMIN solo consulta: segregación de funciones). */
export const ROLES_POR_ACCION: Record<AccionPedido, Rol[]> = {
  aprobar: [GERENTE],
  despachar: [ALMACENERO],
  entregar: [ALMACENERO],
  anular: [GERENTE, VENDEDOR],
};

/** Regla 6: máquina de estados estricta. */
const TRANSICIONES: Record<AccionPedido, { desde: EstadoPedido[]; hacia: EstadoPedido }> = {
  aprobar: { desde: ["REGISTRADO"], hacia: "APROBADO" },
  despachar: { desde: ["APROBADO"], hacia: "DESPACHADO" },
  entregar: { desde: ["DESPACHADO"], hacia: "ENTREGADO" },
  anular: { desde: ["REGISTRADO", "APROBADO"], hacia: "ANULADO" },
};

const ESTADOS_ALMACENERO: EstadoPedido[] = ["APROBADO", "DESPACHADO", "ENTREGADO"];

export const codigoPedido = (id: number) => `PED-${String(id).padStart(6, "0")}`;
const dinero = (d: Prisma.Decimal) => d.toFixed(2);

const transicionInvalida = (de: string, a: string) =>
  new AppError(422, "TRANSICION_INVALIDA", `No se puede pasar de ${de} a ${a}`);

interface ItemSinStock {
  productoId: number;
  codigo: string;
  nombre: string;
  stockDisponible: number;
  solicitado: number;
}

function stockInsuficiente(items: ItemSinStock[], indices?: number[]) {
  const detalle = items
    .map((i) => `${i.nombre} (${i.codigo}): stock disponible ${i.stockDisponible}, solicitado ${i.solicitado}`)
    .join("; ");
  const campos = indices
    ? Object.fromEntries(items.map((i, k) => [`lineas.${indices[k]}.cantidad`, `Stock disponible: ${i.stockDisponible}`]))
    : undefined;
  return new AppError(409, "STOCK_INSUFICIENTE", `Stock insuficiente para ${detalle}`, campos, { productos: items });
}

// ---------------------------------------------------------------------------------------------
// Visibilidad y permisos (una sola lógica para endpoints y para `acciones`).

type PedidoMin = { estado: string; vendedorId: number };

function puedeVer(p: PedidoMin, ctx: Contexto): boolean {
  if (ctx.rol === VENDEDOR) return p.vendedorId === ctx.usuarioId;
  if (ctx.rol === ALMACENERO) return ESTADOS_ALMACENERO.includes(p.estado as EstadoPedido);
  return true; // GERENTE y ADMIN
}

function filtroVisibilidad(ctx: Contexto): Prisma.PedidoWhereInput {
  if (ctx.rol === VENDEDOR) return { vendedorId: ctx.usuarioId };
  if (ctx.rol === ALMACENERO) return { estado: { in: ESTADOS_ALMACENERO } };
  return {};
}

/** Devuelve el error que impide la acción, o null si el usuario puede ejecutarla. */
export function evaluarAccion(accion: AccionPedido, p: PedidoMin, ctx: Contexto): AppError | null {
  if (!ROLES_POR_ACCION[accion].includes(ctx.rol)) return accesoDenegado();
  if (!puedeVer(p, ctx)) return accesoDenegado("No tiene acceso a este pedido");

  const t = TRANSICIONES[accion];
  if (!t.desde.includes(p.estado as EstadoPedido)) return transicionInvalida(p.estado, t.hacia);

  if (accion === "anular" && ctx.rol === VENDEDOR && p.estado !== "REGISTRADO") {
    return accesoDenegado("Solo puede anular sus pedidos en estado REGISTRADO");
  }
  // Regla 11: quien registró el pedido no lo aprueba ni lo despacha, aunque tenga el rol.
  if ((accion === "aprobar" || accion === "despachar") && p.vendedorId === ctx.usuarioId) {
    const verbo = accion === "aprobar" ? "aprobar" : "despachar";
    return new AppError(403, "SEGREGACION_FUNCIONES", `No puede ${verbo} un pedido que usted mismo registró`);
  }
  return null;
}

export const accionesPermitidas = (p: PedidoMin, ctx: Contexto) =>
  ACCIONES.filter((a) => evaluarAccion(a, p, ctx) === null);

// ---------------------------------------------------------------------------------------------
// Consultas

const incluirFila = {
  cliente: { select: { id: true, razonSocial: true, zona: true } },
  vendedor: { select: { id: true, nombre: true } },
  _count: { select: { detalles: true } },
} satisfies Prisma.PedidoInclude;

const incluirDetalle = {
  cliente: true,
  vendedor: { select: { id: true, nombre: true } },
  detalles: {
    include: { producto: { select: { id: true, codigo: true, nombre: true, unidad: true } } },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.PedidoInclude;

type PedidoFila = Prisma.PedidoGetPayload<{ include: typeof incluirFila }>;

function filaRespuesta(p: PedidoFila) {
  return {
    id: p.id,
    codigo: p.codigo,
    fecha: p.fecha,
    estado: p.estado,
    condicionPago: p.condicionPago,
    total: dinero(p.total),
    cliente: p.cliente,
    vendedor: p.vendedor,
    numLineas: p._count.detalles,
  };
}

/** Inicio del día `AAAA-MM-DD` en America/Lima (UTC-5, sin horario de verano). */
const inicioDiaLima = (fecha: string) => new Date(`${fecha}T00:00:00-05:00`);

export async function listar(q: ListarPedidos, ctx: Contexto) {
  const filtros: Prisma.PedidoWhereInput = {
    ...(q.estado && { estado: q.estado }),
    ...(q.vendedorId && ctx.rol !== VENDEDOR && { vendedorId: q.vendedorId }),
    ...(q.clienteId && { clienteId: q.clienteId }),
    ...((q.desde || q.hasta) && {
      fecha: {
        ...(q.desde && { gte: inicioDiaLima(q.desde) }),
        ...(q.hasta && { lt: new Date(inicioDiaLima(q.hasta).getTime() + 86_400_000) }),
      },
    }),
    ...(q.buscar && {
      OR: [{ codigo: { contains: q.buscar.toUpperCase() } }, { cliente: { razonSocial: contiene(q.buscar) } }],
    }),
  };
  const where: Prisma.PedidoWhereInput = { AND: [filtroVisibilidad(ctx), filtros] };
  const dir = q.orden === "antiguedad" ? "asc" : "desc";
  const [filas, total] = await Promise.all([
    prisma.pedido.findMany({ where, include: incluirFila, orderBy: [{ fecha: dir }, { id: dir }], ...rango(q) }),
    prisma.pedido.count({ where }),
  ]);
  return paginado(filas.map(filaRespuesta), total, q);
}

export async function obtener(id: number, ctx: Contexto) {
  const p = await prisma.pedido.findUnique({ where: { id }, include: incluirDetalle });
  if (!p) throw noEncontrado(ENTIDAD);
  if (!puedeVer(p, ctx)) throw accesoDenegado("No tiene acceso a este pedido");

  const idsUsuarios = [p.aprobadoPorId, p.despachadoPorId].filter((x): x is number => x !== null);
  const [usuarios, bitacora] = await Promise.all([
    prisma.usuario.findMany({ where: { id: { in: idsUsuarios } }, select: { id: true, nombre: true } }),
    prisma.bitacora.findMany({
      where: { entidad: ENTIDAD, entidadId: String(id) },
      include: { usuario: { select: { id: true, nombre: true } } },
      orderBy: { id: "asc" },
    }),
  ]);
  const usuario = (uid: number | null) => usuarios.find((u) => u.id === uid) ?? null;

  return {
    id: p.id,
    codigo: p.codigo,
    fecha: p.fecha,
    estado: p.estado,
    condicionPago: p.condicionPago,
    total: dinero(p.total),
    cliente: {
      id: p.cliente.id,
      tipoDoc: p.cliente.tipoDoc,
      numDoc: p.cliente.numDoc,
      razonSocial: p.cliente.razonSocial,
      direccion: p.cliente.direccion,
      telefono: p.cliente.telefono,
      zona: p.cliente.zona,
    },
    vendedor: p.vendedor,
    aprobadoPor: usuario(p.aprobadoPorId),
    aprobacionAutomatica: p.fechaAprobacion !== null && p.aprobadoPorId === null,
    despachadoPor: usuario(p.despachadoPorId),
    fechaAprobacion: p.fechaAprobacion,
    fechaDespacho: p.fechaDespacho,
    fechaEntrega: p.fechaEntrega,
    motivoAnulacion: p.motivoAnulacion,
    lineas: p.detalles.map((d) => ({
      id: d.id,
      producto: d.producto,
      cantidad: d.cantidad,
      precioUnit: dinero(d.precioUnit),
      subtotal: dinero(d.subtotal),
    })),
    historial: bitacora.map((b) => {
      const detalle = JSON.parse(b.detalle) as { antes: unknown; despues: unknown };
      return { id: b.id, accion: b.accion, usuario: b.usuario, fecha: b.fecha, antes: detalle.antes, despues: detalle.despues };
    }),
    acciones: accionesPermitidas(p, ctx),
  };
}

// ---------------------------------------------------------------------------------------------
// Registro (reglas 3, 4, 5 y 7)

export async function crear(datos: CrearPedido, ctx: Contexto) {
  const id = await prisma.$transaction(async (tx) => {
    const cliente = await tx.cliente.findUnique({ where: { id: datos.clienteId } });
    if (!cliente || !cliente.activo) {
      throw new AppError(400, "VALIDACION", "Revise los datos ingresados", {
        clienteId: "El cliente no existe o está inactivo",
      });
    }

    const productos = await tx.producto.findMany({ where: { id: { in: datos.lineas.map((l) => l.productoId) } } });
    const porId = new Map(productos.map((p) => [p.id, p]));

    const invalidos: Record<string, string> = {};
    datos.lineas.forEach((l, i) => {
      const p = porId.get(l.productoId);
      if (!p || !p.activo) invalidos[`lineas.${i}.productoId`] = "El producto no existe o está inactivo";
    });
    if (Object.keys(invalidos).length) throw new AppError(400, "VALIDACION", "Revise los datos ingresados", invalidos);

    // Regla 5: cantidad ≤ stock disponible (el stock NO se descuenta al registrar).
    const sinStock: ItemSinStock[] = [];
    const indices: number[] = [];
    datos.lineas.forEach((l, i) => {
      const p = porId.get(l.productoId)!;
      if (l.cantidad > p.stock) {
        sinStock.push({ productoId: p.id, codigo: p.codigo, nombre: p.nombre, stockDisponible: p.stock, solicitado: l.cantidad });
        indices.push(i);
      }
    });
    if (sinStock.length) throw stockInsuficiente(sinStock, indices);

    // Regla 4: el total se calcula aquí con el precio vigente; se ignora lo que envíe el cliente.
    const lineas = datos.lineas.map((l) => {
      const p = porId.get(l.productoId)!;
      const subtotal = p.precio.mul(l.cantidad).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      return { productoId: p.id, codigo: p.codigo, cantidad: l.cantidad, precioUnit: p.precio, subtotal };
    });
    const total = lineas.reduce((a, l) => a.add(l.subtotal), new Prisma.Decimal(0)).toDecimalPlaces(2);

    const creado = await tx.pedido.create({
      data: {
        codigo: `TMP-${randomUUID()}`,
        clienteId: cliente.id,
        vendedorId: ctx.usuarioId,
        condicionPago: datos.condicionPago,
        total,
        estado: "REGISTRADO",
        detalles: {
          create: lineas.map((l) => ({
            productoId: l.productoId,
            cantidad: l.cantidad,
            precioUnit: l.precioUnit,
            subtotal: l.subtotal,
          })),
        },
      },
    });
    const codigo = codigoPedido(creado.id);
    await tx.pedido.update({ where: { id: creado.id }, data: { codigo } });

    await auditar(tx, {
      usuarioId: ctx.usuarioId,
      accion: "CREAR",
      entidad: ENTIDAD,
      entidadId: creado.id,
      despues: {
        codigo,
        estado: "REGISTRADO",
        cliente: { id: cliente.id, razonSocial: cliente.razonSocial },
        condicionPago: datos.condicionPago,
        total: dinero(total),
        lineas: lineas.map((l) => ({
          productoId: l.productoId,
          codigo: l.codigo,
          cantidad: l.cantidad,
          precioUnit: dinero(l.precioUnit),
          subtotal: dinero(l.subtotal),
        })),
      },
      ip: ctx.ip,
    });

    // Regla 7: contado ≤ S/ 2 000 → aprobación automática.
    if (datos.condicionPago === "CONTADO" && total.lte(LIMITE_APROBACION_AUTOMATICA)) {
      await tx.pedido.update({ where: { id: creado.id }, data: { estado: "APROBADO", fechaAprobacion: new Date() } });
      await auditar(tx, {
        usuarioId: ctx.usuarioId,
        accion: "CAMBIO_ESTADO",
        entidad: ENTIDAD,
        entidadId: creado.id,
        antes: { estado: "REGISTRADO" },
        despues: { estado: "APROBADO", aprobacion: "AUTOMATICA", regla: "Contado con total ≤ S/ 2 000" },
        ip: ctx.ip,
      });
    }
    return creado.id;
  });
  return obtener(id, ctx);
}

// ---------------------------------------------------------------------------------------------
// Transiciones (reglas 6, 8 y 11)

async function verificarAccion(id: number, accion: AccionPedido, ctx: Contexto) {
  const p = await prisma.pedido.findUnique({ where: { id } });
  if (!p) throw noEncontrado(ENTIDAD);
  const error = evaluarAccion(accion, p, ctx);
  if (error) throw error;
  return p;
}

/**
 * Cambio de estado condicional (`updateMany where estado ∈ desde`): si otra petición cambió el estado
 * entre la lectura y la escritura, count = 0 y se responde 422 sin tocar nada.
 */
async function cambiarEstado(
  tx: Tx,
  id: number,
  accion: AccionPedido,
  data: Prisma.PedidoUncheckedUpdateManyInput,
  desde: EstadoPedido[] = TRANSICIONES[accion].desde,
) {
  const { hacia } = TRANSICIONES[accion];
  const r = await tx.pedido.updateMany({ where: { id, estado: { in: desde } }, data: { ...data, estado: hacia } });
  if (r.count !== 1) {
    const actual = await tx.pedido.findUniqueOrThrow({ where: { id }, select: { estado: true } });
    throw transicionInvalida(actual.estado, hacia);
  }
}

export async function aprobar(id: number, ctx: Contexto) {
  const p = await verificarAccion(id, "aprobar", ctx);
  await prisma.$transaction(async (tx) => {
    await cambiarEstado(tx, id, "aprobar", { aprobadoPorId: ctx.usuarioId, fechaAprobacion: new Date() });
    await auditar(tx, {
      usuarioId: ctx.usuarioId,
      accion: "CAMBIO_ESTADO",
      entidad: ENTIDAD,
      entidadId: id,
      antes: { estado: p.estado },
      despues: { estado: "APROBADO", aprobacion: "MANUAL" },
      ip: ctx.ip,
    });
  });
  return obtener(id, ctx);
}

/** Regla 8: despacho atómico. Si cualquier línea no tiene stock, se revierte todo. */
export async function despachar(id: number, ctx: Contexto) {
  const p = await verificarAccion(id, "despachar", ctx);
  await prisma.$transaction(async (tx) => {
    await cambiarEstado(tx, id, "despachar", { despachadoPorId: ctx.usuarioId, fechaDespacho: new Date() });

    const detalles = await tx.detallePedido.findMany({
      where: { pedidoId: id },
      include: { producto: { select: { codigo: true, nombre: true } } },
      orderBy: { id: "asc" },
    });
    const movimientos: { productoId: number; codigo: string; cantidad: number; stockResultante: number }[] = [];
    for (const d of detalles) {
      // Descuento condicional: nunca deja stock negativo aunque haya despachos concurrentes.
      const r = await tx.producto.updateMany({
        where: { id: d.productoId, stock: { gte: d.cantidad } },
        data: { stock: { decrement: d.cantidad } },
      });
      if (r.count !== 1) {
        const actual = await tx.producto.findUniqueOrThrow({ where: { id: d.productoId }, select: { stock: true } });
        throw stockInsuficiente([
          { productoId: d.productoId, codigo: d.producto.codigo, nombre: d.producto.nombre, stockDisponible: actual.stock, solicitado: d.cantidad },
        ]);
      }
      const { stock } = await tx.producto.findUniqueOrThrow({ where: { id: d.productoId }, select: { stock: true } });
      await tx.movInventario.create({
        data: {
          productoId: d.productoId,
          tipo: "SALIDA",
          cantidad: d.cantidad,
          stockResultante: stock,
          motivo: `Despacho ${p.codigo}`,
          referencia: p.codigo,
          usuarioId: ctx.usuarioId,
        },
      });
      movimientos.push({ productoId: d.productoId, codigo: d.producto.codigo, cantidad: d.cantidad, stockResultante: stock });
    }

    await auditar(tx, {
      usuarioId: ctx.usuarioId,
      accion: "CAMBIO_ESTADO",
      entidad: ENTIDAD,
      entidadId: id,
      antes: { estado: p.estado },
      despues: { estado: "DESPACHADO", movimientos },
      ip: ctx.ip,
    });
  });
  return obtener(id, ctx);
}

export async function entregar(id: number, ctx: Contexto) {
  const p = await verificarAccion(id, "entregar", ctx);
  await prisma.$transaction(async (tx) => {
    await cambiarEstado(tx, id, "entregar", { fechaEntrega: new Date() });
    await auditar(tx, {
      usuarioId: ctx.usuarioId,
      accion: "CAMBIO_ESTADO",
      entidad: ENTIDAD,
      entidadId: id,
      antes: { estado: p.estado },
      despues: { estado: "ENTREGADO" },
      ip: ctx.ip,
    });
  });
  return obtener(id, ctx);
}

export async function anular(id: number, motivo: string, ctx: Contexto) {
  const p = await verificarAccion(id, "anular", ctx);
  await prisma.$transaction(async (tx) => {
    // El vendedor solo anula en REGISTRADO: la condición también va en la escritura (por si el gerente aprueba en paralelo).
    const desde: EstadoPedido[] | undefined = ctx.rol === VENDEDOR ? ["REGISTRADO"] : undefined;
    await cambiarEstado(tx, id, "anular", { motivoAnulacion: motivo }, desde);
    await auditar(tx, {
      usuarioId: ctx.usuarioId,
      accion: "ANULAR",
      entidad: ENTIDAD,
      entidadId: id,
      antes: { estado: p.estado },
      despues: { estado: "ANULADO", motivo },
      ip: ctx.ip,
    });
  });
  return obtener(id, ctx);
}
