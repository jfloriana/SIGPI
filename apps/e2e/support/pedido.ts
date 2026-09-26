import { expect, type Page } from "@playwright/test";
import type { ClienteApi, ProductoApi } from "./api";
import { escapar } from "./ui";

/** Pantalla «Nuevo pedido»: busca el cliente por documento y lo elige. */
export async function elegirCliente(page: Page, cliente: ClienteApi) {
  await page.getByRole("combobox", { name: "Buscar cliente" }).fill(cliente.numDoc);
  await page.getByRole("option", { name: new RegExp(escapar(cliente.numDoc)) }).click();
  await expect(page.getByRole("button", { name: `Cambiar cliente (${cliente.razonSocial})` })).toBeVisible();
}

/** Agrega un producto por código y escribe la cantidad. */
export async function agregarProducto(page: Page, producto: ProductoApi, cantidad: number) {
  await page.getByRole("combobox", { name: "Agregar producto" }).fill(producto.codigo);
  await page.getByRole("option", { name: new RegExp(`\\(${escapar(producto.codigo)}\\)`) }).click();
  const campo = page.getByLabel(`Cantidad de ${producto.nombre}`, { exact: true });
  await campo.fill(String(cantidad));
  await expect(campo).toHaveValue(String(cantidad));
}

/** Elige la condición de pago (el radio es visualmente oculto; se pulsa su etiqueta). */
export async function elegirCondicion(page: Page, condicion: "Contado" | "Crédito") {
  const radio = page.getByRole("radio", { name: condicion, exact: true });
  await page.locator("label").filter({ has: radio }).click();
  await expect(radio).toBeChecked();
}
