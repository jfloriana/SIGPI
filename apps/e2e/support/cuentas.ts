import path from "node:path";

export const CLAVE_DEMO = "Demo2026!";
export const APP_URL = "http://localhost:5173";
export const API_URL = "http://localhost:3000/api";

export const CUENTAS = {
  admin: { email: "admin@distrinorte.pe", rol: "Administrador", inicio: "/tablero" },
  gerente: { email: "gerente@distrinorte.pe", rol: "Gerente", inicio: "/tablero" },
  vendedor1: { email: "vendedor1@distrinorte.pe", rol: "Vendedor", inicio: "/pedidos/nuevo" },
  vendedor2: { email: "vendedor2@distrinorte.pe", rol: "Vendedor", inicio: "/pedidos/nuevo" },
  almacen: { email: "almacen@distrinorte.pe", rol: "Almacenero", inicio: "/despacho" },
} as const;

export type Cuenta = keyof typeof CUENTAS;

/** Archivo con la sesión guardada (storageState) de cada cuenta. */
export function sesion(cuenta: Cuenta) {
  return path.join(__dirname, "..", ".auth", `${cuenta}.json`);
}
