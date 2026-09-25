/** Error de negocio con código HTTP y un código legible para el frontend. */
export class AppError extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensaje: string,
    public campos?: Record<string, string>,
    public extra?: Record<string, unknown>,
  ) {
    super(mensaje);
  }
}

export const noAutenticado = (mensaje = "Debe iniciar sesión") => new AppError(401, "NO_AUTENTICADO", mensaje);
export const accesoDenegado = (mensaje = "No tiene permiso para realizar esta acción") =>
  new AppError(403, "ACCESO_DENEGADO", mensaje);
export const noEncontrado = (entidad: string) => new AppError(404, "NO_ENCONTRADO", `${entidad} no encontrado`);
