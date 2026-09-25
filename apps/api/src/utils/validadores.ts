// Esquemas Zod reutilizables (regla 1–2 de la especificación). Mensajes en español.
import { z } from "zod";

export const ZONAS = ["Centro", "Norte", "Sur", "La Esperanza", "El Porvenir", "Víctor Larco"] as const;
export type Zona = (typeof ZONAS)[number];

export const UNIDADES = ["UND", "CAJA", "SACO", "PAQ"] as const;
export type Unidad = (typeof UNIDADES)[number];

export const TIPOS_DOC = ["RUC", "DNI"] as const;
export type TipoDoc = (typeof TIPOS_DOC)[number];

const MENSAJE_RUC = "El RUC debe tener 11 dígitos y empezar con 10 o 20";
const MENSAJE_DNI = "El DNI debe tener exactamente 8 dígitos";

export const esRucValido = (valor: string) => /^(10|20)\d{9}$/.test(valor);
export const esDniValido = (valor: string) => /^\d{8}$/.test(valor);

/** RUC: exactamente 11 dígitos y empieza con 10 o 20. */
export const rucSchema = z
  .string({ error: "Ingrese el RUC" })
  .trim()
  .refine(esRucValido, { error: MENSAJE_RUC });

/** DNI: exactamente 8 dígitos. */
export const dniSchema = z
  .string({ error: "Ingrese el DNI" })
  .trim()
  .refine(esDniValido, { error: MENSAJE_DNI });

export const tipoDocSchema = z.enum(TIPOS_DOC, { error: "El tipo de documento debe ser RUC o DNI" });

/** Mensaje de error para un número de documento según su tipo, o null si es válido. */
export function errorDocumento(tipoDoc: TipoDoc, numDoc: string): string | null {
  if (tipoDoc === "RUC") return esRucValido(numDoc) ? null : MENSAJE_RUC;
  return esDniValido(numDoc) ? null : MENSAJE_DNI;
}

/**
 * Valida `numDoc` según `tipoDoc` sobre el objeto completo; el error queda en el campo `numDoc`.
 * Uso: `z.object({ tipoDoc: tipoDocSchema, numDoc: numDocSchema, … }).superRefine(refinarDocumento)`.
 */
export function refinarDocumento(datos: { tipoDoc?: TipoDoc; numDoc?: string }, ctx: z.RefinementCtx) {
  if (datos.tipoDoc === undefined || datos.numDoc === undefined) return;
  const mensaje = errorDocumento(datos.tipoDoc, datos.numDoc);
  if (mensaje) ctx.addIssue({ code: "custom", path: ["numDoc"], message: mensaje });
}

export const numDocSchema = z.string({ error: "Ingrese el número de documento" }).trim().min(1, {
  error: "Ingrese el número de documento",
});

/** Documento de identidad completo (tipo + número) con el error en `numDoc`. */
export const documentoSchema = z
  .object({ tipoDoc: tipoDocSchema, numDoc: numDocSchema })
  .superRefine(refinarDocumento);

const MAXIMO_DINERO = 999_999.99;

/**
 * Importe en soles > 0 con máximo 2 decimales. Acepta number o string (`12.5`, `"12.50"`)
 * y devuelve un string normalizado con 2 decimales (`"12.50"`), listo para `Prisma.Decimal`.
 */
export const dineroSchema = z
  .union([z.number(), z.string().trim()], { error: "Ingrese un importe" })
  .transform((valor, ctx) => {
    const texto = typeof valor === "number" ? String(valor) : valor;
    if (!/^\d+(\.\d{1,2})?$/.test(texto)) {
      ctx.addIssue({ code: "custom", message: "Ingrese un importe válido con máximo 2 decimales" });
      return z.NEVER;
    }
    const [entero, decimales = ""] = texto.split(".");
    const normalizado = `${BigInt(entero)}.${decimales.padEnd(2, "0")}`;
    const numero = Number(normalizado);
    if (numero <= 0) {
      ctx.addIssue({ code: "custom", message: "El importe debe ser mayor que 0" });
      return z.NEVER;
    }
    if (numero > MAXIMO_DINERO) {
      ctx.addIssue({ code: "custom", message: "El importe no puede superar S/ 999 999.99" });
      return z.NEVER;
    }
    return normalizado;
  });

/** Entero ≥ 0 (p. ej., stock mínimo). */
export const enteroNoNegativoSchema = z
  .number({ error: "Ingrese un número entero" })
  .int({ error: "Debe ser un número entero" })
  .min(0, { error: "No puede ser negativo" })
  .max(1_000_000, { error: "El valor es demasiado grande" });

/** Entero > 0 (p. ej., cantidades). */
export const enteroPositivoSchema = z
  .number({ error: "Ingrese un número entero" })
  .int({ error: "Debe ser un número entero" })
  .min(1, { error: "Debe ser mayor que 0" })
  .max(1_000_000, { error: "El valor es demasiado grande" });

export const zonaSchema = z.enum(ZONAS, { error: `La zona debe ser una de: ${ZONAS.join(", ")}` });

export const unidadSchema = z.enum(UNIDADES, { error: `La unidad debe ser una de: ${UNIDADES.join(", ")}` });

/** Teléfono opcional: dígitos, espacios, +, guiones o paréntesis (6 a 20 caracteres). Vacío → null. */
export const telefonoSchema = z
  .string({ error: "Teléfono no válido" })
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.string().regex(/^[0-9 +()-]{6,20}$/, { error: "Teléfono no válido" }).nullable())
  .nullable();

/** Texto obligatorio recortado con longitud máxima. */
export const textoSchema = (campo: string, max = 150, min = 2) =>
  z
    .string({ error: `Ingrese ${campo}` })
    .trim()
    .min(min, { error: `Ingrese ${campo} (mínimo ${min} caracteres)` })
    .max(max, { error: `Máximo ${max} caracteres` });

/** Filtro booleano en query string: "true" | "false". */
export const booleanoQuery = z
  .enum(["true", "false"], { error: 'Use "true" o "false"' })
  .transform((v) => v === "true")
  .optional();

/** Texto de búsqueda opcional en query string (vacío → undefined). */
export const buscarQuery = z
  .string()
  .trim()
  .max(100, { error: "Máximo 100 caracteres" })
  .optional()
  .transform((v) => (v ? v : undefined));

/** Id numérico positivo de la ruta (`/:id`). */
export const idParamSchema = z.object({
  id: z.coerce.number({ error: "Id no válido" }).int({ error: "Id no válido" }).positive({ error: "Id no válido" }),
});

/** Clave: mínimo 8 caracteres con al menos una letra y un número. */
export const claveSchema = z
  .string({ error: "Ingrese la contraseña" })
  .min(8, { error: "La contraseña debe tener al menos 8 caracteres" })
  .max(72, { error: "La contraseña no puede superar 72 caracteres" })
  .refine((v) => /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(v) && /\d/.test(v), {
    error: "La contraseña debe incluir al menos una letra y un número",
  });
