import { Router } from "express";
import { autenticar } from "../../middlewares/auth.ts";
import { requireRol } from "../../middlewares/requireRol.ts";
import { contextoDe } from "../../utils/consultas.ts";
import { ROLES } from "../../utils/roles.ts";
import { periodoSchema } from "./schemas.ts";
import * as servicio from "./service.ts";

const { ADMIN, GERENTE, VENDEDOR, ALMACENERO } = ROLES;

export const reportesRouter = Router();
reportesRouter.use(autenticar);

// El alcance depende del rol: TOTAL (gerente/admin), PROPIO (vendedor), STOCK (almacenero).
reportesRouter.get("/tablero", requireRol(ADMIN, GERENTE, VENDEDOR, ALMACENERO), async (req, res) => {
  res.json(await servicio.tablero(periodoSchema.parse(req.query), contextoDe(req)));
});

reportesRouter.get("/ventas.csv", requireRol(ADMIN, GERENTE, VENDEDOR), async (req, res) => {
  const { nombreArchivo, contenido } = await servicio.ventasCsv(periodoSchema.parse(req.query), contextoDe(req));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo}"`);
  res.send(contenido);
});
