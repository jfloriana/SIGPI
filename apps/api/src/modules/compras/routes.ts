import { Router } from "express";
import { autenticar } from "../../middlewares/auth.ts";
import { requireRol } from "../../middlewares/requireRol.ts";
import { contextoDe } from "../../utils/consultas.ts";
import { ROLES } from "../../utils/roles.ts";
import { idParamSchema } from "../../utils/validadores.ts";
import { anularOrdenSchema, crearOrdenSchema, listarOrdenesSchema, sugeridaSchema } from "./schemas.ts";
import * as servicio from "./service.ts";

const { ADMIN, GERENTE, ALMACENERO } = ROLES;
const R = servicio.ROLES_POR_ACCION_OC;

export const ordenesCompraRouter = Router();
ordenesCompraRouter.use(autenticar);

// Visibilidad: el almacenero solo ve órdenes APROBADAS y RECIBIDAS (la aplica el servicio).
ordenesCompraRouter.get("/", requireRol(ADMIN, GERENTE, ALMACENERO), async (req, res) => {
  res.json(await servicio.listar(listarOrdenesSchema.parse(req.query), contextoDe(req)));
});

// Antes de "/:id" para que "sugerida" no se tome como id (aunque es POST, se deja explícito).
ordenesCompraRouter.post("/sugerida", requireRol(ADMIN, GERENTE), async (req, res) => {
  res.json(await servicio.sugerida(sugeridaSchema.parse(req.body)));
});

ordenesCompraRouter.get("/:id", requireRol(ADMIN, GERENTE, ALMACENERO), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await servicio.obtener(id, contextoDe(req)));
});

ordenesCompraRouter.post("/", requireRol(ADMIN, GERENTE), async (req, res) => {
  const datos = crearOrdenSchema.parse(req.body);
  res.status(201).json(await servicio.crear(datos, contextoDe(req)));
});

ordenesCompraRouter.post("/:id/aprobar", requireRol(...R.aprobar), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await servicio.aprobar(id, contextoDe(req)));
});

ordenesCompraRouter.post("/:id/recepcionar", requireRol(...R.recepcionar), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await servicio.recepcionar(id, contextoDe(req)));
});

ordenesCompraRouter.post("/:id/anular", requireRol(...R.anular), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { motivo } = anularOrdenSchema.parse(req.body);
  res.json(await servicio.anular(id, motivo, contextoDe(req)));
});
