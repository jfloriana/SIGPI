// Formatos de Perú: moneda en soles con espacio como separador de miles, fechas en America/Lima.

const ZONA = "America/Lima";

/** `S/ 1 234.50`. Acepta number o el string que devuelve la API para los Decimal. */
export function formatoSoles(valor: number | string | null | undefined): string {
  const n = Number(valor ?? 0);
  const [entero, decimales] = Math.abs(n).toFixed(2).split(".");
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${n < 0 ? "-" : ""}S/ ${conMiles}.${decimales}`;
}

/** Número entero con espacio de miles: `12 480`. */
export function formatoNumero(valor: number | string | null | undefined): string {
  return Math.round(Number(valor ?? 0))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** `24/09/2026` */
export function formatoFecha(valor: string | Date | null | undefined): string {
  if (!valor) return "—";
  return new Date(valor).toLocaleDateString("es-PE", { timeZone: ZONA, day: "2-digit", month: "2-digit", year: "numeric" });
}

/** `24/09/2026 18:05` */
export function formatoFechaHora(valor: string | Date | null | undefined): string {
  if (!valor) return "—";
  const d = new Date(valor);
  const hora = d.toLocaleTimeString("es-PE", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false });
  return `${formatoFecha(d)} ${hora}`;
}

/** Fecha `AAAA-MM-DD` en hora de Lima (para inputs type="date" y filtros de la API). */
export function fechaISO(valor: Date = new Date()): string {
  return valor.toLocaleDateString("en-CA", { timeZone: ZONA });
}

/** Resta días a hoy y devuelve `AAAA-MM-DD` (filtro por defecto: últimos 30 días). */
export function haceDias(dias: number): string {
  return fechaISO(new Date(Date.now() - dias * 86_400_000));
}
