import { z } from "zod";
import { paginacionSchema } from "../../utils/paginacion.ts";
import { buscarQuery, textoSchema } from "../../utils/validadores.ts";

export const listarCategoriasSchema = paginacionSchema.extend({ buscar: buscarQuery });

export const categoriaSchema = z.object({ nombre: textoSchema("el nombre", 60, 3) });

export type ListarCategorias = z.infer<typeof listarCategoriasSchema>;
export type DatosCategoria = z.infer<typeof categoriaSchema>;
