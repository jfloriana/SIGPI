/** Respuesta paginada de la API: `{ datos, total, page, pageSize }`. */
export interface Paginado<T> {
  datos: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Construye `?a=1&b=2` omitiendo vacíos, `undefined` y `null`. */
export function aQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor === undefined || valor === null || valor === "") continue;
    q.set(clave, String(valor));
  }
  const texto = q.toString();
  return texto ? `?${texto}` : "";
}
