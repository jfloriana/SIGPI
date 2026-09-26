import { expect, test } from "@playwright/test";
import { Api } from "../support/api";
import { sesion } from "../support/cuentas";
import { notificacion, usarCuenta } from "../support/ui";

/**
 * Producto en alerta sin orden en curso, uno por proyecto (ambos corren a la vez).
 * Los dos se compran a Alimentos Costa Norte.
 */
const PRODUCTO: Record<string, string> = { Escritorio: "ACE-003", Celular: "LAC-003" };
const PROVEEDOR = "Alimentos Costa Norte";

test.use({ storageState: sesion("gerente") });

test("alerta en el tablero → OC sugerida → aprobar → recepcionar → el producto sale de la alerta", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const api = await Api.como("gerente");
  const producto = await api.producto(PRODUCTO[testInfo.project.name]);
  await api.cerrar();
  expect(producto.stock, "el seed deja el producto en alerta").toBeLessThanOrEqual(producto.stockMinimo);
  const sugerida = producto.stockMinimo * 2 - producto.stock;

  const alertasTablero = () =>
    page.locator("section").filter({ has: page.getByRole("heading", { name: "Productos en alerta de stock" }) });
  let ocId = 0;
  let ocCodigo = "";

  await test.step("el producto aparece en alerta en el tablero", async () => {
    await page.goto("/tablero");
    await expect(alertasTablero().getByRole("row").filter({ hasText: producto.codigo })).toBeVisible();
  });

  await test.step("el gerente genera la orden de compra sugerida", async () => {
    await page.goto("/alertas");
    await page.getByRole("checkbox", { name: `Incluir ${producto.codigo} en la orden sugerida` }).check();
    await page.getByRole("link", { name: "Generar orden de compra sugerida (1)" }).click();

    const formulario = page.getByRole("dialog", { name: "Orden de compra sugerida" });
    await expect(formulario).toBeVisible();
    await expect(formulario.getByRole("heading", { name: "Productos (1)" })).toBeVisible();
    await expect(formulario.getByText(producto.nombre)).toBeVisible();
    // Cantidad sugerida = mínimo × 2 − stock.
    await expect(formulario.getByLabel(`Cantidad de ${producto.codigo}`, { exact: true })).toHaveValue(String(sugerida));

    const proveedor = formulario.getByLabel("Proveedor");
    const opcion = proveedor.getByRole("option", { name: new RegExp(PROVEEDOR) });
    await expect(opcion).toHaveCount(1);
    await proveedor.selectOption((await opcion.getAttribute("value"))!);

    await formulario.getByRole("button", { name: "Crear orden de compra" }).click();
    await expect(page).toHaveURL(/[?&]oc=\d+/);
    ocId = Number(new URL(page.url()).searchParams.get("oc"));
  });

  await test.step("el gerente aprueba la orden", async () => {
    const panel = page.getByRole("dialog", { name: /^Orden de compra OC-\d+$/ });
    await expect(panel).toBeVisible();
    ocCodigo = (await panel.getByRole("heading", { level: 2 }).textContent())!.replace("Orden de compra ", "").trim();
    await expect(notificacion(page, `Orden ${ocCodigo} creada: queda PENDIENTE de aprobación`)).toBeVisible();
    await panel.getByRole("button", { name: "Aprobar orden" }).click();
    await expect(notificacion(page, `Orden ${ocCodigo} aprobada: el almacén ya puede recepcionarla`)).toBeVisible();
    await expect(panel.getByRole("button", { name: "Aprobar orden" })).toHaveCount(0);
  });

  await test.step("el almacenero la recepciona", async () => {
    await usarCuenta(page, "almacen");
    await page.goto(`/compras?oc=${ocId}`);
    const panel = page.getByRole("dialog", { name: `Orden de compra ${ocCodigo}` });
    await panel.getByRole("button", { name: "Recepcionar orden" }).click();
    const confirmar = page.getByRole("dialog", { name: `¿Recepcionar ${ocCodigo}?` });
    await expect(confirmar).toContainText(`Se sumarán ${sugerida} unidades a 1 producto`);
    await confirmar.getByRole("button", { name: "Sí, recepcionar" }).click();
    await expect(notificacion(page, `Orden ${ocCodigo} recepcionada: stock actualizado en 1 producto`)).toBeVisible();
    await expect(panel.getByText("Recepción registrada")).toBeVisible();
  });

  await test.step("el producto ya no está en alerta", async () => {
    await usarCuenta(page, "gerente");
    await page.goto("/alertas");
    await expect(page.getByRole("heading", { name: /productos? en alerta$/ })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: `Incluir ${producto.codigo} en la orden sugerida` })).toHaveCount(0);

    await page.goto("/tablero");
    await expect(alertasTablero().getByRole("row").nth(1)).toBeVisible();
    await expect(alertasTablero().getByRole("row").filter({ hasText: producto.codigo })).toHaveCount(0);
  });
});
