import cors from "cors";
import express, { type Router } from "express";
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

/**
 * Módulos montados bajo /api. Es la única lista de montaje: la prueba de seguridad la recorre para
 * verificar que toda ruta (salvo POST /auth/login y GET /salud) exige token.
 */
export const MODULOS_API: [prefijo: string, router: Router][] = [
  ["/auth", authRouter],
  ["/usuarios", usuariosRouter],
  ["/clientes", clientesRouter],
  ["/categorias", categoriasRouter],
  ["/productos", productosRouter],
  ["/proveedores", proveedoresRouter],
  ["/pedidos", pedidosRouter],
  ["/inventario", inventarioRouter],
  ["/ordenes-compra", ordenesCompraRouter],
  ["/reportes", reportesRouter],
  ["/bitacora", bitacoraRouter],
];

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
  for (const [prefijo, router] of MODULOS_API) api.use(prefijo, router);
  app.use("/api", api);

  app.use(rutaNoEncontrada);
  app.use(errorHandler);
  return app;
}
