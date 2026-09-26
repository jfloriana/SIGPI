import { expect, test } from "@playwright/test";
import { Api } from "../support/api";
import { sesion } from "../support/cuentas";
import { agregarProducto, elegirCliente } from "../support/pedido";

// vendedor2: ninguna otra prueba registra pedidos con esta cuenta, así el conteo de sus pedidos es fiable.
test.use({ storageState: sesion("vendedor2") });

test("pedir más que el stock muestra el error del servidor y no crea el pedido", async ({ page }) => {
  const api = await Api.como("vendedor2");
  const producto = await api.producto("CON-002");
  const cliente = await api.clienteActivo();
  const antes = (await api.get<{ total: number }>("/pedidos?pageSize=1")).total;
  const solicitado = producto.stock + 5;

  await page.goto("/pedidos/nuevo");
  await expect(page.getByRole("heading", { level: 1, name: "Nuevo pedido" })).toBeVisible();
  await elegirCliente(page, cliente);
  await agregarProducto(page, producto, solicitado);
  // Aviso local previo: el servidor tiene la última palabra.
  await expect(page.getByText(/Supera el stock disponible/)).toBeVisible();

  const respuesta = page.waitForResponse((r) => r.url().endsWith("/api/pedidos") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Registrar pedido" }).click();
  expect((await respuesta).status()).toBe(409);

  const aviso = page.getByRole("alert").filter({ hasText: "No se registró el pedido" });
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText(
    `Stock insuficiente para ${producto.nombre} (${producto.codigo}): stock disponible ${producto.stock}, solicitado ${solicitado}`,
  );
  await expect(page.getByText(`Stock disponible: ${producto.stock}`, { exact: true })).toBeVisible();
  await expect(page.getByLabel(`Cantidad de ${producto.nombre}`, { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page).toHaveURL("/pedidos/nuevo");

  // No se creó nada.
  expect((await api.get<{ total: number }>("/pedidos?pageSize=1")).total).toBe(antes);
  await api.cerrar();
});
