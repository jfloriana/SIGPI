import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.ts";
import { errorHandler, rutaNoEncontrada } from "./middlewares/errorHandler.ts";
import { authRouter } from "./modules/auth/routes.ts";

export function crearApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigen, exposedHeaders: ["Content-Disposition"] }));
  app.use(express.json({ limit: "200kb" }));

  const api = express.Router();
  api.get("/salud", (_req, res) => {
    res.json({ estado: "ok" });
  });
  api.use("/auth", authRouter);
  app.use("/api", api);

  app.use(rutaNoEncontrada);
  app.use(errorHandler);
  return app;
}
