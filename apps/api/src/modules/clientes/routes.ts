import { Router } from "express";
import { autenticar } from "../../middlewares/auth.ts";
import { requireRol } from "../../middlewares/requireRol.ts";
import { contextoDe } from "../../utils/consultas.ts";
import { ROLES } from "../../utils/roles.ts";
import { idParamSchema } from "../../utils/validadores.ts";
import { crearClienteSchema, editarClienteSchema, listarClientesSchema } from "./schemas.ts";
import * as servicio from "./service.ts";

const { ADMIN, GERENTE, VENDEDOR, ALMACENERO } = ROLES;

export const clientesRouter = Router();
clientesRouter.use(autenticar);

clientesRouter.get("/", requireRol(ADMIN, GERENTE, VENDEDOR, ALMACENERO), async (req, res) => {
  res.json(await servicio.listar(listarClientesSchema.parse(req.query)));
});

clientesRouter.get("/:id", requireRol(ADMIN, GERENTE, VENDEDOR, ALMACENERO), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await servicio.obtener(id));
});

clientesRouter.post("/", requireRol(ADMIN, VENDEDOR), async (req, res) => {
  const datos = crearClienteSchema.parse(req.body);
  res.status(201).json(await servicio.crear(datos, contextoDe(req)));
});

// VENDEDOR puede editar, pero el servicio responde 403 si envía `activo`.
clientesRouter.patch("/:id", requireRol(ADMIN, VENDEDOR), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const datos = editarClienteSchema.parse(req.body);
  res.json(await servicio.actualizar(id, datos, contextoDe(req)));
});
