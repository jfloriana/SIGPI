import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { sesion } from "../support/cuentas";

/** Analiza la página con axe (reglas WCAG A/AA) y devuelve solo las violaciones serious o critical. */
async function violacionesGraves(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({ regla: v.id, impacto: v.impact, ayuda: v.help, nodos: v.nodes.map((n) => n.target.join(" ")) }));
}

test.describe("Accesibilidad (axe)", () => {
  test("login sin violaciones serious/critical", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1, name: "Iniciar sesión" })).toBeVisible();
    expect(await violacionesGraves(page)).toEqual([]);
  });

  test.describe("vendedor", () => {
    test.use({ storageState: sesion("vendedor1") });
    test("nuevo pedido sin violaciones serious/critical", async ({ page }) => {
      await page.goto("/pedidos/nuevo");
      await expect(page.getByRole("heading", { level: 1, name: "Nuevo pedido" })).toBeVisible();
      await expect(page.getByRole("combobox", { name: "Agregar producto" })).toBeVisible();
      expect(await violacionesGraves(page)).toEqual([]);
    });
  });

  test.describe("gerente", () => {
    test.use({ storageState: sesion("gerente") });
    test("tablero sin violaciones serious/critical", async ({ page }) => {
      await page.goto("/tablero");
      // Espera a que lleguen los datos: indicadores y tabla de alertas pintados.
      await expect(page.getByRole("region", { name: "Indicadores del período" }).getByRole("definition").first()).toHaveText(/S\//);
      await expect(page.getByRole("status", { name: /Cargando/ })).toHaveCount(0);
      expect(await violacionesGraves(page)).toEqual([]);
    });
  });
});
