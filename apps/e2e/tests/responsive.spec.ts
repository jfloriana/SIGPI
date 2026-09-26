import { expect, test, type Page } from "@playwright/test";
import { Api } from "../support/api";
import { sesion } from "../support/cuentas";
import { agregarProducto, elegirCliente } from "../support/pedido";

test.use({ storageState: sesion("vendedor1") });

/** Ancho que sobra a la derecha: 0 si la página no tiene desplazamiento horizontal. */
function desborde(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test("«Nuevo pedido» en el celular: sin desplazamiento horizontal y con los botones principales visibles", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "Celular", "Solo aplica al proyecto Celular");

  await page.goto("/pedidos/nuevo");
  await expect(page.getByRole("heading", { level: 1, name: "Nuevo pedido" })).toBeVisible();
  await expect.poll(() => desborde(page)).toBe(0);

  const registrar = page.getByRole("button", { name: "Registrar pedido" });
  await expect(registrar).toBeVisible();
  await expect(registrar).toBeInViewport();
  await expect(page.getByRole("button", { name: "Abrir menú" })).toBeInViewport();
  await expect(page.getByRole("combobox", { name: "Buscar cliente" })).toBeVisible();

  // Con cliente y productos cargados (nombres largos) tampoco se desborda.
  const api = await Api.como("vendedor1");
  const cliente = await api.clienteActivo();
  const producto = await api.producto("BEB-008");
  await api.cerrar();
  await elegirCliente(page, cliente);
  await agregarProducto(page, producto, 2);
  await expect.poll(() => desborde(page)).toBe(0);

  // El botón de registrar queda fijo abajo aunque se desplace la página.
  await page.getByRole("radio", { name: "Crédito" }).scrollIntoViewIfNeeded();
  await expect(registrar).toBeInViewport();
  await expect(page.getByRole("button", { name: `Quitar ${producto.nombre} del pedido` })).toBeVisible();
  await expect(page.getByRole("button", { name: `Agregar una unidad de ${producto.nombre}` })).toBeVisible();
});
