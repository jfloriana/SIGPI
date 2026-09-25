// Formas de la API de pedidos (apps/api/API.md, sección «Pedidos»).
import type { EstadoPedido } from "../../components/Chip";

export type { EstadoPedido };
export type CondicionPago = "CONTADO" | "CREDITO";
export type AccionPedido = "aprobar" | "despachar" | "entregar" | "anular";

export const ESTADOS_PEDIDO: EstadoPedido[] = ["REGISTRADO", "APROBADO", "DESPACHADO", "ENTREGADO", "ANULADO"];

export const TEXTO_CONDICION: Record<CondicionPago, string> = { CONTADO: "Contado", CREDITO: "Crédito" };

export function esEstadoPedido(v: string): v is EstadoPedido {
  return (ESTADOS_PEDIDO as string[]).includes(v);
}

interface Persona {
  id: number;
  nombre: string;
}

export interface PedidoFila {
  id: number;
  codigo: string;
  fecha: string;
  estado: EstadoPedido;
  condicionPago: CondicionPago;
  total: string;
  cliente: { id: number; razonSocial: string; zona: string };
  vendedor: Persona;
  numLineas: number;
}

export interface LineaPedido {
  id: number;
  producto: { id: number; codigo: string; nombre: string; unidad: string };
  cantidad: number;
  precioUnit: string;
  subtotal: string;
}

export interface MovimientoDespacho {
  productoId: number;
  codigo: string;
  cantidad: number;
  stockResultante: number;
}

export interface RegistroHistorial {
  id: number;
  accion: "CREAR" | "CAMBIO_ESTADO" | "ANULAR" | string;
  usuario: Persona | null;
  fecha: string;
  antes: { estado?: EstadoPedido } | null;
  despues: {
    estado?: EstadoPedido;
    aprobacion?: "AUTOMATICA" | "MANUAL";
    regla?: string;
    motivo?: string;
    movimientos?: MovimientoDespacho[];
  } | null;
}

export interface PedidoDetalle {
  id: number;
  codigo: string;
  fecha: string;
  estado: EstadoPedido;
  condicionPago: CondicionPago;
  total: string;
  cliente: {
    id: number;
    tipoDoc: "RUC" | "DNI";
    numDoc: string;
    razonSocial: string;
    direccion: string;
    telefono: string | null;
    zona: string;
  };
  vendedor: Persona;
  aprobadoPor: Persona | null;
  aprobacionAutomatica: boolean;
  despachadoPor: Persona | null;
  fechaAprobacion: string | null;
  fechaDespacho: string | null;
  fechaEntrega: string | null;
  motivoAnulacion: string | null;
  lineas: LineaPedido[];
  historial: RegistroHistorial[];
  acciones: AccionPedido[];
}

/** Producto tal como lo devuelve `GET /productos` (solo lo que usa el nuevo pedido). */
export interface ProductoVenta {
  id: number;
  codigo: string;
  nombre: string;
  unidad: string;
  precio: string;
  stock: number;
}

/** Cliente tal como lo devuelve `GET /clientes`. */
export interface ClienteVenta {
  id: number;
  tipoDoc: "RUC" | "DNI";
  numDoc: string;
  razonSocial: string;
  direccion: string;
  zona: string;
}

/** Detalle de `error.productos[]` en un 409 STOCK_INSUFICIENTE. */
export interface FaltaStock {
  productoId: number;
  codigo: string;
  nombre: string;
  stockDisponible: number;
  solicitado: number;
}

/** Límite de la regla 7 (aprobación automática al contado). */
export const LIMITE_APROBACION_AUTOMATICA = 2000;

/** «hace 2 h», «hace 3 días»: antigüedad corta para la cola de despacho. */
export function haceCuanto(fecha: string, ahora = Date.now()): string {
  const min = Math.max(0, Math.floor((ahora - new Date(fecha).getTime()) / 60_000));
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}
