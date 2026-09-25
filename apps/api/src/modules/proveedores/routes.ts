import { Router } from "express";
import { autenticar } from "../../middlewares/auth.ts";
import { requireRol } from "../../middlewares/requireRol.ts";
import { contextoDe } from "../../utils/consultas.ts";
import { ROLES } from "../../utils/roles.ts";
import { idParamSchema } from "../../utils/validadores.ts";
import { crearProveedorSchema, editarProveedorSchema, listarProveedoresSchema } from "./schemas.ts";
import * as servicio from "./service.ts";

const { ADMIN, GERENTE, ALMACENERO } = ROLES;

export const proveedoresRouter = Router();
proveedoresRouter.use(autenticar);

proveedoresRouter.get("/", requireRol(ADMIN, GERENTE, ALMACENERO), async (req, res) => {
  res.json(await servicio.listar(listarProveedoresSchema.parse(req.query)));
});

proveedoresRouter.get("/:id", requireRol(ADMIN, GERENTE, ALMACENERO), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await servicio.obtener(id));
});

proveedoresRouter.post("/", requireRol(ADMIN, GERENTE), async (req, res) => {
  const datos = crearProveedorSchema.parse(req.body);
  res.status(201).json(await servicio.crear(datos, contextoDe(req)));
});

proveedoresRouter.patch("/:id", requireRol(ADMIN), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const datos = editarProveedorSchema.parse(req.body);
  res.json(await servicio.actualizar(id, datos, contextoDe(req)));
});
