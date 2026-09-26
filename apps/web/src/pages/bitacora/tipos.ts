import type { TonoChip } from "../../components/Chip";

export type Accion =
  | "LOGIN_OK"
  | "LOGIN_FALLIDO"
  | "CREAR"
  | "EDITAR"
  | "DESACTIVAR"
  | "CAMBIO_ESTADO"
  | "ANULAR"
  | "AJUSTE"
  | "RECEPCION";

export type Datos = Record<string, unknown>;

/** Objeto RegistroBitacora de la API (`GET /bitacora`). */
export interface RegistroBitacora {
  id: number;
  fecha: string;
  usuario: { id: number; nombre: string; email: string } | null;
  accion: Accion | string;
  entidad: string;
  entidadId: string | null;
  detalle: { antes: Datos | null; despues: Datos | null } | null;
  ip: string | null;
}

export interface FiltrosBitacora {
  entidades: string[];
  acciones: string[];
}

export const ACCION: Record<Accion, { texto: string; tono: TonoChip }> = {
  LOGIN_OK: { texto: "Inicio de sesión", tono: "neutro" },
  LOGIN_FALLIDO: { texto: "Acceso fallido", tono: "coral" },
  CREAR: { texto: "Creación", tono: "teal" },
  EDITAR: { texto: "Edición", tono: "marino" },
  DESACTIVAR: { texto: "Desactivación", tono: "neutro" },
  CAMBIO_ESTADO: { texto: "Cambio de estado", tono: "marino" },
  ANULAR: { texto: "Anulación", tono: "coral" },
  AJUSTE: { texto: "Ajuste de stock", tono: "neutro" },
  RECEPCION: { texto: "Recepción", tono: "teal" },
};

export function infoAccion(accion: string) {
  return ACCION[accion as Accion] ?? { texto: accion, tono: "neutro" as TonoChip };
}

const ENTIDAD: Record<string, string> = {
  Usuario: "Usuario",
  Cliente: "Cliente",
  Categoria: "Categoría",
  Producto: "Producto",
  Proveedor: "Proveedor",
  Pedido: "Pedido",
  OrdenCompra: "Orden de compra",
};

export function nombreEntidad(entidad: string): string {
  return ENTIDAD[entidad] ?? entidad;
}

/** Ruta de la pantalla donde se ve el registro, si existe una por id. */
export function rutaEntidad(entidad: string, entidadId: string | null): string | null {
  if (!entidadId) return null;
  if (entidad === "Pedido") return `/pedidos/${entidadId}`;
  return null;
}
