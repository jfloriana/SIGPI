// Tipos y validaciones locales de la pantalla Productos y categorías (reflejan apps/api/API.md).

export interface Categoria {
  id: number;
  nombre: string;
  numProductos: number;
}

export const UNIDADES = ["UND", "CAJA", "SACO", "PAQ"] as const;
export type Unidad = (typeof UNIDADES)[number];

export const NOMBRE_UNIDAD: Record<Unidad, string> = {
  UND: "Unidad",
  CAJA: "Caja",
  SACO: "Saco",
  PAQ: "Paquete",
};

export interface Producto {
  id: number;
  codigo: string;
  nombre: string;
  unidad: Unidad;
  /** Decimal serializado como string con 2 decimales. */
  precio: string;
  stock: number;
  stockMinimo: number;
  activo: boolean;
  enAlerta: boolean;
  categoria: { id: number; nombre: string };
}

export interface ValoresProducto {
  codigo: string;
  nombre: string;
  categoriaId: string;
  unidad: Unidad | "";
  precio: string;
  stockMinimo: string;
}

export type CampoProducto = keyof ValoresProducto;

/** Mismas reglas y mensajes que el servidor; el servidor vuelve a validar. */
export function validarProducto(v: ValoresProducto): Partial<Record<CampoProducto, string>> {
  const e: Partial<Record<CampoProducto, string>> = {};
  const codigo = v.codigo.trim().toUpperCase();
  if (!codigo) e.codigo = "Ingrese el código";
  else if (!/^[A-Z0-9][A-Z0-9-]{2,19}$/.test(codigo)) e.codigo = "Código no válido: de 3 a 20 letras, números o guiones (p. ej., ARR-001)";

  const nombre = v.nombre.trim();
  if (nombre.length < 3) e.nombre = "Ingrese el nombre (mínimo 3 caracteres)";
  else if (nombre.length > 120) e.nombre = "Máximo 120 caracteres";

  if (!v.categoriaId) e.categoriaId = "Seleccione una categoría";
  if (!v.unidad) e.unidad = "Seleccione una unidad";

  const precio = normalizarImporte(v.precio);
  if (!precio) e.precio = "Ingrese un importe";
  else if (!/^\d+(\.\d{1,2})?$/.test(precio)) e.precio = "Ingrese un importe válido con máximo 2 decimales";
  else if (Number(precio) <= 0) e.precio = "El importe debe ser mayor que 0";
  else if (Number(precio) > 999999.99) e.precio = "El importe no puede superar S/ 999 999.99";

  const minimo = v.stockMinimo.trim();
  if (!minimo) e.stockMinimo = "Ingrese un número entero";
  else if (/^-\d+$/.test(minimo)) e.stockMinimo = "No puede ser negativo";
  else if (!/^\d+$/.test(minimo)) e.stockMinimo = "Debe ser un número entero";
  else if (Number(minimo) > 1_000_000) e.stockMinimo = "El valor es demasiado grande";

  return e;
}

/** Acepta coma decimal («3,50») y la convierte a punto. */
export function normalizarImporte(texto: string) {
  return texto.trim().replace(",", ".");
}

export function validarCategoria(nombre: string): string | undefined {
  const n = nombre.trim();
  if (n.length < 3) return "Ingrese el nombre (mínimo 3 caracteres)";
  if (n.length > 60) return "Máximo 60 caracteres";
  return undefined;
}
