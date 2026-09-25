import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, LoaderCircle, PackageCheck, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { api } from "../../api/cliente";
import { ChipEstadoOrden, ChipStock } from "../../components/Chip";
import { Dialogo, DialogoConfirmacion } from "../../components/Dialogo";
import { Aviso, Cargando, EstadoError } from "../../components/Estados";
import { useNotificar } from "../../components/Notificaciones";
import { formatoFechaHora, formatoNumero, formatoSoles } from "../../utils/formato";
import { mensajeError, type OrdenDetalle, type RegistroHistorial } from "./tipos";

/** Detalle de una orden de compra (`?oc=<id>`): líneas, línea de tiempo y acciones que permite la API. */
export function PanelOrden({ id, alCerrar, veKardex }: { id: number; alCerrar: () => void; veKardex: boolean }) {
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const [confirmar, setConfirmar] = useState<"recepcionar" | "anular" | null>(null);
  const [recienRecibida, setRecienRecibida] = useState(false);

  const orden = useQuery({
    queryKey: ["ordenes-compra", "detalle", id],
    queryFn: () => api.get<OrdenDetalle>(`/ordenes-compra/${id}`),
  });

  async function actualizar(o: OrdenDetalle) {
    queryClient.setQueryData(["ordenes-compra", "detalle", id], o);
    // La recepción cambia stock, kardex, alertas y tablero: se refresca todo menos este detalle (ya actualizado).
    await queryClient.invalidateQueries({
      predicate: (q) => !(q.queryKey[0] === "ordenes-compra" && q.queryKey[1] === "detalle" && q.queryKey[2] === id),
    });
  }

  const aprobar = useMutation({
    mutationFn: () => api.post<OrdenDetalle>(`/ordenes-compra/${id}/aprobar`),
    onSuccess: async (o) => {
      notificar(`Orden ${o.codigo} aprobada: el almacén ya puede recepcionarla`);
      await actualizar(o);
    },
  });

  const recepcionar = useMutation({
    mutationFn: () => api.post<OrdenDetalle>(`/ordenes-compra/${id}/recepcionar`),
    onSuccess: async (o) => {
      notificar(`Orden ${o.codigo} recepcionada: stock actualizado en ${o.lineas.length} ${o.lineas.length === 1 ? "producto" : "productos"}`);
      setConfirmar(null);
      setRecienRecibida(true);
      await actualizar(o);
    },
  });

  const anular = useMutation({
    mutationFn: (motivo: string) => api.post<OrdenDetalle>(`/ordenes-compra/${id}/anular`, { motivo }),
    onSuccess: async (o) => {
      notificar(`Orden ${o.codigo} anulada`);
      setConfirmar(null);
      await actualizar(o);
    },
  });

  const o = orden.data;
  const unidades = o?.lineas.reduce((s, l) => s + l.cantidad, 0) ?? 0;
  const ocupado = aprobar.isPending || recepcionar.isPending || anular.isPending;

  const pie =
    o && o.acciones.length > 0 ? (
      <>
        {o.acciones.includes("anular") && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => {
              anular.reset();
              setConfirmar("anular");
            }}
            className="btn-secundario text-coral-700"
          >
            <X aria-hidden className="size-4" />
            Anular orden
          </button>
        )}
        {o.acciones.includes("aprobar") && (
          <button type="button" disabled={ocupado} onClick={() => aprobar.mutate()} className="btn-primario">
            {aprobar.isPending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}
            {aprobar.isPending ? "Aprobando…" : "Aprobar orden"}
          </button>
        )}
        {o.acciones.includes("recepcionar") && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => {
              recepcionar.reset();
              setConfirmar("recepcionar");
            }}
            className="btn-primario"
          >
            <PackageCheck aria-hidden className="size-4" />
            Recepcionar orden
          </button>
        )}
      </>
    ) : undefined;

  return (
    <>
      <Dialogo
        abierto
        alCerrar={alCerrar}
        variante="panel"
        ancho="lg"
        titulo={o ? `Orden de compra ${o.codigo}` : "Orden de compra"}
        descripcion={o ? `${o.proveedor.razonSocial} · RUC ${o.proveedor.ruc}` : undefined}
        pie={pie}
      >
        {orden.isPending ? (
          <Cargando texto="Cargando la orden…" />
        ) : orden.error ? (
          <EstadoError error={orden.error} reintentar={() => orden.refetch()} />
        ) : o ? (
          <div className="space-y-6">
            {aprobar.error && <Aviso tono="error">{mensajeError(aprobar.error)}</Aviso>}

            {recienRecibida && o.estado === "RECIBIDA" && (
              <Aviso tono="exito" titulo="Recepción registrada">
                <p>
                  Se sumaron {formatoNumero(unidades)} unidades al stock y se registró una ENTRADA en el kardex de cada producto.
                </p>
                {veKardex && (
                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {o.lineas.map((l) => (
                      <li key={l.id}>
                        <Link
                          to={`/kardex?productoId=${l.producto.id}`}
                          className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 hover:text-teal-900"
                        >
                          Kardex de {l.producto.codigo}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Aviso>
            )}

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-slate-600">Estado</dt>
                <dd className="mt-1">
                  <ChipEstadoOrden estado={o.estado} />
                </dd>
              </div>
              <div>
                <dt className="text-slate-600">Fecha</dt>
                <dd className="mt-1 font-medium text-slate-900 tabular-nums">{formatoFechaHora(o.fecha)}</dd>
              </div>
              <div>
                <dt className="text-slate-600">Creada por</dt>
                <dd className="mt-1 font-medium text-slate-900">{o.creadoPor?.nombre ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-600">Total</dt>
                <dd className="mt-1 text-base font-semibold text-slate-900 tabular-nums">{formatoSoles(o.total)}</dd>
              </div>
              {o.proveedor.telefono && (
                <div className="col-span-2">
                  <dt className="text-slate-600">Teléfono del proveedor</dt>
                  <dd className="mt-1 font-medium text-slate-900 tabular-nums">{o.proveedor.telefono}</dd>
                </div>
              )}
            </dl>

            {o.estado === "ANULADA" && o.motivoAnulacion && (
              <Aviso tono="error" titulo="Orden anulada">
                Motivo: {o.motivoAnulacion}
              </Aviso>
            )}

            <section aria-labelledby={`oc-${o.id}-lineas`}>
              <h3 id={`oc-${o.id}-lineas`} className="mb-2 text-sm font-semibold text-slate-900">
                Productos ({o.lineas.length})
              </h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-max border-collapse text-sm">
                  <caption className="sr-only">Líneas de la orden {o.codigo}</caption>
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-wide text-slate-600 uppercase">
                      <th scope="col" className="px-3 py-2 text-left">
                        Producto
                      </th>
                      <th scope="col" className="px-3 py-2 text-right">
                        Cantidad
                      </th>
                      <th scope="col" className="px-3 py-2 text-right">
                        Costo unit.
                      </th>
                      <th scope="col" className="px-3 py-2 text-right">
                        Subtotal
                      </th>
                      <th scope="col" className="px-3 py-2 text-right">
                        Stock actual
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.lineas.map((l) => (
                      <tr key={l.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2.5">
                          <div className="max-w-[15rem] min-w-[9rem] whitespace-normal">
                            <span className="font-medium text-slate-900 tabular-nums">{l.producto.codigo}</span>
                            <span className="block text-slate-700">{l.producto.nombre}</span>
                            {veKardex && o.estado === "RECIBIDA" && (
                              <Link
                                to={`/kardex?productoId=${l.producto.id}`}
                                className="inline-flex min-h-11 items-center text-sm font-medium text-marino hover:underline"
                              >
                                Ver kardex<span className="sr-only"> de {l.producto.codigo}</span>
                              </Link>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                          {formatoNumero(l.cantidad)} <span className="text-slate-600">{l.producto.unidad}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{formatoSoles(l.costoUnit)}</td>
                        <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap tabular-nums">{formatoSoles(l.subtotal)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <ChipStock stock={l.producto.stock} stockMinimo={l.producto.stockMinimo} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50">
                      <th scope="row" colSpan={3} className="px-3 py-2.5 text-right font-semibold text-slate-700">
                        Total
                      </th>
                      <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap text-slate-900 tabular-nums">{formatoSoles(o.total)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-600">«Stock actual» es el stock de hoy, no el del momento de la orden.</p>
            </section>

            <section aria-labelledby={`oc-${o.id}-hist`}>
              <h3 id={`oc-${o.id}-hist`} className="mb-3 text-sm font-semibold text-slate-900">
                Línea de tiempo
              </h3>
              <LineaTiempo historial={o.historial} />
            </section>

            {o.acciones.length === 0 && (o.estado === "PENDIENTE" || o.estado === "APROBADA") && (
              <p className="text-sm text-slate-600">
                {o.estado === "PENDIENTE"
                  ? "Pendiente de aprobación por el gerente."
                  : "Aprobada: pendiente de recepción por el almacén."}
              </p>
            )}
          </div>
        ) : null}
      </Dialogo>

      {o && (
        <>
          <DialogoConfirmacion
            abierto={confirmar === "recepcionar"}
            alCerrar={() => setConfirmar(null)}
            titulo={`¿Recepcionar ${o.codigo}?`}
            descripcion={
              <>
                Se sumarán {formatoNumero(unidades)} unidades a {o.lineas.length} {o.lineas.length === 1 ? "producto" : "productos"} y se
                registrará una ENTRADA en el kardex de cada uno. La orden pasará a RECIBIDA y no podrá anularse.
              </>
            }
            textoConfirmar="Sí, recepcionar"
            procesando={recepcionar.isPending}
            error={mensajeError(recepcionar.error)}
            alConfirmar={() => recepcionar.mutate()}
          />
          <DialogoConfirmacion
            abierto={confirmar === "anular"}
            alCerrar={() => setConfirmar(null)}
            titulo={`¿Anular ${o.codigo}?`}
            descripcion="La orden no podrá aprobarse ni recepcionarse. El motivo queda en la bitácora."
            textoConfirmar="Sí, anular orden"
            tono="peligro"
            motivoMinimo={10}
            etiquetaMotivo="Motivo de la anulación"
            procesando={anular.isPending}
            error={mensajeError(anular.error)}
            alConfirmar={(motivo) => anular.mutate(motivo)}
          />
        </>
      )}
    </>
  );
}

const TEXTO_ACCION: Record<string, string> = {
  CREAR: "Creada",
  RECEPCION: "Recibida",
  ANULAR: "Anulada",
};

function tituloRegistro(r: RegistroHistorial): string {
  if (r.accion === "CAMBIO_ESTADO") {
    const e = r.despues?.estado;
    return e === "APROBADA" ? "Aprobada" : e === "RECIBIDA" ? "Recibida" : e === "ANULADA" ? "Anulada" : `Cambio a ${e ?? "—"}`;
  }
  return TEXTO_ACCION[r.accion] ?? r.accion;
}

const PUNTO: Record<string, string> = {
  Creada: "bg-slate-400",
  Aprobada: "bg-marino-500",
  Recibida: "bg-teal",
  Anulada: "bg-coral",
};

function LineaTiempo({ historial }: { historial: RegistroHistorial[] }) {
  if (historial.length === 0) return <p className="text-sm text-slate-600">Sin registros en la bitácora.</p>;
  return (
    <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-slate-200">
      {historial.map((r) => {
        const titulo = tituloRegistro(r);
        return (
          <li key={r.id} className="relative pl-6">
            <span aria-hidden className={`absolute top-1.5 left-0 size-[11px] rounded-full ring-2 ring-white ${PUNTO[titulo] ?? "bg-slate-400"}`} />
            <p className="text-sm">
              <span className="font-semibold text-slate-900">{titulo}</span>
              <span className="text-slate-600">
                {" "}
                · {r.usuario?.nombre ?? "Usuario desconocido"} · <span className="tabular-nums">{formatoFechaHora(r.fecha)}</span>
              </span>
            </p>
            {r.accion === "CREAR" && r.despues?.total && (
              <p className="mt-0.5 text-sm text-slate-600">
                Total registrado: <span className="tabular-nums">{formatoSoles(r.despues.total)}</span> · nace PENDIENTE
              </p>
            )}
            {r.accion === "ANULAR" && r.despues?.motivo && <p className="mt-0.5 text-sm text-slate-700">Motivo: {r.despues.motivo}</p>}
            {r.accion === "RECEPCION" && r.despues?.movimientos && (
              <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
                {r.despues.movimientos.map((m) => (
                  <li key={m.productoId} className="tabular-nums">
                    ENTRADA {m.codigo}: +{formatoNumero(m.cantidad)} → stock {formatoNumero(m.stockResultante)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
