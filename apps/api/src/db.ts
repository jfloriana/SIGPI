import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";
import { config } from "./config.ts";
import { esSqlite } from "./urlBaseDatos.ts";

// Prisma 7 se conecta mediante un adaptador; se elige según la URL (SQLite local o PostgreSQL/Supabase).
function crearAdaptador(url: string) {
  if (esSqlite(url)) return new PrismaBetterSqlite3({ url, timeout: 10_000 });
  return new PrismaPg({ connectionString: url });
}

export const prisma = new PrismaClient({ adapter: crearAdaptador(config.databaseUrl) });

/** Cliente de transacción interactiva (`prisma.$transaction(async (tx) => …)`). */
export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
/** Acepta tanto el cliente global como uno de transacción. */
export type Db = typeof prisma | Tx;
