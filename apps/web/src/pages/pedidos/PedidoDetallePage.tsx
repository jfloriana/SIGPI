import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Ban, CircleCheck, LoaderCircle, PackageCheck, Truck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { api } from "../../api/cliente";
import { ChipEstadoPedido } from "../../components/Chip";
import { Encabezado } from "../../components/Encabezado";
import { Aviso, Cargando, EstadoError } from "../../components/Estados";
import { Tabla, type Columna } from "../../components/Tabla";
import { Tarjeta } from "../../components/Tarjeta";
import { formatoFechaHora, formatoNumero, formatoSoles } from "../../utils/formato";
import {
  DialogoAnular,
  DialogoDespacho,
  mensajeError,
  TEXTO_ACCION,
  textoProgreso,
  useAccionPedido,
  type PedidoResumen,
} from "./componentes/acciones";
import { LineaTiempo } from "./componentes/LineaTiempo";
import { TEXTO_CONDICION, type AccionPedido, type LineaPedido, type PedidoDetalle } from "./tipos";

function Volver() {
  return (
    <Link
      to="/pedidos"
      className="-ml-2 mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-marino hover:bg-marino-50"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Pedidos
    </Link>
  );
}

const ICONO_ACCION: Record<AccionPedido, typeof Truck> = {
  aprobar: CircleCheck,
  despachar: Truck,
  entregar: PackageCheck,
  anular: Ban,
};

const columnas: Columna<LineaPedido>[] = [
  {
    titulo: "Producto",
    celda: (l) => (
      <div className="w-48 whitespace-normal md:w-auto md:min-w-44">
        <p className="font-medium text-slate-900">{l.producto.nombre}</p>
        <p className="text-xs text-slate-500 tabular-nums">{l.producto.codigo}</p>
        {/* En celular, cantidad y precio van aquí (sus columnas se ocultan). */}
        <p className="mt-0.5 text-sm text-slate-700 tabular-nums md:hidden">
          {formatoNumero(l.cantidad)} {l.producto.unidad} × {formatoSoles(l.precioUnit)}
        </p>
      </div>
    ),
  },
  {
    titulo: "Cantidad",
    alinear: "derecha",
    ocultarEnMovil: true,
    celda: (l) => (
      <span className="whitespace-nowrap">
        {formatoNumero(l.cantidad)} <span className="text-xs text-slate-500">{l.producto.unidad}</span>
      </span>
    ),
  },
  { titulo: "Precio unit.", alinear: "derecha", ocultarEnMovil: true, celda: (l) => formatoSoles(l.precioUnit) },
  { titulo: "Subtotal", alinear: "derecha", celda: (l) => <span className="font-medium text-slate-900">{formatoSoles(l.subtotal)}</span> },
];

function Dato({ termino, children }: { termino: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500">{termino}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

function Detalle({ pedido }: { pedido: PedidoDetalle }) {
  const accion = useAccionPedido();
  const [despachar, setDespachar] = useState<PedidoResumen | null>(null);
  const [anular, setAnular] = useState<PedidoResumen | null>(null);
  const resumen = { id: pedido.id, codigo: pedido.codigo };
  const c = pedido.cliente;

  function ejecutar(a: AccionPedido) {
    if (a === "despachar") return setDespachar(resumen);
    if (a === "anular") return setAnular(resumen);
    accion.mutate({ id: pedido.id, accion: a });
  }

  const principales = pedido.acciones.filter((a) => a !== "anular");
  const puedeAnular = pedido.acciones.includes("anular");
  const enCurso = accion.isPending ? accion.variables?.accion : undefined;

  const botones =
    pedido.acciones.length > 0 ? (
      <>
        {puedeAnular && (
          <button type="button" onClick={() => ejecutar("anular")} disabled={accion.isPending} className="btn-secundario text-coral-800">
            <Ban aria-hidden className="size-4" />
            {TEXTO_ACCION.anular}
          </button>
        )}
        {principales.map((a) => {
          const Icono = ICONO_ACCION[a];
          return (
            <button key={a} type="button" onClick={() => ejecutar(a)} disabled={accion.isPending} className="btn-primario">
              {enCurso === a ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Icono aria-hidden className="size-4" />}
              {enCurso === a ? textoProgreso(a) : TEXTO_ACCION[a]}
            </button>
          );
        })}
      </>
    ) : undefined;

  return (
    <>
      <Volver />
      <Encabezado
        titulo={`Pedido ${pedido.codigo}`}
        descripcion={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span key={pedido.estado} className="inline-flex animate-[aparecer_200ms_var(--ease-salida)]">
              <ChipEstadoPedido estado={pedido.estado} />
            </span>
            <span>
              Registrado el <time dateTime={pedido.fecha}>{formatoFechaHora(pedido.fecha)}</time>
            </span>
          </span>
        }
        acciones={botones}
      />

      {accion.isError && (
        <div className="mb-4">
          <Aviso tono="error" titulo="No se pudo completar la acción">
            {mensajeError(accion.error)}
          </Aviso>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          <Tarjeta>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <div className="col-span-2 min-w-0">
                <dt className="text-xs font-medium text-slate-500">Cliente</dt>
                <dd className="mt-0.5">
                  <p className="font-semibold text-slate-900">{c.razonSocial}</p>
                  <p className="text-sm text-slate-600">
                    {c.tipoDoc} <span className="tabular-nums">{c.numDoc}</span> · {c.zona}
                  </p>
                  <p className="text-sm text-slate-600">
                    {c.direccion}
                    {c.telefono && <> · <span className="whitespace-nowrap tabular-nums">{c.telefono}</span></>}
                  </p>
                </dd>
              </div>
              <Dato termino="Vendedor">{pedido.vendedor.nombre}</Dato>
              <Dato termino="Condición de pago">{TEXTO_CONDICION[pedido.condicionPago]}</Dato>
              <div className="col-span-2 flex items-baseline justify-between gap-4 border-t border-slate-200 pt-4 sm:col-span-4">
                <dt className="text-sm font-medium text-slate-600">Total del pedido</dt>
                <dd className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{formatoSoles(pedido.total)}</dd>
              </div>
            </dl>
          </Tarjeta>

          <Tarjeta
            titulo="Productos"
            descripcion={`${pedido.lineas.length} ${pedido.lineas.length === 1 ? "línea" : "líneas"} · precios al momento de registrar`}
            sinRelleno
          >
            <Tabla columnas={columnas} filas={pedido.lineas} claveFila={(l) => l.id} descripcion={`Productos del pedido ${pedido.codigo}`} />
            <div className="flex items-baseline justify-end gap-4 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:px-5">
              <span className="font-medium text-slate-600">Total</span>
              <span className="font-bold text-slate-900 tabular-nums">{formatoSoles(pedido.total)}</span>
            </div>
          </Tarjeta>
        </div>

        <Tarjeta titulo="Seguimiento" descripcion="Quién y cuándo, según la bitácora" className="lg:sticky lg:top-20">
          <LineaTiempo pedido={pedido} />
        </Tarjeta>
      </div>

      <DialogoDespacho pedido={despachar} alCerrar={() => setDespachar(null)} />
      <DialogoAnular pedido={anular} alCerrar={() => setAnular(null)} />
    </>
  );
}

export default function PedidoDetallePage() {
  const { id } = useParams();
  const idNum = Number(id);
  const valido = Number.isInteger(idNum) && idNum > 0;

  const consulta = useQuery({
    queryKey: ["pedido", idNum],
    queryFn: () => api.get<PedidoDetalle>(`/pedidos/${idNum}`),
    enabled: valido,
    retry: (n, err) => n < 2 && !(err && "status" in err && [403, 404].includes((err as { status: number }).status)),
  });

  if (!valido || consulta.isError) {
    return (
      <>
        <Volver />
        <Encabezado titulo="Pedido no disponible" />
        <Tarjeta>
          <EstadoError
            error={valido ? consulta.error : null}
            reintentar={valido ? () => consulta.refetch() : undefined}
          />
        </Tarjeta>
      </>
    );
  }

  if (!consulta.data) {
    return (
      <>
        <Volver />
        <Cargando texto="Cargando pedido…" />
      </>
    );
  }

  return <Detalle pedido={consulta.data} />;
}
