// Despliega el esquema y los datos de demostración a Supabase/PostgreSQL.
//
// El repositorio se queda en SQLite (desarrollo offline + `npm test`); este script
// convierte temporalmente el provider a postgresql, sincroniza y siembra la nube,
// y al final restaura SQLite y regenera el cliente local.
//
// Modos:
//   local (por defecto): generate PG + db push + seed contra la nube, luego restaura.
//     Requiere DATABASE_URL_NUBE (pooler 6543) y DIRECT_URL_NUBE (directa 5432).
//   Render (NUBE_SOLO_GENERAR=1): solo convierte el provider y genera el cliente PG,
//     sin tocar la base (ya sincronizada) y SIN restaurar, porque la app en ejecución
//     necesita el cliente Postgres. La conexión directa (5432) no es alcanzable desde
//     Render, así que el DDL/seed se hace desde local.
//     Build Command en Render: npm install && NUBE_SOLO_GENERAR=1 npm run nube
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const SOLO_GENERAR = process.env.NUBE_SOLO_GENERAR === "1";

const RUTA_SCHEMA = "prisma/schema.prisma";
const original = readFileSync(RUTA_SCHEMA, "utf8");
if (!original.includes('provider = "sqlite"')) {
  console.error("El schema ya no usa sqlite; se aborta para no pisar un cambio manual.");
  process.exit(1);
}

function correr(comando, envExtra = {}) {
  execSync(comando, { stdio: "inherit", env: { ...process.env, ...envExtra } });
}

writeFileSync(RUTA_SCHEMA, original.replace('provider = "sqlite"', 'provider = "postgresql"'));
correr("npx prisma generate");

if (SOLO_GENERAR) {
  console.log("Cliente Postgres generado (modo Render; schema queda en postgresql).");
  process.exit(0);
}

const { DATABASE_URL_NUBE, DIRECT_URL_NUBE } = process.env;
if (!DATABASE_URL_NUBE || !DIRECT_URL_NUBE) {
  writeFileSync(RUTA_SCHEMA, original);
  correr("npx prisma generate");
  console.error("Faltan DATABASE_URL_NUBE y DIRECT_URL_NUBE en el entorno (ver README).");
  process.exit(1);
}

try {
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
