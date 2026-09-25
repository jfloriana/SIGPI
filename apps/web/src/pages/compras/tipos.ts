// Tipos y validaciones locales de la pantalla Proveedores y compras (reflejan apps/api/API.md).
import { ApiError } from "../../api/cliente";
import type { EstadoOrden } from "../../components/Chip";

export interface Proveedor {
  id: number;
  ruc: string;
  razonSocial: string;
  telefono: string | null;
}

export interface OrdenFila {
  id: number;
  codigo: string;
  fecha: string;
  estado: EstadoOrden;
  proveedor: { id: number; ruc: string; razonSocial: string };
  numLineas: number;
  /** Decimal como string con 2 decimales. */
  total: string;
}

export interface ProductoLinea {
  id: number;
  codigo: string;
  nombre: string;
  unidad: string;
  stock: number;
  stockMinimo: number;
}

export interface LineaOrden {
  id: number;
  producto: ProductoLinea;
  cantidad: number;
  costoUnit: string;
  subtotal: string;
}

export type AccionOrden = "aprobar" | "recepcionar" | "anular";

export interface MovimientoRecepcion {
  productoId: number;
  codigo: string;
  cantidad: number;
  stockResultante: number;
}

export interface RegistroHistorial {
  id: number;
  accion: "CREAR" | "CAMBIO_ESTADO" | "RECEPCION" | "ANULAR" | string;
  usuario: { id: number; nombre: string } | null;
  fecha: string;
  antes: { estado?: EstadoOrden } | null;
  despues: {
    estado?: EstadoOrden;
    total?: string;
    motivo?: string;
    movimientos?: MovimientoRecepcion[];
    lineas?: unknown[];
  } | null;
}

export interface OrdenDetalle {
  id: number;
  codigo: string;
  fecha: string;
  estado: EstadoOrden;
  proveedor: Proveedor;
  creadoPor: { id: number; nombre: string } | null;
  motivoAnulacion: string | null;
  total: string;
  lineas: LineaOrden[];
  historial: RegistroHistorial[];
  acciones: AccionOrden[];
}

export interface Sugerida {
  proveedor: { id: number; ruc: string; razonSocial: string } | null;
  supuestoCosto: string;
  lineas: {
    producto: ProductoLinea & { precio: string };
    cantidad: number;
    costoUnit: string;
    subtotal: string;
  }[];
  total: string;
}

/** Producto tal como lo devuelve `GET /productos` (solo lo que usa el buscador de líneas). */
export interface ProductoCatalogo extends ProductoLinea {
  precio: string;
  activo: boolean;
  enAlerta: boolean;
}

export const ESTADOS_ORDEN: EstadoOrden[] = ["PENDIENTE", "APROBADA", "RECIBIDA", "ANULADA"];

// ---------- Proveedor ----------

export const MENSAJE_RUC = "El RUC debe tener 11 dígitos y empezar con 10 o 20";

export interface ValoresProveedor {
  ruc: string;
  razonSocial: string;
  telefono: string;
}
export type CampoProveedor = keyof ValoresProveedor;

/** Mismas reglas y mensajes que el servidor; el servidor vuelve a validar. */
export function validarProveedor(v: ValoresProveedor): Partial<Record<CampoProveedor, string>> {
  const e: Partial<Record<CampoProveedor, string>> = {};
  const ruc = v.ruc.trim();
  if (!ruc) e.ruc = "Ingrese el RUC";
  else if (!/^(10|20)\d{9}$/.test(ruc)) e.ruc = MENSAJE_RUC;

  const razon = v.razonSocial.trim();
  if (razon.length < 3) e.razonSocial = "Ingrese la razón social (mínimo 3 caracteres)";
  else if (razon.length > 150) e.razonSocial = "Máximo 150 caracteres";

  const tel = v.telefono.trim();
  if (tel && !/^[\d\s+()-]{6,20}$/.test(tel)) e.telefono = "Teléfono no válido";
  return e;
}

// ---------- Orden de compra (formulario) ----------

export interface LineaFormulario {
  /** Clave local estable para React. */
  clave: string;
  producto: ProductoLinea & { precio?: string };
  cantidad: string;
  costoUnit: string;
}

/** Acepta coma decimal («3,50») y la convierte a punto. */
export function normalizarImporte(texto: string) {
  return texto.trim().replace(",", ".");
}

export function validarCantidad(texto: string): string | undefined {
  const t = texto.trim();
  if (!t) return "Ingrese la cantidad";
  if (!/^\d+$/.test(t) || Number(t) <= 0) return "Ingrese una cantidad entera mayor que 0";
  if (Number(t) > 1_000_000) return "La cantidad es demasiado grande";
  return undefined;
}

export function validarCosto(texto: string): string | undefined {
  const c = normalizarImporte(texto);
  if (!c) return "Ingrese el costo";
  if (!/^\d+(\.\d{1,2})?$/.test(c)) return "Ingrese un importe válido con máximo 2 decimales";
  if (Number(c) <= 0) return "El importe debe ser mayor que 0";
  if (Number(c) > 999999.99) return "El importe no puede superar S/ 999 999.99";
  return undefined;
}

/** Subtotal en céntimos (entero) para sumar sin errores de coma flotante; `null` si la línea es inválida. */
export function subtotalCentimos(l: LineaFormulario): number | null {
  if (validarCantidad(l.cantidad) || validarCosto(l.costoUnit)) return null;
  return Number(l.cantidad) * Math.round(Number(normalizarImporte(l.costoUnit)) * 100);
}

/** Costo sugerido: 80 % del precio de venta (supuesto del demo, igual que la API). */
export function costoSugerido(precio: string | undefined): string {
  if (!precio) return "";
  return (Math.round(Number(precio) * 80) / 100).toFixed(2);
}

/** Cantidad sugerida: mínimo × 2 − stock, al menos 1 (regla 18). */
export function cantidadSugerida(p: { stock: number; stockMinimo: number }): number {
  return Math.max(1, p.stockMinimo * 2 - p.stock);
}

/** Separa los errores de la API: los de claves conocidas van junto al campo, el resto al aviso general. */
export function repartirError(err: unknown, esConocida: (clave: string) => boolean, porDefecto = "No se pudo guardar. Intente de nuevo.") {
  if (!(err instanceof ApiError)) return { campos: {} as Record<string, string>, general: porDefecto as string | null };
  const campos: Record<string, string> = {};
  const otros: string[] = [];
  for (const [clave, mensaje] of Object.entries(err.campos ?? {})) {
    if (esConocida(clave)) campos[clave] = mensaje;
    else otros.push(mensaje);
  }
  const general = otros.length ? otros.join(" · ") : Object.keys(campos).length ? null : err.message;
  return { campos, general };
}

/** Mensaje legible de un error de mutación. */
export function mensajeError(err: unknown, porDefecto = "No se pudo completar la operación."): string | null {
  if (!err) return null;
  return err instanceof ApiError ? err.message : porDefecto;
}
