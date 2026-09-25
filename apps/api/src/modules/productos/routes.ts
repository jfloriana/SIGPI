import { Router } from "express";
import { autenticar } from "../../middlewares/auth.ts";
import { requireRol } from "../../middlewares/requireRol.ts";
import { contextoDe } from "../../utils/consultas.ts";
import { ROLES } from "../../utils/roles.ts";
import { idParamSchema } from "../../utils/validadores.ts";
import { crearProductoSchema, editarProductoSchema, listarProductosSchema } from "./schemas.ts";
import * as servicio from "./service.ts";

const { ADMIN, GERENTE, VENDEDOR, ALMACENERO } = ROLES;

export const productosRouter = Router();
productosRouter.use(autenticar);

productosRouter.get("/", requireRol(ADMIN, GERENTE, VENDEDOR, ALMACENERO), async (req, res) => {
  res.json(await servicio.listar(listarProductosSchema.parse(req.query)));
});

productosRouter.get("/:id", requireRol(ADMIN, GERENTE, VENDEDOR, ALMACENERO), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await servicio.obtener(id));
});

productosRouter.post("/", requireRol(ADMIN), async (req, res) => {
  servicio.rechazarStock(req.body);
  const datos = crearProductoSchema.parse(req.body);
  res.status(201).json(await servicio.crear(datos, contextoDe(req)));
});

productosRouter.patch("/:id", requireRol(ADMIN), async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  servicio.rechazarStock(req.body);
  const datos = editarProductoSchema.parse(req.body);
  res.json(await servicio.actualizar(id, datos, contextoDe(req)));
});
