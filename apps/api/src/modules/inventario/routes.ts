import { Router } from "express";
import { autenticar } from "../../middlewares/auth.ts";
import { requireRol } from "../../middlewares/requireRol.ts";
import { contextoDe } from "../../utils/consultas.ts";
import { ROLES } from "../../utils/roles.ts";
import { ajusteSchema, kardexSchema, productoIdParamSchema } from "./schemas.ts";
import * as servicio from "./service.ts";

const { ADMIN, GERENTE, ALMACENERO } = ROLES;

export const inventarioRouter = Router();
inventarioRouter.use(autenticar);

inventarioRouter.get("/kardex/:productoId", requireRol(ADMIN, GERENTE, ALMACENERO), async (req, res) => {
  const { productoId } = productoIdParamSchema.parse(req.params);
  res.json(await servicio.kardex(productoId, kardexSchema.parse(req.query)));
});

inventarioRouter.get("/alertas", requireRol(ADMIN, GERENTE, ALMACENERO), async (_req, res) => {
  const datos = await servicio.alertas();
  res.json({ datos, total: datos.length });
});

inventarioRouter.post("/ajustes", requireRol(ADMIN, ALMACENERO), async (req, res) => {
  const datos = ajusteSchema.parse(req.body);
  res.status(201).json(await servicio.registrarAjuste(datos, contextoDe(req)));
});
