import { defineConfig } from "vitest/config";

export default defineConfig({
  // root explícito: la ruta del proyecto contiene espacios.
  root: import.meta.dirname,
  test: {
    // Base de datos separada para las pruebas: nunca se toca dev.db.
    env: { DATABASE_URL: "file:./prisma/test.db", LIMITE_LOGIN: "1000" },
    globalSetup: ["./tests/globalSetup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
