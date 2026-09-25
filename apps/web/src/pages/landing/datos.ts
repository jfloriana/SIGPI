/**
 * Datos reales del demo sembrado (apps/api/prisma/datos-maestros.ts y seed.ts)
 * y la distribución del almacén que comparten la escena 3D y el respaldo SVG.
 */

export type Unidad = "SACO" | "CAJA" | "PAQ" | "UND";

export interface Categoria {
  codigo: string;
  nombre: string;
  /** Unidad de cada producto de la categoría, en el orden del seed. */
  unidades: Unidad[];
  /** Índice (en `unidades`) del producto con stock ≤ mínimo, si lo hay. */
  alerta: number | null;
  /** Centro del estante en el piso del almacén (x, z). */
  x: number;
  z: number;
}

const FILA_FRENTE = 0;
const FILA_FONDO = -4.6;

export const CATEGORIAS: Categoria[] = [
  { codigo: "FID", nombre: "Fideos", unidades: ["UND", "UND", "UND", "UND", "UND", "CAJA", "UND"], alerta: 4, x: -9.5, z: FILA_FRENTE },
  { codigo: "BEB", nombre: "Bebidas", unidades: ["UND", "PAQ", "UND", "UND", "UND", "UND", "UND", "CAJA"], alerta: 6, x: -5.5, z: FILA_FRENTE },
  { codigo: "LIM", nombre: "Limpieza", unidades: ["UND", "UND", "UND", "UND", "UND", "PAQ", "UND", "PAQ"], alerta: 5, x: -1.5, z: FILA_FRENTE },
  { codigo: "CON", nombre: "Conservas", unidades: ["UND", "CAJA", "UND", "UND", "UND", "UND", "UND"], alerta: null, x: 2.5, z: FILA_FRENTE },
  { codigo: "ARR", nombre: "Arroz y menestras", unidades: ["SACO", "SACO", "PAQ", "UND", "UND", "UND", "UND", "UND"], alerta: 4, x: -9.5, z: FILA_FONDO },
  { codigo: "AZU", nombre: "Azúcar", unidades: ["SACO", "SACO", "UND", "UND", "PAQ", "CAJA", "UND"], alerta: 4, x: -5.5, z: FILA_FONDO },
  { codigo: "LAC", nombre: "Lácteos", unidades: ["UND", "CAJA", "UND", "UND", "UND", "UND", "UND", "UND"], alerta: 2, x: -1.5, z: FILA_FONDO },
  { codigo: "ACE", nombre: "Aceites", unidades: ["UND", "CAJA", "UND", "UND", "UND", "UND", "UND"], alerta: 2, x: 2.5, z: FILA_FONDO },
];

export const TOTAL_PRODUCTOS = CATEGORIAS.reduce((s, c) => s + c.unidades.length, 0);
export const TOTAL_ALERTAS = CATEGORIAS.filter((c) => c.alerta !== null).length;

/** Producto en alerta que protagoniza la landing (ACE-003 en el seed). */
export const PRODUCTO_ALERTA = {
  codigo: "ACE-003",
  nombre: "Aceite vegetal bidón 5 L",
  stock: 12,
  minimo: 20,
  /** Regla 18: cantidad sugerida = stockMinimo × 2 − stock. */
  sugerida: 20 * 2 - 12,
};

export const PEDIDO_DEMO = "PED-000123";

/** Medidas del almacén (unidades de mundo). */
export const PISO = { x0: -13, x1: 13, z0: -9, z1: 9 };
export const ESTANTE = { ancho: 3.4, fondo: 1.1, alto: 2.9, niveles: [0.18, 1.08, 1.98] };

/** Tamaño de caja por unidad de venta (ancho, alto, fondo). */
export const TAMANO_CAJA: Record<Unidad, [number, number, number]> = {
  SACO: [0.95, 0.38, 0.72],
  CAJA: [0.82, 0.62, 0.74],
  PAQ: [0.74, 0.5, 0.66],
  UND: [0.62, 0.56, 0.6],
};

/** Posición de cada producto en su estante: los que están en alerta van arriba, a la vista. */
export function ubicarProductos(c: Categoria) {
  const orden = c.unidades.map((u, i) => ({ u, i, alerta: i === c.alerta }));
  orden.sort((a, b) => Number(a.alerta) - Number(b.alerta));
  const porNivel = [3, 3, 3];
  const salida: { unidad: Unidad; alerta: boolean; x: number; y: number; z: number }[] = [];
  let k = 0;
  porNivel.forEach((cupo, nivel) => {
    const enNivel = orden.slice(k, k + cupo);
    k += cupo;
    enNivel.forEach((p, j) => {
      const paso = ESTANTE.ancho / 3;
      const x = c.x - ESTANTE.ancho / 2 + paso / 2 + paso * j;
      const [, alto] = TAMANO_CAJA[p.u];
      salida.push({ unidad: p.u, alerta: p.alerta, x, y: ESTANTE.niveles[nivel] + 0.05 + alto / 2, z: c.z });
    });
  });
  return salida;
}

/** Zonas del recorrido (mundo). */
export const ZONAS = {
  escritorio: { x: -10, z: 5.6 },
  aprobado: { x: -6.4, z: 5.2 },
  anulado: { x: -3.6, z: 6.2 },
  anden: { x0: 7.5, x1: 13, z0: 1.4, z1: 7.2 },
  camionDespacho: { x: 16.2, z: 4.3 },
  recepcion: { x0: 7.5, x1: 13, z0: -8.4, z1: -3.2 },
  camionProveedor: { x: 16.2, z: -5.8 },
  palletRecepcion: { x: 10.2, z: -5.8 },
};

/** Recorrido del montacargas: del estante de conservas al camión del andén. */
export const RUTA_DESPACHO: [number, number][] = [
  [2.5, 1.7],
  [6.2, 1.7],
  [8.6, 3.4],
  [12.6, 4.3],
];

export const USUARIOS_DEMO = [
  { email: "vendedor1@distrinorte.pe", rol: "Vendedor", tarea: "Registra pedidos desde el celular." },
  { email: "vendedor2@distrinorte.pe", rol: "Vendedor", tarea: "Otra cartera de clientes, mismas reglas." },
  { email: "gerente@distrinorte.pe", rol: "Gerente", tarea: "Aprueba o anula pedidos y órdenes de compra; lee el tablero." },
  { email: "almacen@distrinorte.pe", rol: "Almacenero", tarea: "Despacha, recepciona compras y ajusta inventario." },
  { email: "admin@distrinorte.pe", rol: "Administrador", tarea: "Mantiene maestros y usuarios; consulta todo, no aprueba." },
];

export const CIFRAS: [string, string][] = [
  ["5", "usuarios"],
  ["4", "roles"],
  ["8", "categorías"],
  ["~60", "productos"],
  ["~80", "clientes"],
  ["3", "proveedores"],
  ["18", "reglas de negocio"],
  ["10", "pruebas automatizadas"],
  ["8", "casos E2E"],
];

export const CONCEPTOS: { titulo: string; donde: string }[] = [
  {
    titulo: "Control de acceso por roles",
    donde: "Cada ruta de la API exige su rol; el menú solo muestra lo permitido y el servidor rechaza el resto.",
  },
  {
    titulo: "Controles de entrada",
    donde: "RUC de 11 dígitos, DNI de 8, cantidades enteras mayores que cero y ningún producto repetido en un pedido.",
  },
  {
    titulo: "Controles de procesamiento",
    donde: "El total se calcula en el servidor con el precio vigente y los estados solo avanzan en el orden permitido.",
  },
  {
    titulo: "Transacciones ACID",
    donde: "Despacho y recepción se confirman completos o no se aplican; el stock nunca queda negativo.",
  },
  {
    titulo: "Alertas de reposición",
    donde: "Todo producto con stock ≤ mínimo aparece en alerta y propone su orden de compra.",
  },
  {
    titulo: "Tablero gerencial y trazabilidad",
    donde: "Ventas, estados y alertas para el gerente; una bitácora de solo lectura con el antes y el después de cada operación.",
  },
];
