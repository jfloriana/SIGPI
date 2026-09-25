import { Router } from "express";
import { autenticar } from "../../middlewares/auth.ts";
import { requireRol } from "../../middlewares/requireRol.ts";
import { ROLES } from "../../utils/roles.ts";
import { idParamSchema } from "../../utils/validadores.ts";
import { listarBitacoraSchema } from "./schemas.ts";
import * as servicio from "./service.ts";

const { ADMIN, GERENTE } = ROLES;

// Solo lectura (regla 17): no existen rutas POST/PUT/PATCH/DELETE; cualquier otro método responde 404.
export const bitacoraRouter = Router();
bitacoraRouter.use(autenticar, requireRol(ADMIN, GERENTE));

bitacoraRouter.get("/", async (req, res) => {
  res.json(await servicio.listar(listarBitacoraSchema.parse(req.query)));
});

bitacoraRouter.get("/filtros", async (_req, res) => {
  res.json(await servicio.filtros());
});

bitacoraRouter.get("/:id", async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await servicio.obtener(id));
});
