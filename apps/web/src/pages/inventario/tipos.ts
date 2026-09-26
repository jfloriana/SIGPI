// Tipos y reglas locales de las pantallas de Inventario (reflejan la sección «Inventario» de apps/api/API.md).
import type { TonoChip } from "../../components/Chip";

export type TipoMovimiento = "ENTRADA" | "SALIDA" | "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO";
/** Tipos que se registran a mano (la SALIDA solo nace de un despacho). */
export type TipoAjuste = Exclude<TipoMovimiento, "SALIDA">;

export interface Movimiento {
  id: number;
  fecha: string;
  tipo: TipoMovimiento;
  cantidad: number;
  stockResultante: number;
  motivo: string;
  referencia: string | null;
  usuario: { id: number; nombre: string };
}

export interface ProductoInventario {
  id: number;
  codigo: string;
  nombre: string;
  unidad: string;
  stock: number;
  stockMinimo: number;
  enAlerta: boolean;
}

export interface ResumenKardex {
  entradas: number;
  salidas: number;
  ajustesPositivos: number;
  ajustesNegativos: number;
  saldoCalculado: number;
  cuadra: boolean;
}

export interface Kardex {
  producto: ProductoInventario;
  resumen: ResumenKardex;
  datos: Movimiento[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Alerta extends ProductoInventario {
  precio: string;
  categoria: { id: number; nombre: string };
  cantidadSugerida: number;
}

export interface RespuestaAjuste {
  movimiento: Movimiento;
  producto: ProductoInventario;
}

export const TIPOS_MOVIMIENTO: TipoMovimiento[] = ["ENTRADA", "SALIDA", "AJUSTE_POSITIVO", "AJUSTE_NEGATIVO"];

export const INFO_TIPO: Record<TipoMovimiento, { texto: string; tono: TonoChip; signo: 1 | -1 }> = {
  ENTRADA: { texto: "Entrada", tono: "teal", signo: 1 },
  SALIDA: { texto: "Salida", tono: "marino", signo: -1 },
  AJUSTE_POSITIVO: { texto: "Ajuste +", tono: "neutro", signo: 1 },
  AJUSTE_NEGATIVO: { texto: "Ajuste −", tono: "neutro", signo: -1 },
};

export const esTipoMovimiento = (v: string): v is TipoMovimiento => (TIPOS_MOVIMIENTO as string[]).includes(v);

/** `+12` / `−5` con el signo tipográfico correcto. */
export function cantidadConSigno(tipo: TipoMovimiento, cantidad: number) {
  return `${INFO_TIPO[tipo].signo > 0 ? "+" : "−"}${cantidad.toLocaleString("es-PE").replace(/,/g, " ")}`;
}

/**
 * La API devuelve la referencia de un despacho como código (`PED-000123`) sin el id.
 * El código se genera como `PED-` + id con ceros a la izquierda, así que el id se deduce de él.
 */
export function idPedidoDeReferencia(referencia: string | null): number | null {
  const m = referencia?.match(/^PED-(\d{1,9})$/);
  return m ? Number(m[1]) : null;
}

/** Stock resultante de un ajuste (sin validar). */
export function stockPrevisto(stock: number, tipo: TipoAjuste, cantidad: number) {
  return tipo === "AJUSTE_NEGATIVO" ? stock - cantidad : stock + cantidad;
}

export const MOTIVO_MIN = 5;
export const MOTIVO_MAX = 200;
export const REFERENCIA_MAX = 60;

export interface ValoresAjuste {
  tipo: TipoAjuste | "";
  cantidad: string;
  motivo: string;
  referencia: string;
}

export type CampoAjuste = keyof ValoresAjuste | "productoId";

/** Mismas reglas y mensajes que el servidor (el servidor vuelve a validar). */
export function validarAjuste(
  v: ValoresAjuste,
  producto: { stock: number } | null,
): Partial<Record<CampoAjuste, string>> {
  const e: Partial<Record<CampoAjuste, string>> = {};
  if (!producto) e.productoId = "Busque y elija un producto";
  if (!v.tipo) e.tipo = "Elija el tipo de movimiento";

  const cantidad = v.cantidad.trim();
  if (!cantidad) e.cantidad = "Ingrese la cantidad";
  else if (!/^-?\d+$/.test(cantidad)) e.cantidad = "Debe ser un número entero";
  else if (Number(cantidad) <= 0) e.cantidad = "La cantidad debe ser mayor que 0";
  else if (Number(cantidad) > 1_000_000) e.cantidad = "La cantidad es demasiado grande";
  else if (producto && v.tipo === "AJUSTE_NEGATIVO" && Number(cantidad) > producto.stock)
    e.cantidad = `Stock disponible: ${producto.stock}. El ajuste dejaría el stock en ${producto.stock - Number(cantidad)}`;

  const motivo = v.motivo.trim();
  if (motivo.length < MOTIVO_MIN) e.motivo = "El motivo debe tener al menos 5 caracteres";
  else if (motivo.length > MOTIVO_MAX) e.motivo = `Máximo ${MOTIVO_MAX} caracteres`;

  if (v.referencia.trim().length > REFERENCIA_MAX) e.referencia = `Máximo ${REFERENCIA_MAX} caracteres`;
  return e;
}
