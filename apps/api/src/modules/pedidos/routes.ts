import { Router } from "express";
import { autenticar } from "../../middlewares/auth.ts";
import { requireRol } from "../../middlewares/requireRol.ts";
import { contextoDe } from "../../utils/consultas.ts";
import { ROLES } from "../../utils/roles.ts";
import { idParamSchema } from "../../utils/validadores.ts";
import { anularSchema, crearPedidoSchema, listarPedidosSchema } from "./schemas.ts";
import * as servicio from "./service.ts";

const { ADMIN, GERENTE, VENDEDOR, ALMACENERO } = ROLES;
const R = servicio.ROLES_POR_ACCION;

export const pedidosRouter = Router();
pedidosRouter.use(autenticar);

// La visibilidad por rol (vendedor: solo los suyos; almacenero: aprobados/despachados/entregados) la aplica el servicio.
pedidosRouter.get("/", requireRol(ADMIN, GERENTE, VENDEDOR, ALMACENERO), async (req, res) => {
  res.json(await servicio.listar(listarPedidosSchema.parse(req.query), contextoDe(req)));
});

pedidosRouter.get("/:id", requireRol(ADMIN, GERENTE, VENDEDOR, ALMACENERO), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await servicio.obtener(id, contextoDe(req)));
});

pedidosRouter.post("/", requireRol(VENDEDOR), async (req, res) => {
  const datos = crearPedidoSchema.parse(req.body);
  res.status(201).json(await servicio.crear(datos, contextoDe(req)));
});

pedidosRouter.post("/:id/aprobar", requireRol(...R.aprobar), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await servicio.aprobar(id, contextoDe(req)));
});

pedidosRouter.post("/:id/despachar", requireRol(...R.despachar), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await servicio.despachar(id, contextoDe(req)));
});

pedidosRouter.post("/:id/entregar", requireRol(...R.entregar), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await servicio.entregar(id, contextoDe(req)));
});

pedidosRouter.post("/:id/anular", requireRol(...R.anular), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { motivo } = anularSchema.parse(req.body);
  res.json(await servicio.anular(id, motivo, contextoDe(req)));
});
