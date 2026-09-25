export type Rol = "ADMIN" | "GERENTE" | "VENDEDOR" | "ALMACENERO";

export const NOMBRE_ROL: Record<Rol, string> = {
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  VENDEDOR: "Vendedor",
  ALMACENERO: "Almacenero",
};

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
}

/** Pantalla de inicio según el rol, después de iniciar sesión. */
export const INICIO_POR_ROL: Record<Rol, string> = {
  ADMIN: "/tablero",
  GERENTE: "/tablero",
  VENDEDOR: "/pedidos/nuevo",
  ALMACENERO: "/despacho",
};
