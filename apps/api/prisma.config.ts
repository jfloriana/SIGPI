import "dotenv/config";
import { defineConfig } from "prisma/config";
import { resolverUrlBaseDatos } from "./src/urlBaseDatos";

// Prisma 7: la URL de conexión ya no va en schema.prisma sino aquí.
// En PostgreSQL/Supabase las migraciones usan la conexión directa (DIRECT_URL, puerto 5432);
// la aplicación usa DATABASE_URL (pooler, puerto 6543).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: resolverUrlBaseDatos(process.env.DIRECT_URL || process.env.DATABASE_URL || "file:./prisma/dev.db"),
  },
});
