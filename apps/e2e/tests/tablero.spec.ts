import { expect, test, type Page } from "@playwright/test";
import { sesion } from "../support/cuentas";

test.use({ storageState: sesion("gerente") });

const KPIS = ["Ventas del período", "Pedidos vendidos", "Ticket promedio", "Productos en alerta"];
const GRAFICOS = ["Ventas por día", "Productos más vendidos", "Pedidos por estado", "Ventas por vendedor", "Ventas por zona"];

/** Valor de un indicador (el <dd> que acompaña a su etiqueta). */
function kpi(page: Page, etiqueta: string) {
  return page
    .getByRole("region", { name: "Indicadores del período" })
    .locator("div")
    .filter({ has: page.getByRole("term").filter({ hasText: etiqueta }) })
    .getByRole("definition");
}

function tarjeta(page: Page, titulo: string) {
  return page.locator("section").filter({ has: page.getByRole("heading", { level: 2, name: titulo, exact: true }) });
}

test.describe("Tablero gerencial", () => {
  test("las 4 tarjetas KPI y los gráficos se renderizan con datos", async ({ page }) => {
    await page.goto("/tablero");
    await expect(page.getByRole("heading", { level: 1, name: "Tablero" })).toBeVisible();

    for (const etiqueta of KPIS) await expect(kpi(page, etiqueta)).toHaveCount(1);
    await expect(kpi(page, "Ventas del período")).toHaveText(/^S\/ [\d ]+\.\d{2}$/);
    await expect(kpi(page, "Ventas del período")).not.toHaveText("S/ 0.00");
    await expect(kpi(page, "Pedidos vendidos")).toHaveText(/^[1-9][\d ]*$/);
    await expect(kpi(page, "Ticket promedio")).toHaveText(/^S\/ [\d ]+\.\d{2}$/);
    await expect(kpi(page, "Productos en alerta")).toContainText(/\d+/);

    for (const titulo of GRAFICOS) {
      const t = tarjeta(page, titulo);
      await expect(t.locator("svg").first(), `gráfico «${titulo}»`).toBeVisible();
      // Cada gráfico tiene su tabla equivalente con al menos una fila de datos.
      await t.getByText("Ver datos en tabla").click();
      const tabla = t.getByRole("table");
      await expect(tabla).toBeVisible();
      await expect(tabla.getByRole("row").nth(1)).toBeVisible();
    }
  });

  test("el filtro de fechas cambia los valores", async ({ page }) => {
    await page.goto("/tablero");
    const ventas = kpi(page, "Ventas del período");
    const pedidos = kpi(page, "Pedidos vendidos");
    const periodo = page.getByText(/^Del \d{2}\/\d{2}\/\d{4} al \d{2}\/\d{2}\/\d{4} · \d+ días$/);

    await expect(page.getByRole("button", { name: "30 días" })).toHaveAttribute("aria-pressed", "true");
    await expect(periodo).toContainText("· 30 días");
    await expect(ventas).toHaveText(/^S\/ [\d ]+\.\d{2}$/);
    const ventas30 = (await ventas.textContent())!;
    const pedidos30 = (await pedidos.textContent())!;

    await page.getByRole("button", { name: "7 días" }).click();
    await expect(page.getByRole("button", { name: "7 días" })).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/rango=7/);
    await expect(periodo).toContainText("· 7 días");
    await expect(ventas).not.toHaveText(ventas30);
    await expect(pedidos).not.toHaveText(pedidos30);

    await page.getByRole("button", { name: "90 días" }).click();
    await expect(periodo).toContainText("· 90 días");
    await expect(ventas).not.toHaveText(ventas30);
  });
});
