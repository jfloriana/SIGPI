import { expect, test } from "@playwright/test";
import { Api } from "../support/api";
import { CLAVE_DEMO, CUENTAS } from "../support/cuentas";
import { iniciarSesion, menuPrincipal } from "../support/ui";

// Menú esperado por rol, en el orden en que se muestra (matriz de permisos de la especificación).
const CASOS = [
  {
    cuenta: "admin",
    titulo: "Tablero",
    menu: [
      "Tablero",
      "Pedidos",
      "Alertas de stock",
      "Productos",
      "Kardex",
      "Ajustes de inventario",
      "Proveedores y compras",
      "Clientes",
      "Usuarios",
      "Bitácora",
      "Acerca del sistema",
    ],
  },
  {
    cuenta: "gerente",
    titulo: "Tablero",
    menu: [
      "Tablero",
      "Pedidos",
      "Alertas de stock",
      "Productos",
      "Kardex",
      "Proveedores y compras",
      "Clientes",
      "Usuarios",
      "Bitácora",
      "Acerca del sistema",
    ],
  },
  {
    cuenta: "vendedor1",
    titulo: "Nuevo pedido",
    menu: ["Nuevo pedido", "Pedidos", "Productos", "Clientes", "Acerca del sistema"],
  },
  {
    cuenta: "almacen",
    titulo: "Cola de despacho",
    menu: [
      "Pedidos",
      "Cola de despacho",
      "Alertas de stock",
      "Productos",
      "Kardex",
      "Ajustes de inventario",
      "Proveedores y compras",
      "Clientes",
      "Acerca del sistema",
    ],
  },
] as const;

test.describe("Inicio de sesión", () => {
  for (const caso of CASOS) {
    const cuenta = CUENTAS[caso.cuenta];
    test(`${cuenta.rol} (${cuenta.email}) entra y ve el menú de su rol`, async ({ page }) => {
      await page.goto("/login");
      await iniciarSesion(page, cuenta.email, CLAVE_DEMO);

      await expect(page).toHaveURL(cuenta.inicio);
      await expect(page.getByRole("heading", { level: 1, name: caso.titulo })).toBeVisible();
      const menu = await menuPrincipal(page);
      await expect(menu.getByRole("link")).toHaveText([...caso.menu]);
    });
  }

  test("5 intentos fallidos muestran el mensaje de cuenta bloqueada", async ({ page }, testInfo) => {
    // Cuenta desechable: el bloqueo no afecta a las demás pruebas que corren en paralelo.
    const admin = await Api.como("admin");
    const email = `bloqueo.${testInfo.project.name.toLowerCase()}.${Date.now()}@distrinorte.pe`;
    await admin.post("/usuarios", { nombre: "Prueba Bloqueo E2E", email, clave: "Clave2026", rol: "VENDEDOR" });
    await admin.cerrar();

    await page.goto("/login");
    await page.getByLabel("Correo").fill(email);
    const clave = page.getByLabel("Contraseña", { exact: true });
    const ingresar = page.getByRole("button", { name: "Ingresar" });
    const alerta = page.getByRole("alert");

    async function intentar(texto: string) {
      await clave.fill(texto);
      const respuesta = page.waitForResponse((r) => r.url().endsWith("/api/auth/login"));
      await ingresar.click();
      return (await respuesta).status();
    }

    for (let i = 1; i <= 4; i++) {
      expect(await intentar(`Incorrecta${i}`)).toBe(401);
      await expect(alerta).toHaveText("Correo o contraseña incorrectos");
    }

    expect(await intentar("Incorrecta5")).toBe(423);
    await expect(alerta).toHaveText(/^Cuenta bloqueada por intentos fallidos hasta las \d{2}:\d{2}$/);

    // Bloqueada, ni la contraseña correcta deja entrar.
    expect(await intentar("Clave2026")).toBe(423);
    await expect(alerta).toContainText("Cuenta bloqueada por intentos fallidos");
    await expect(page).toHaveURL("/login");
  });
});
