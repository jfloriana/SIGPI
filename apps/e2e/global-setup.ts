import { execSync } from "node:child_process";
import path from "node:path";

/**
 * Reinicia la base de desarrollo con el seed (vacía las tablas y recarga los datos de demostración)
 * para que cada corrida parta del mismo estado. No usa `prisma db push --force-reset`.
 */
export default function globalSetup() {
  const raiz = path.resolve(__dirname, "../..");
  execSync("npm run seed -w apps/api", { cwd: raiz, stdio: "inherit" });
}
