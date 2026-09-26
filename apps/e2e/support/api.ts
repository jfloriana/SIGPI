import fs from "node:fs";
import { expect, request, type APIRequestContext } from "@playwright/test";
import { API_URL, APP_URL, sesion, type Cuenta } from "./cuentas";

/** Token JWT guardado por auth.setup.ts en el localStorage de la sesión de la cuenta. */
export function tokenDe(cuenta: Cuenta): string {
  const estado = JSON.parse(fs.readFileSync(sesion(cuenta), "utf8")) as {
    origins: { origin: string; localStorage: { name: string; value: string }[] }[];
  };
  const token = estado.origins.find((o) => o.origin === APP_URL)?.localStorage.find((i) => i.name === "sigpi.token")?.value;
  if (!token) throw new Error(`No hay token guardado para ${cuenta}; ¿corrió el proyecto setup?`);
  return token;
}

/**
 * Cliente de la API con la sesión de una cuenta. Se usa para preparar datos y leer valores de
 * referencia (stock, totales); las verificaciones del flujo se hacen en la interfaz.
 */
export class Api {
  private constructor(private readonly ctx: APIRequestContext) {}

  static async como(cuenta: Cuenta) {
    const ctx = await request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${tokenDe(cuenta)}` } });
    return new Api(ctx);
  }

  async get<T>(ruta: string): Promise<T> {
    const r = await this.ctx.get(`${API_URL}${ruta}`);
    expect(r.status(), `GET ${ruta}`).toBe(200);
    return (await r.json()) as T;
  }

  async post<T>(ruta: string, cuerpo: unknown, estado = 201): Promise<T> {
    const r = await this.ctx.post(`${API_URL}${ruta}`, { data: cuerpo });
    expect(r.status(), `POST ${ruta}: ${await r.text()}`).toBe(estado);
    return (await r.json()) as T;
  }

  async cerrar() {
    await this.ctx.dispose();
  }

  /** Producto por código exacto. */
  async producto(codigo: string) {
    const r = await this.get<{ datos: ProductoApi[] }>(`/productos?buscar=${encodeURIComponent(codigo)}&pageSize=20`);
    const p = r.datos.find((x) => x.codigo === codigo);
    if (!p) throw new Error(`No existe el producto ${codigo}`);
    return p;
  }

  /** Un cliente activo cualquiera (el primero por orden de la API). */
  async clienteActivo() {
    const r = await this.get<{ datos: ClienteApi[] }>(`/clientes?activo=true&pageSize=1`);
    return r.datos[0];
  }
}

export interface ProductoApi {
  id: number;
  codigo: string;
  nombre: string;
  stock: number;
  stockMinimo: number;
  precio: string;
}

export interface ClienteApi {
  id: number;
  razonSocial: string;
  numDoc: string;
}
