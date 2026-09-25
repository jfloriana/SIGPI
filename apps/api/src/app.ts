import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.ts";
import { errorHandler, rutaNoEncontrada } from "./middlewares/errorHandler.ts";
import { authRouter } from "./modules/auth/routes.ts";
import { bitacoraRouter } from "./modules/bitacora/routes.ts";
import { categoriasRouter } from "./modules/categorias/routes.ts";
import { clientesRouter } from "./modules/clientes/routes.ts";
import { ordenesCompraRouter } from "./modules/compras/routes.ts";
import { inventarioRouter } from "./modules/inventario/routes.ts";
import { pedidosRouter } from "./modules/pedidos/routes.ts";
import { productosRouter } from "./modules/productos/routes.ts";
import { proveedoresRouter } from "./modules/proveedores/routes.ts";
import { reportesRouter } from "./modules/reportes/routes.ts";
import { usuariosRouter } from "./modules/usuarios/routes.ts";

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
  api.use("/usuarios", usuariosRouter);
  api.use("/clientes", clientesRouter);
  api.use("/categorias", categoriasRouter);
  api.use("/productos", productosRouter);
  api.use("/proveedores", proveedoresRouter);
  api.use("/pedidos", pedidosRouter);
  api.use("/inventario", inventarioRouter);
  api.use("/ordenes-compra", ordenesCompraRouter);
  api.use("/reportes", reportesRouter);
  api.use("/bitacora", bitacoraRouter);
  app.use("/api", api);

  app.use(rutaNoEncontrada);
  app.use(errorHandler);
  return app;
}
