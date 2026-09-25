import type { Rol } from "../../auth/roles";

/** Objeto Usuario de la API (API.md › Usuarios). */
export interface UsuarioApi {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  bloqueado: boolean;
  bloqueadoHasta: string | null;
  creadoEn: string;
}

/** `HH:MM` en hora de Lima. */
export function horaLima(valor: string): string {
  return new Date(valor).toLocaleTimeString("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Iniciales para el avatar: primera letra del primer nombre y del primer apellido. */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const a = partes[0]?.[0] ?? "";
  const b = partes.length > 2 ? partes[partes.length - 2][0] : (partes[1]?.[0] ?? "");
  return (a + b).toUpperCase();
}
