import { expect, test } from "@playwright/test";
import { Api, type ProductoApi } from "../support/api";
import { CUENTAS, sesion } from "../support/cuentas";
import { agregarProducto, elegirCliente, elegirCondicion } from "../support/pedido";
import { formatoNumero, notificacion, usarCuenta } from "../support/ui";

/**
 * Productos y cantidades por proyecto: Escritorio y Celular corren a la vez y cada uno verifica
 * el stock de sus propios productos (ninguna otra prueba los mueve).
 */
const LINEAS: Record<string, { codigo: string; cantidad: number }[]> = {
  Escritorio: [
    { codigo: "ARR-004", cantidad: 3 },
    { codigo: "ACE-001", cantidad: 2 },
    { codigo: "AZU-003", cantidad: 5 },
    { codigo: "LAC-001", cantidad: 4 },
    { codigo: "FID-001", cantidad: 6 },
  ],
  Celular: [
    { codigo: "ARR-003", cantidad: 2 },
    { codigo: "ACE-006", cantidad: 3 },
    { codigo: "AZU-004", cantidad: 4 },
    { codigo: "LAC-005", cantidad: 5 },
    { codigo: "FID-002", cantidad: 6 },
  ],
};

test.use({ storageState: sesion("vendedor1") });

test("guion de la demostración: registrar a crédito → aprobar → despachar → kardex → entregar → bitácora", async ({ page }, testInfo) => {
  test.setTimeout(180_000);

  // Datos de referencia leídos por la API (stock antes del despacho, cliente, nombres de usuario).
  const almacenApi = await Api.como("almacen");
  const vendedorApi = await Api.como("vendedor1");
  const adminApi = await Api.como("admin");
  const lineas: { producto: ProductoApi; cantidad: number }[] = [];
  for (const l of LINEAS[testInfo.project.name]) lineas.push({ producto: await almacenApi.producto(l.codigo), cantidad: l.cantidad });
  const cliente = await vendedorApi.clienteActivo();
  const usuarios = await adminApi.get<{ datos: { nombre: string; email: string }[] }>("/usuarios?pageSize=100");
  const nombreDe = (email: string) => usuarios.datos.find((u) => u.email === email)!.nombre;
  await Promise.all([almacenApi.cerrar(), vendedorApi.cerrar(), adminApi.cerrar()]);

  let pedidoId = 0;
  let codigo = "";

  await test.step("el vendedor registra un pedido a crédito de 5 productos", async () => {
    await page.goto("/pedidos/nuevo");
    await expect(page.getByRole("heading", { level: 1, name: "Nuevo pedido" })).toBeVisible();
    await elegirCliente(page, cliente);
    for (const l of lineas) await agregarProducto(page, l.producto, l.cantidad);
    await expect(page.getByRole("list", { name: "Líneas del pedido" }).getByRole("listitem")).toHaveCount(5);
    await elegirCondicion(page, "Crédito");
    await expect(page.getByText("Este pedido quedará pendiente de aprobación del gerente.")).toBeVisible();

    await page.getByRole("button", { name: "Registrar pedido" }).click();

    await expect(page).toHaveURL(/\/pedidos\/\d+$/);
    pedidoId = Number(new URL(page.url()).pathname.split("/").pop());
    const titulo = page.getByRole("heading", { level: 1, name: /^Pedido PED-\d+$/ });
    await expect(titulo).toBeVisible();
    codigo = (await titulo.textContent())!.replace("Pedido ", "").trim();
    await expect(notificacion(page, `Pedido ${codigo} registrado (Pendiente de aprobación)`)).toBeVisible();
    await expect(page.getByText("Registrado", { exact: true }).first()).toBeVisible();
    // Quien registra no aprueba ni despacha.
    await expect(page.getByRole("button", { name: "Aprobar pedido" })).toHaveCount(0);
  });

  await test.step("el gerente lo aprueba", async () => {
    await usarCuenta(page, "gerente");
    await page.goto(`/pedidos/${pedidoId}`);
    await expect(page.getByRole("heading", { level: 1, name: `Pedido ${codigo}` })).toBeVisible();
    await page.getByRole("button", { name: "Aprobar pedido" }).click();
    await expect(notificacion(page, `Pedido ${codigo} aprobado`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Aprobar pedido" })).toHaveCount(0);
  });

  await test.step("el almacenero lo despacha desde la cola", async () => {
    await usarCuenta(page, "almacen");
    await page.goto("/despacho");
    await page.getByRole("button", { name: `Despachar ${codigo}` }).click();

    const dialogo = page.getByRole("dialog", { name: `Despachar ${codigo}` });
    await expect(dialogo).toBeVisible();
    for (const l of lineas) {
      await expect(dialogo.getByRole("listitem").filter({ hasText: l.producto.codigo })).toContainText(`−${l.cantidad}`);
    }
    await dialogo.getByRole("button", { name: "Confirmar despacho" }).click();
    await expect(notificacion(page, `Pedido ${codigo} despachado: se descontó el stock de 5 productos`)).toBeVisible();
    await expect(dialogo).toBeHidden();
    await expect(page.getByRole("button", { name: `Marcar entregado ${codigo}` })).toBeVisible();
  });

  await test.step("el kardex muestra el stock descontado en las cantidades del pedido", async () => {
    for (const { producto, cantidad } of lineas) {
      const esperado = producto.stock - cantidad;
      await page.goto(`/kardex?productoId=${producto.id}`);
      await expect(page.getByRole("heading", { level: 2, name: producto.nombre })).toBeVisible();
      await expect(
        page.getByText(`El stock cuadra con los movimientos: ${formatoNumero(esperado)} calculado = ${formatoNumero(esperado)} en stock.`),
      ).toBeVisible();
      const salida = page.getByRole("row").filter({ hasText: `Despacho ${codigo}` });
      await expect(salida).toHaveCount(1);
      await expect(salida).toContainText("Salida");
      await expect(salida).toContainText(`−${cantidad}`);
      await expect(salida).toContainText(formatoNumero(esperado));
    }
  });

  await test.step("se marca entregado", async () => {
    await page.goto("/despacho");
    await page.getByRole("button", { name: `Marcar entregado ${codigo}` }).click();
    await expect(notificacion(page, `Pedido ${codigo} marcado como entregado`)).toBeVisible();
    await expect(page.getByRole("button", { name: `Marcar entregado ${codigo}` })).toHaveCount(0);
  });

  await test.step("el admin ve en la bitácora cada cambio de estado", async () => {
    await usarCuenta(page, "admin");
    await page.goto(`/bitacora?entidad=Pedido&entidadId=${pedidoId}`);
    await expect(page.getByText(`Historia completa de pedido #${pedidoId}`)).toBeVisible();
    await expect(page.getByText("4 registros, del más reciente al más antiguo")).toBeVisible();

    const filas = page.getByRole("row");
    const creacion = filas.filter({ hasText: `${codigo} · Crédito` });
    await expect(creacion).toHaveCount(1);
    await expect(creacion).toContainText(nombreDe(CUENTAS.vendedor1.email));

    const cambios = [
      { de: "REGISTRADO", a: "APROBADO", quien: CUENTAS.gerente.email },
      { de: "APROBADO", a: "DESPACHADO", quien: CUENTAS.almacen.email },
      { de: "DESPACHADO", a: "ENTREGADO", quien: CUENTAS.almacen.email },
    ];
    await expect(filas.filter({ hasText: "Cambio de estado" })).toHaveCount(cambios.length);
    for (const c of cambios) {
      const fila = filas.filter({ hasText: `estado: ${c.de} → ${c.a}` });
      await expect(fila).toHaveCount(1);
      await expect(fila).toContainText("Cambio de estado");
      await expect(fila).toContainText(nombreDe(c.quien));
    }
  });
});
