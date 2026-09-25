import type { Db } from "../db.ts";

export type AccionBitacora =
  | "LOGIN_OK"
  | "LOGIN_FALLIDO"
  | "CREAR"
  | "EDITAR"
  | "DESACTIVAR"
  | "CAMBIO_ESTADO"
  | "ANULAR"
  | "AJUSTE"
  | "RECEPCION";

export interface DatosAuditoria {
  usuarioId: number | null;
  accion: AccionBitacora;
  entidad: string;
  entidadId?: string | number | null;
  antes?: unknown;
  despues?: unknown;
  ip?: string | null;
}

// Campos que nunca deben quedar en la bitácora.
const CAMPOS_SENSIBLES = new Set(["hashClave", "clave", "password"]);

function limpiar(valor: unknown): unknown {
  if (valor === undefined) return null;
  return JSON.parse(JSON.stringify(valor, (clave, v) => (CAMPOS_SENSIBLES.has(clave) ? undefined : v)));
}

/**
 * Servicio central de trazabilidad. Se llama con el cliente de la MISMA transacción
 * que la operación auditada: si la operación se revierte, el registro también.
 */
export async function auditar(tx: Db, datos: DatosAuditoria) {
  return tx.bitacora.create({
    data: {
      usuarioId: datos.usuarioId,
      accion: datos.accion,
      entidad: datos.entidad,
      entidadId: datos.entidadId == null ? null : String(datos.entidadId),
      detalle: JSON.stringify({ antes: limpiar(datos.antes), despues: limpiar(datos.despues) }),
      ip: datos.ip ?? null,
    },
  });
}
