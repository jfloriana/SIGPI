import { expect, type Page } from "@playwright/test";
import { tokenDe } from "./api";
import { APP_URL, type Cuenta } from "./cuentas";

/** Llena el formulario de login y pulsa «Ingresar» (no espera el resultado). */
export async function iniciarSesion(page: Page, email: string, clave: string) {
  await page.getByLabel("Correo").fill(email);
  // exact: el botón «Mostrar contraseña» también contiene la palabra.
  await page.getByLabel("Contraseña", { exact: true }).fill(clave);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

/**
 * Cambia la sesión de la pestaña a otra cuenta usando el token guardado por el setup
 * (equivale a que esa persona abra el sistema en su equipo). La siguiente navegación la aplica.
 */
export async function usarCuenta(page: Page, cuenta: Cuenta) {
  if (!page.url().startsWith(APP_URL)) await page.goto("/login");
  await page.evaluate((token) => localStorage.setItem("sigpi.token", token), tokenDe(cuenta));
}

/**
 * Devuelve el menú principal visible. En el celular el menú está en un panel que se abre con
 * «Abrir menú»; en escritorio es la barra lateral.
 */
export async function menuPrincipal(page: Page) {
  const abrir = page.getByRole("button", { name: "Abrir menú" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  if (await abrir.isVisible()) {
    await abrir.click();
    await expect(page.getByRole("dialog", { name: "Menú" })).toBeVisible();
  }
  const nav = page.getByRole("navigation", { name: "Menú principal" });
  await expect(nav).toBeVisible();
  return nav;
}

/** Notificación emergente (role=status) con el texto indicado. */
export function notificacion(page: Page, texto: string | RegExp) {
  return page.getByRole("status").filter({ hasText: texto });
}

/** Mismo formato que la aplicación: `12 480`. */
export function formatoNumero(n: number) {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Escapa un texto para usarlo dentro de una expresión regular. */
export function escapar(texto: string) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
