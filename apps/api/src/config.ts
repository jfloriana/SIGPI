import "dotenv/config";
import { resolverUrlBaseDatos } from "./urlBaseDatos.ts";

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre} (vea apps/api/.env.example)`);
  return valor;
}

export const config = {
  databaseUrl: resolverUrlBaseDatos(process.env.DATABASE_URL ?? "file:./prisma/dev.db"),
  jwtSecret: requerida("JWT_SECRET"),
  jwtExpiracion: "8h" as const,
  puerto: Number(process.env.PORT ?? 3000),
  corsOrigen: (process.env.CORS_ORIGEN ?? "http://localhost:5173").split(",").map((o) => o.trim()),
  rondasBcrypt: 10,
  maxIntentosFallidos: 5,
  minutosBloqueo: 15,
  limiteLogin: Number(process.env.LIMITE_LOGIN ?? 100),
};
