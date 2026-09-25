import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, ApiError } from "../../../api/cliente";
import { DialogoConfirmacion } from "../../../components/Dialogo";
import { useNotificar } from "../../../components/Notificaciones";
import { formatoNumero } from "../../../utils/formato";
import type { AccionPedido, PedidoDetalle } from "../tipos";

/** Texto de los botones: salen solo de `detalle.acciones` (la API decide qué puede hacer cada usuario). */
export const TEXTO_ACCION: Record<AccionPedido, string> = {
  aprobar: "Aprobar pedido",
  despachar: "Despachar",
  entregar: "Marcar entregado",
  anular: "Anular pedido",
};

const PROGRESO: Record<AccionPedido, string> = {
  aprobar: "Aprobando…",
  despachar: "Despachando…",
  entregar: "Registrando entrega…",
  anular: "Anulando…",
};

export const textoProgreso = (a: AccionPedido) => PROGRESO[a];

function mensajeExito(accion: AccionPedido, d: PedidoDetalle) {
  switch (accion) {
    case "aprobar":
      return `Pedido ${d.codigo} aprobado`;
    case "despachar": {
      const n = d.lineas.length;
      return `Pedido ${d.codigo} despachado: se descontó el stock de ${n} ${n === 1 ? "producto" : "productos"}`;
    }
    case "entregar":
      return `Pedido ${d.codigo} marcado como entregado`;
    case "anular":
      return `Pedido ${d.codigo} anulado`;
  }
}

/** Mensaje del servidor para mostrar dentro del diálogo (409, 422, 403 o validación del motivo). */
export function mensajeError(err: unknown): string {
  if (err instanceof ApiError) return err.campos?.motivo ?? err.message;
  return "No se pudo completar la acción. Intente de nuevo.";
}

interface VariablesAccion {
  id: number;
  accion: AccionPedido;
  motivo?: string;
}

/**
 * Ejecuta una acción sobre un pedido. La API devuelve el detalle actualizado: se guarda en la
 * caché del detalle (la pantalla se actualiza sin otra petición) y se refrescan las listas.
 */
export function useAccionPedido() {
  const qc = useQueryClient();
  const notificar = useNotificar();
  return useMutation({
    mutationFn: ({ id, accion, motivo }: VariablesAccion) =>
      api.post<PedidoDetalle>(`/pedidos/${id}/${accion}`, accion === "anular" ? { motivo } : undefined),
    onSuccess: (d, { accion }) => {
      qc.setQueryData(["pedido", d.id], d);
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      if (accion === "despachar") qc.invalidateQueries({ queryKey: ["productos"] });
      notificar(mensajeExito(accion, d));
    },
    onError: (err, { id }) => {
      // Otro usuario pudo cambiar el pedido: se relee para que los botones reflejen el estado real.
      if (err instanceof ApiError && [403, 409, 422].includes(err.status)) {
        qc.invalidateQueries({ queryKey: ["pedido", id] });
        qc.invalidateQueries({ queryKey: ["pedidos"] });
      }
    },
  });
}

export interface PedidoResumen {
  id: number;
  codigo: string;
}

/** Recuerda el último pedido para que el título no quede vacío mientras el diálogo se cierra. */
function useUltimo<T>(valor: T | null) {
  const [ultimo, setUltimo] = useState(valor);
  useEffect(() => {
    if (valor) setUltimo(valor);
  }, [valor]);
  return valor ?? ultimo;
}

/**
 * Confirmación de despacho: lista los productos y cantidades que se descontarán del stock.
 * Si se abre desde la cola (sin detalle), lo carga.
 */
export function DialogoDespacho({ pedido, alCerrar }: { pedido: PedidoResumen | null; alCerrar: () => void }) {
  const accion = useAccionPedido();
  const visible = useUltimo(pedido);
  const { reset } = accion;

  const detalle = useQuery({
    queryKey: ["pedido", visible?.id],
    queryFn: () => api.get<PedidoDetalle>(`/pedidos/${visible!.id}`),
    enabled: !!pedido,
  });

  useEffect(() => {
    if (pedido) reset();
  }, [pedido, reset]);

  const lineas = detalle.data?.lineas;

  return (
    <DialogoConfirmacion
      abierto={!!pedido}
      alCerrar={alCerrar}
      titulo={`Despachar ${visible?.codigo ?? ""}`}
      descripcion={
        <div className="space-y-2">
          <p>
            Se descontará del stock, en una sola operación
            {detalle.data ? <> (cliente {detalle.data.cliente.razonSocial})</> : null}:
          </p>
          {detalle.isPending && <p className="text-slate-500">Cargando productos…</p>}
          {detalle.isError && <p className="text-coral-700">{mensajeError(detalle.error)}</p>}
          {lineas && (
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-slate-800">
              {lineas.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block leading-snug">{l.producto.nombre}</span>
                    <span className="block text-xs font-semibold text-slate-500 tabular-nums">{l.producto.codigo}</span>
                  </span>
                  <span className="shrink-0 font-semibold whitespace-nowrap text-slate-900 tabular-nums">
                    −{formatoNumero(l.cantidad)} {l.producto.unidad}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p>Si algún producto ya no tiene stock suficiente, no se descuenta nada.</p>
        </div>
      }
      textoConfirmar={accion.isPending ? PROGRESO.despachar : "Confirmar despacho"}
      procesando={accion.isPending}
      error={accion.error ? mensajeError(accion.error) : null}
      alConfirmar={() => visible && accion.mutate({ id: visible.id, accion: "despachar" }, { onSuccess: alCerrar })}
    />
  );
}

/** Confirmación de anulación con motivo obligatorio (mínimo 10 caracteres, como exige la API). */
export function DialogoAnular({ pedido, alCerrar }: { pedido: PedidoResumen | null; alCerrar: () => void }) {
  const accion = useAccionPedido();
  const visible = useUltimo(pedido);
  const { reset } = accion;

  useEffect(() => {
    if (pedido) reset();
  }, [pedido, reset]);

  return (
    <DialogoConfirmacion
      abierto={!!pedido}
      alCerrar={alCerrar}
      titulo={`Anular ${visible?.codigo ?? ""}`}
      descripcion="El pedido pasará a ANULADO y no podrá reactivarse. El motivo queda en la bitácora."
      textoConfirmar={accion.isPending ? PROGRESO.anular : "Anular pedido"}
      tono="peligro"
      motivoMinimo={10}
      etiquetaMotivo="Motivo de la anulación"
      procesando={accion.isPending}
      error={accion.error ? mensajeError(accion.error) : null}
      alConfirmar={(motivo) => visible && accion.mutate({ id: visible.id, accion: "anular", motivo }, { onSuccess: alCerrar })}
    />
  );
}
