// Tipos y reglas del maestro de clientes (espejo del contrato de apps/api/API.md).
// Candidatos a promoverse a `src/api/` si otras pantallas (Nuevo pedido) los necesitan.

export const ZONAS = ["Centro", "Norte", "Sur", "La Esperanza", "El Porvenir", "Víctor Larco"] as const;
export type Zona = (typeof ZONAS)[number];

export type TipoDoc = "RUC" | "DNI";

export interface Cliente {
  id: number;
  tipoDoc: TipoDoc;
  numDoc: string;
  razonSocial: string;
  direccion: string;
  telefono: string | null;
  zona: Zona;
  activo: boolean;
}

/** Longitud exacta del número según el tipo de documento. */
export const LONGITUD_DOC: Record<TipoDoc, number> = { RUC: 11, DNI: 8 };

/** Mismos mensajes que devuelve la API (utils/validadores.ts del servidor). */
export const MENSAJE_DOC: Record<TipoDoc, string> = {
  RUC: "El RUC debe tener 11 dígitos y empezar con 10 o 20",
  DNI: "El DNI debe tener exactamente 8 dígitos",
};

export function errorDocumento(tipo: TipoDoc, numero: string): string | null {
  const valido = tipo === "RUC" ? /^(10|20)\d{9}$/.test(numero) : /^\d{8}$/.test(numero);
  return valido ? null : MENSAJE_DOC[tipo];
}

export const esZona = (v: string): v is Zona => (ZONAS as readonly string[]).includes(v);
