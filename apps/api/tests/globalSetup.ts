import { execSync } from "node:child_process";

// Crea o sincroniza el esquema (los datos se reinician con sembrar()) en prisma/test.db antes de correr las pruebas.
export default function () {
  execSync("npx prisma db push", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:./prisma/test.db", DIRECT_URL: "" },
  });
}
