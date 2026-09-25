import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errores.ts";

/** Convierte los errores de Zod en `{ campo: mensaje }` (el primer mensaje por campo). */
export function camposDeZod(error: ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of error.issues) {
    const clave = issue.path.join(".") || "_";
    campos[clave] ??= issue.message;
  }
  return campos;
}

export function rutaNoEncontrada(req: Request, res: Response) {
  res.status(404).json({ error: { codigo: "RUTA_NO_ENCONTRADA", mensaje: `No existe ${req.method} ${req.path}` } });
}

// Formato uniforme: { error: { codigo, mensaje, campos? } }
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { codigo: err.codigo, mensaje: err.message, ...(err.campos && { campos: err.campos }), ...err.extra },
    });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { codigo: "VALIDACION", mensaje: "Revise los datos ingresados", campos: camposDeZod(err) },
    });
    return;
  }
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: { codigo: "JSON_INVALIDO", mensaje: "El cuerpo de la solicitud no es JSON válido" } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { codigo: "ERROR_INTERNO", mensaje: "Ocurrió un error inesperado en el servidor" } });
}
