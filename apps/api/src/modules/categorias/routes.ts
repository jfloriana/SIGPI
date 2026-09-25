import { Router } from "express";
import { autenticar } from "../../middlewares/auth.ts";
import { requireRol } from "../../middlewares/requireRol.ts";
import { contextoDe } from "../../utils/consultas.ts";
import { ROLES } from "../../utils/roles.ts";
import { idParamSchema } from "../../utils/validadores.ts";
import { categoriaSchema, listarCategoriasSchema } from "./schemas.ts";
import * as servicio from "./service.ts";

const { ADMIN, GERENTE, VENDEDOR, ALMACENERO } = ROLES;

export const categoriasRouter = Router();
categoriasRouter.use(autenticar);

categoriasRouter.get("/", requireRol(ADMIN, GERENTE, VENDEDOR, ALMACENERO), async (req, res) => {
  res.json(await servicio.listar(listarCategoriasSchema.parse(req.query)));
});

categoriasRouter.get("/:id", requireRol(ADMIN, GERENTE, VENDEDOR, ALMACENERO), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await servicio.obtener(id));
});

categoriasRouter.post("/", requireRol(ADMIN), async (req, res) => {
  const datos = categoriaSchema.parse(req.body);
  res.status(201).json(await servicio.crear(datos, contextoDe(req)));
});

categoriasRouter.patch("/:id", requireRol(ADMIN), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const datos = categoriaSchema.parse(req.body);
  res.json(await servicio.actualizar(id, datos, contextoDe(req)));
});
