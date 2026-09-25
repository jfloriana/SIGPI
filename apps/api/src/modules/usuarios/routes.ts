import { Router } from "express";
import { autenticar } from "../../middlewares/auth.ts";
import { requireRol } from "../../middlewares/requireRol.ts";
import { contextoDe } from "../../utils/consultas.ts";
import { ROLES } from "../../utils/roles.ts";
import { idParamSchema } from "../../utils/validadores.ts";
import { crearUsuarioSchema, editarUsuarioSchema, listarUsuariosSchema } from "./schemas.ts";
import * as servicio from "./service.ts";

const { ADMIN, GERENTE } = ROLES;

export const usuariosRouter = Router();
usuariosRouter.use(autenticar);

usuariosRouter.get("/", requireRol(ADMIN, GERENTE), async (req, res) => {
  res.json(await servicio.listar(listarUsuariosSchema.parse(req.query)));
});

usuariosRouter.get("/:id", requireRol(ADMIN, GERENTE), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await servicio.obtener(id));
});

usuariosRouter.post("/", requireRol(ADMIN), async (req, res) => {
  const datos = crearUsuarioSchema.parse(req.body);
  res.status(201).json(await servicio.crear(datos, contextoDe(req)));
});

usuariosRouter.patch("/:id", requireRol(ADMIN), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const datos = editarUsuarioSchema.parse(req.body);
  res.json(await servicio.actualizar(id, datos, contextoDe(req)));
});
