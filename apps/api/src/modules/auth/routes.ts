import { Router } from "express";
import rateLimit from "express-rate-limit";
import { config } from "../../config.ts";
import { autenticar } from "../../middlewares/auth.ts";
import { loginSchema } from "./schemas.ts";
import * as servicio from "./service.ts";

export const authRouter = Router();

// Límite de tasa por IP: frena la fuerza bruta (complementa el bloqueo por cuenta).
const limiteLogin = rateLimit({
  windowMs: 15 * 60_000,
  limit: config.limiteLogin,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { codigo: "DEMASIADOS_INTENTOS", mensaje: "Demasiados intentos desde esta red. Espere unos minutos" } },
});

authRouter.post("/login", limiteLogin, async (req, res) => {
  const datos = loginSchema.parse(req.body);
  res.json(await servicio.login(datos, req.ip ?? null));
});

authRouter.get("/me", autenticar, async (req, res) => {
  res.json({ usuario: await servicio.obtenerPerfil(req.usuario!.id) });
});
