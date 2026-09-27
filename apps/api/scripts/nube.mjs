// Despliega el esquema y los datos de demostración a Supabase/PostgreSQL.
//
// El repositorio se queda en SQLite (desarrollo offline + `npm test`); este script
// convierte temporalmente el provider a postgresql, sincroniza y siembra la nube,
// y al final restaura SQLite y regenera el cliente local. En Render se usa como
// parte del comando de construcción; en local, para recargar la demo en la nube.
//
// Requiere en el entorno:
//   DATABASE_URL_NUBE  conexión del pooler (puerto 6543, con ?pgbouncer=true)
//   DIRECT_URL_NUBE    conexión directa (puerto 5432, para DDL y seed)
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const { DATABASE_URL_NUBE, DIRECT_URL_NUBE } = process.env;
if (!DATABASE_URL_NUBE || !DIRECT_URL_NUBE) {
  console.error("Faltan DATABASE_URL_NUBE y DIRECT_URL_NUBE en el entorno (ver README).");
  process.exit(1);
}

const RUTA_SCHEMA = "prisma/schema.prisma";
const original = readFileSync(RUTA_SCHEMA, "utf8");
if (!original.includes('provider = "sqlite"')) {
  console.error("El schema ya no usa sqlite; se aborta para no pisar un cambio manual.");
  process.exit(1);
}

function correr(comando, envExtra = {}) {
  execSync(comando, { stdio: "inherit", env: { ...process.env, ...envExtra } });
}

try {
  writeFileSync(RUTA_SCHEMA, original.replace('provider = "sqlite"', 'provider = "postgresql"'));
  correr("npx prisma generate");
  // DDL y seed por conexión directa: el pooler (pgbouncer en modo transacción)
  // no admite las transacciones interactivas que usa el seed.
  correr("npx prisma db push", { DIRECT_URL: DIRECT_URL_NUBE, DATABASE_URL: DIRECT_URL_NUBE });
  correr("npm run seed", { DIRECT_URL: DIRECT_URL_NUBE, DATABASE_URL: DIRECT_URL_NUBE });
  console.log("Nube sincronizada y sembrada (DATABASE_URL_NUBE = pooler para la app).");
} finally {
  writeFileSync(RUTA_SCHEMA, original);
  correr("npx prisma generate");
  console.log("Schema restaurado a sqlite.");
}
