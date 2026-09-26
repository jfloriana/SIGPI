import { expect, test as setup } from "@playwright/test";
import { CLAVE_DEMO, CUENTAS, sesion, type Cuenta } from "./support/cuentas";
import { iniciarSesion } from "./support/ui";

// Una sesión por cuenta, guardada con storageState: las pruebas no repiten el login.
for (const cuenta of Object.keys(CUENTAS) as Cuenta[]) {
  setup(`sesión de ${cuenta}`, async ({ page }) => {
    const { email, inicio } = CUENTAS[cuenta];
    await page.goto("/login");
    await iniciarSesion(page, email, CLAVE_DEMO);
    await expect(page).toHaveURL(inicio);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.context().storageState({ path: sesion(cuenta) });
  });
}
