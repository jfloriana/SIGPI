import { expect, test } from "@playwright/test";
import { sesion } from "../support/cuentas";
import { menuPrincipal } from "../support/ui";

test.use({ storageState: sesion("vendedor1") });

test.describe("Permisos del vendedor", () => {
  test("el menú no muestra Usuarios, Bitácora ni Tablero", async ({ page }) => {
    await page.goto("/pedidos/nuevo");
    const menu = await menuPrincipal(page);

    await expect(menu.getByRole("link", { name: "Nuevo pedido", exact: true })).toBeVisible();
    for (const opcion of ["Usuarios", "Bitácora", "Tablero"]) {
      await expect(menu.getByRole("link", { name: opcion, exact: true })).toHaveCount(0);
    }
  });

  for (const ruta of ["/bitacora", "/usuarios", "/tablero"]) {
    test(`navegar directo a ${ruta} muestra «Acceso denegado»`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page.getByRole("heading", { level: 1, name: "Acceso denegado" })).toBeVisible();
      await expect(page.getByText("Su rol (Vendedor) no tiene permiso para ver esta pantalla")).toBeVisible();
      await expect(page.getByRole("link", { name: "Ir a mi pantalla de inicio" })).toBeVisible();
    });
  }
});
