import { API_URL, ApiError, sesionGuardada } from "../../api/cliente";
import { aQuery } from "../../api/tipos";

/**
 * Descarga `GET /reportes/ventas.csv` con el token de la sesión. Un `<a href>` directo no enviaría
 * el header Authorization, así que se pide con fetch, se arma un blob y se usa un enlace temporal.
 * El nombre del archivo sale de `Content-Disposition` (la API lo expone por CORS).
 */
export async function descargarVentasCsv(periodo: { desde: string; hasta: string }): Promise<string> {
  const token = sesionGuardada.leer();
  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_URL}/reportes/ventas.csv${aQuery(periodo)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError(0, "SIN_CONEXION", "No se pudo conectar con el servidor. Verifique que la API esté en ejecución");
  }
  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => null);
    const { codigo = "ERROR", mensaje = "No se pudo generar el archivo", campos } = datos?.error ?? {};
    throw new ApiError(respuesta.status, codigo, mensaje, campos);
  }

  const disposicion = respuesta.headers.get("Content-Disposition") ?? "";
  const nombre = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposicion)?.[1] ?? `ventas_${periodo.desde}_${periodo.hasta}.csv`;

  const url = URL.createObjectURL(await respuesta.blob());
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = decodeURIComponent(nombre);
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  // Se libera después del clic para que el navegador alcance a iniciar la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return enlace.download;
}
