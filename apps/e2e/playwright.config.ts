import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/** Raíz del monorepo: los servidores se levantan desde ahí con `npm run dev -w …`. */
const RAIZ = path.resolve(__dirname, "../..");

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  globalSetup: "./global-setup.ts",
  // Dentro de un archivo las pruebas van en orden; los archivos corren en paralelo (ver README de e2e en el informe).
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // En local, ningún reintento oculta un fallo. En CI, uno: sirve para medir inestabilidad y deja la traza.
  retries: process.env.CI ? 1 : 0,
  // SQLite serializa las escrituras; 4 procesos en paralelo son estables (se verificó con corridas repetidas).
  workers: process.env.CI ? 2 : 4,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "es-PE",
    timezoneId: "America/Lima",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // Inicia sesión una vez por rol y guarda la sesión en .auth/<cuenta>.json.
    { name: "setup", testDir: ".", testMatch: /auth\.setup\.ts/ },
    { name: "Escritorio", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
    // El vendedor registra pedidos desde el celular.
    { name: "Celular", use: { ...devices["Pixel 7"] }, dependencies: ["setup"] },
  ],

  webServer: [
    {
      command: "npm run dev -w apps/api",
      cwd: RAIZ,
      url: "http://localhost:3000/api/salud",
      reuseExistingServer: true,
      timeout: 120_000,
      // Las pruebas inician sesión muchas veces desde la misma IP (login.spec y el setup, en dos proyectos).
      env: { LIMITE_LOGIN: "1000" },
    },
    {
      command: "npm run dev -w apps/web",
      cwd: RAIZ,
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
