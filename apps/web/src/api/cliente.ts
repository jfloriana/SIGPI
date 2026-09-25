// Cliente HTTP de la API de SIGPI. Toda la lógica de negocio y los permisos viven en el servidor.

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

const CLAVE_TOKEN = "sigpi.token";

export const sesionGuardada = {
  leer: () => localStorage.getItem(CLAVE_TOKEN),
  guardar: (token: string) => localStorage.setItem(CLAVE_TOKEN, token),
  borrar: () => localStorage.removeItem(CLAVE_TOKEN),
};

/** Error devuelto por la API con el formato `{ error: { codigo, mensaje, campos? } }`. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensaje: string,
    public campos: Record<string, string> = {},
    public datos: Record<string, unknown> = {},
  ) {
    super(mensaje);
  }
}

type Metodo = "GET" | "POST" | "PATCH" | "DELETE";

let alExpirarSesion: (() => void) | null = null;
/** El proveedor de autenticación registra aquí qué hacer si el servidor responde 401. */
export function registrarExpiracionSesion(fn: () => void) {
  alExpirarSesion = fn;
}

export async function solicitar<T>(metodo: Metodo, ruta: string, cuerpo?: unknown): Promise<T> {
  const token = sesionGuardada.leer();
  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      method: metodo,
      headers: {
        ...(cuerpo !== undefined && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ApiError(0, "SIN_CONEXION", "No se pudo conectar con el servidor. Verifique que la API esté en ejecución");
  }

  if (respuesta.status === 204) return undefined as T;
  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const { codigo = "ERROR", mensaje = "Ocurrió un error inesperado", campos, ...resto } = datos?.error ?? {};
    if (respuesta.status === 401 && token && ruta !== "/auth/login") alExpirarSesion?.();
    throw new ApiError(respuesta.status, codigo, mensaje, campos, resto);
  }
  return datos as T;
}

export const api = {
  get: <T>(ruta: string) => solicitar<T>("GET", ruta),
  post: <T>(ruta: string, cuerpo?: unknown) => solicitar<T>("POST", ruta, cuerpo ?? {}),
  patch: <T>(ruta: string, cuerpo: unknown) => solicitar<T>("PATCH", ruta, cuerpo),
};
