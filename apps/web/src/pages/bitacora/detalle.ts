// Lectura del JSON `detalle: { antes, despues }` de la bitácora en lenguaje de negocio:
// nombres de campo legibles, montos en soles, fechas en hora de Lima y un resumen de una línea.
import { NOMBRE_ROL, type Rol } from "../../auth/roles";
import { formatoFechaHora, formatoSoles } from "../../utils/formato";
import type { Datos, RegistroBitacora } from "./tipos";

const CAMPOS: Record<string, string> = {
  estado: "Estado",
  motivo: "Motivo",
  movimientos: "Movimientos de stock",
  aprobacion: "Aprobación",
  regla: "Regla aplicada",
  codigo: "Código",
  cliente: "Cliente",
  condicionPago: "Condición de pago",
  total: "Total",
  lineas: "Líneas",
  productoId: "Producto (id)",
  cantidad: "Cantidad",
  precioUnit: "Precio unitario",
  subtotal: "Subtotal",
  stock: "Stock",
  stockMinimo: "Stock mínimo",
  stockResultante: "Stock resultante",
  tipo: "Tipo",
  referencia: "Referencia",
  movimientoId: "Movimiento (id)",
  nombre: "Nombre",
  email: "Correo",
  rol: "Rol",
  activo: "Activo",
  origen: "Origen",
  razonSocial: "Razón social",
  tipoDoc: "Tipo de documento",
  numDoc: "N.º de documento",
  direccion: "Dirección",
  zona: "Zona",
  telefono: "Teléfono",
  precio: "Precio",
  unidad: "Unidad",
  categoriaId: "Categoría (id)",
  proveedor: "Proveedor",
  proveedorId: "Proveedor (id)",
  costoUnit: "Costo unitario",
  intentosFallidos: "Intentos fallidos",
  bloqueadoHasta: "Bloqueado hasta",
  claveRestablecida: "Contraseña restablecida",
  desbloqueado: "Desbloqueado",
};

/** Campos que son importes (llegan como string "12.50"). */
const MONTOS = new Set(["total", "precio", "precioUnit", "subtotal", "costoUnit", "costo", "totalEstimado"]);

const VALORES: Record<string, Record<string, string>> = {
  condicionPago: { CONTADO: "Contado", CREDITO: "Crédito" },
  aprobacion: { MANUAL: "Manual (gerente)", AUTOMATICA: "Automática (regla 7)" },
  tipo: {
    ENTRADA: "Entrada",
    SALIDA: "Salida",
    AJUSTE_POSITIVO: "Ajuste positivo",
    AJUSTE_NEGATIVO: "Ajuste negativo",
  },
  motivo: {
    CLAVE_INCORRECTA: "Contraseña incorrecta",
    CUENTA_BLOQUEADA: "Cuenta bloqueada",
    USUARIO_INACTIVO: "Usuario inactivo",
    USUARIO_INEXISTENTE: "Correo no registrado",
  },
};

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export function etiquetaCampo(campo: string): string {
  if (CAMPOS[campo]) return CAMPOS[campo];
  const texto = campo.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function esPlano(v: unknown): v is string | number | boolean | null | undefined {
  return v === null || v === undefined || ["string", "number", "boolean"].includes(typeof v);
}

/** Valor simple legible. Objetos y listas se resumen (el panel los despliega aparte). */
export function textoValor(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (MONTOS.has(campo) && !Number.isNaN(Number(v))) return formatoSoles(v as string);
  if (typeof v === "string") {
    if (FECHA_ISO.test(v)) return formatoFechaHora(v);
    if (campo === "rol" && v in NOMBRE_ROL) return NOMBRE_ROL[v as Rol];
    return VALORES[campo]?.[v] ?? v;
  }
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return `${v.length} ${v.length === 1 ? "elemento" : "elementos"}`;
  const o = v as Datos;
  const nombre = o.razonSocial ?? o.nombre ?? o.codigo;
  if (nombre !== undefined) return `${String(nombre)}${o.id !== undefined ? ` (id ${String(o.id)})` : ""}`;
  return Object.entries(o)
    .map(([k, x]) => `${etiquetaCampo(k)}: ${textoValor(k, x)}`)
    .join(" · ");
}

/** Una fila de objeto (línea de pedido, movimiento) en una sola línea legible. */
export function textoElemento(el: unknown): string {
  if (esPlano(el)) return textoValor("", el);
  const o = el as Datos;
  const partes: string[] = [];
  if (o.codigo) partes.push(String(o.codigo));
  for (const [k, x] of Object.entries(o)) {
    if (k === "codigo" || k === "productoId") continue;
    partes.push(`${etiquetaCampo(k).toLowerCase()} ${textoValor(k, x)}`);
  }
  return partes.join(" · ");
}

export type Cambio = "cambio" | "nuevo" | "quitado" | "igual" | "creado";

export interface FilaComparacion {
  campo: string;
  antes: unknown;
  despues: unknown;
  cambio: Cambio;
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Comparación campo por campo de `antes` y `despues`. */
export function comparar(antes: Datos | null, despues: Datos | null): FilaComparacion[] {
  const claves = [...new Set([...Object.keys(antes ?? {}), ...Object.keys(despues ?? {})])];
  return claves.map((campo) => {
    const a = antes?.[campo];
    const d = despues?.[campo];
    let cambio: Cambio;
    if (!antes) cambio = "creado";
    else if (!(campo in antes)) cambio = "nuevo";
    else if (!despues || !(campo in despues)) cambio = "quitado";
    else cambio = igual(a, d) ? "igual" : "cambio";
    return { campo, antes: a, despues: d, cambio };
  });
}

function minuscula(texto: string) {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}

/** Resumen del cambio en una línea (p. ej., «estado: APROBADO → DESPACHADO · 5 movimientos de stock»). */
export function resumen(r: RegistroBitacora): string {
  const antes = r.detalle?.antes ?? null;
  const despues = r.detalle?.despues ?? null;
  const d = despues ?? {};

  if (r.accion === "LOGIN_OK") return "Inicio de sesión correcto";
  if (r.accion === "LOGIN_FALLIDO") {
    const partes = [textoValor("motivo", d.motivo ?? "Intento fallido")];
    if (!r.usuario && d.email) partes.push(String(d.email));
    if (typeof d.intentosFallidos === "number") partes.push(`intento ${d.intentosFallidos} de 5`);
    if (d.bloqueadoHasta) partes.push(`bloqueada hasta ${textoValor("bloqueadoHasta", d.bloqueadoHasta)}`);
    return partes.join(" · ");
  }

  if (r.accion === "CREAR") {
    if (r.entidad === "Pedido") {
      const lineas = Array.isArray(d.lineas) ? d.lineas.length : 0;
      return [d.codigo, textoValor("condicionPago", d.condicionPago), textoValor("total", d.total), `${lineas} ${lineas === 1 ? "línea" : "líneas"}`]
        .filter(Boolean)
        .join(" · ");
    }
    const nombre = d.razonSocial ?? d.nombre ?? d.codigo;
    const partes = [nombre ? `Alta de «${String(nombre)}»` : `Alta de ${r.entidad.toLowerCase()}`];
    if (d.origen) partes.push(String(d.origen).toLowerCase());
    return partes.join(" · ");
  }

  if (d.claveRestablecida) return "Contraseña restablecida por el administrador";

  const filas = comparar(antes, despues);
  const cambios = filas.filter((f) => f.cambio === "cambio").map((f) => `${minuscula(etiquetaCampo(f.campo))}: ${textoValor(f.campo, f.antes)} → ${textoValor(f.campo, f.despues)}`);

  const extras: string[] = [];
  if (Array.isArray(d.movimientos)) {
    const n = d.movimientos.length;
    extras.push(`${n} ${n === 1 ? "movimiento" : "movimientos"} de stock`);
  }
  if (r.accion === "AJUSTE" && d.tipo) extras.push(`${textoValor("tipo", d.tipo).toLowerCase()} de ${String(d.cantidad ?? "")}`);
  if (d.aprobacion === "AUTOMATICA") extras.push("aprobación automática");
  if (typeof d.motivo === "string") extras.push(`«${d.motivo}»`);

  const principal = cambios.length > 2 ? [...cambios.slice(0, 2), `y ${cambios.length - 2} cambios más`] : cambios;
  const texto = [...principal, ...extras].join(" · ");
  return texto || "Sin cambios de datos";
}
