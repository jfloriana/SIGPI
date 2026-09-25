// Crea apps/api/.env a partir de .env.example (con un JWT_SECRET aleatorio) si todavía no existe.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

if (!existsSync(".env")) {
  const secreto = randomBytes(48).toString("hex");
  const contenido = readFileSync(".env.example", "utf8").replace(/^JWT_SECRET=.*$/m, `JWT_SECRET="${secreto}"`);
  writeFileSync(".env", contenido);
  console.log("Se creó apps/api/.env con un JWT_SECRET aleatorio.");
}
