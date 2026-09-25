import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { LoaderCircle, PackageCheck, Truck } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { api } from "../../api/cliente";
import { aQuery, type Paginado } from "../../api/tipos";
import { Encabezado } from "../../components/Encabezado";
import { useNotificar } from "../../components/Notificaciones";
import { Paginacion, Tabla, type Columna } from "../../components/Tabla";
import { Tarjeta } from "../../components/Tarjeta";
import { formatoFechaHora, formatoSoles } from "../../utils/formato";
import { DialogoDespacho, mensajeError, useAccionPedido, type PedidoResumen } from "../pedidos/componentes/acciones";
import { haceCuanto, type EstadoPedido, type PedidoFila } from "../pedidos/tipos";

const PAGE_SIZE = 20;
const UN_DIA = 86_400_000;

function useCola(estado: EstadoPedido, page: number) {
  return useQuery({
    queryKey: ["pedidos", { estado, orden: "antiguedad" }, page],
    queryFn: () => api.get<Paginado<PedidoFila>>(`/pedidos${aQuery({ estado, orden: "antiguedad", page, pageSize: PAGE_SIZE })}`),
    placeholderData: keepPreviousData,
    // La cola cambia cuando el gerente aprueba: se refresca sola cada 30 s.
    refetchInterval: 30_000,
  });
}

function columnasBase(ahora: number): Columna<PedidoFila>[] {
  return [
    {
      titulo: "Antigüedad",
      celda: (p) => {
        const vieja = ahora - new Date(p.fecha).getTime() > UN_DIA;
        return (
          <time
            dateTime={p.fecha}
            title={`Registrado el ${formatoFechaHora(p.fecha)}`}
            className={`whitespace-nowrap tabular-nums ${vieja ? "font-semibold text-ambar-800" : "text-slate-700"}`}
          >
            {haceCuanto(p.fecha, ahora)}
          </time>
        );
      },
    },
    {
      titulo: "Pedido",
      celda: (p) => (
        <Link
          to={`/pedidos/${p.id}`}
          onClick={(e) => e.stopPropagation()}
          className="-mx-1 -my-2.5 inline-flex min-h-11 items-center rounded px-1 font-semibold whitespace-nowrap text-marino tabular-nums hover:underline"
        >
          {p.codigo}
        </Link>
      ),
    },
    {
      titulo: "Cliente",
      celda: (p) => (
        <p className="max-w-64 min-w-40 truncate font-medium text-slate-900" title={p.cliente.razonSocial}>
          {p.cliente.razonSocial}
        </p>
      ),
    },
    { titulo: "Zona", celda: (p) => <span className="whitespace-nowrap">{p.cliente.zona}</span> },
    { titulo: "Líneas", alinear: "derecha", celda: (p) => p.numLineas },
    {
      titulo: "Total",
      alinear: "derecha",
      celda: (p) => <span className="font-medium whitespace-nowrap text-slate-900">{formatoSoles(p.total)}</span>,
    },
  ];
}

export default function DespachoPage() {
  const navigate = useNavigate();
  const notificar = useNotificar();
  const [pageAprob, setPageAprob] = useState(1);
  const [pageDesp, setPageDesp] = useState(1);
  const aprobados = useCola("APROBADO", pageAprob);
  const despachados = useCola("DESPACHADO", pageDesp);
  const [aDespachar, setADespachar] = useState<PedidoResumen | null>(null);
  const entregar = useAccionPedido();

  const ahora = Date.now();
  const base = columnasBase(ahora);
  const irA = (p: PedidoFila) => navigate(`/pedidos/${p.id}`);

  const colAprobados: Columna<PedidoFila>[] = [
    ...base,
    {
      titulo: "Acción",
      alinear: "derecha",
      celda: (p) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setADespachar({ id: p.id, codigo: p.codigo });
          }}
          className="btn-primario -my-1.5"
          aria-label={`Despachar ${p.codigo}`}
        >
          <Truck aria-hidden className="size-4" />
          Despachar
        </button>
      ),
    },
  ];

  const colDespachados: Columna<PedidoFila>[] = [
    ...base,
    {
      titulo: "Acción",
      alinear: "derecha",
      celda: (p) => {
        const enCurso = entregar.isPending && entregar.variables?.id === p.id;
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              entregar.mutate(
                { id: p.id, accion: "entregar" },
                { onError: (err) => notificar(`${p.codigo}: ${mensajeError(err)}`, "error") },
              );
            }}
            disabled={entregar.isPending}
            className="btn-secundario -my-1.5"
            aria-label={`Marcar entregado ${p.codigo}`}
          >
            {enCurso ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <PackageCheck aria-hidden className="size-4" />}
            {enCurso ? "Registrando…" : "Marcar entregado"}
          </button>
        );
      },
    },
  ];

  const cuenta = (n: number | undefined) => (n === undefined ? undefined : `${n} ${n === 1 ? "pedido" : "pedidos"}`);

  return (
    <>
      <Encabezado
        titulo="Cola de despacho"
        descripcion="Pedidos aprobados, del más antiguo al más reciente. Al despachar se descuenta el stock de todas las líneas en una sola operación."
      />

      <div className="space-y-6">
        <Tarjeta titulo="Por despachar" descripcion={cuenta(aprobados.data?.total)} sinRelleno>
          <Tabla
            columnas={colAprobados}
            filas={aprobados.data?.datos}
            claveFila={(p) => p.id}
            descripcion="Pedidos aprobados por despachar, del más antiguo al más reciente"
            cargando={aprobados.isFetching && !aprobados.data}
            error={aprobados.error}
            reintentar={() => aprobados.refetch()}
            alSeleccionar={irA}
            vacio={{
              titulo: "No hay pedidos aprobados por despachar",
              descripcion:
                "Cuando el gerente apruebe un pedido, o uno al contado se apruebe automáticamente, aparecerá aquí por orden de llegada.",
            }}
          />
          {aprobados.data && (
            <Paginacion page={aprobados.data.page} pageSize={aprobados.data.pageSize} total={aprobados.data.total} alCambiar={setPageAprob} />
          )}
        </Tarjeta>

        <Tarjeta titulo="Despachados, por entregar" descripcion={cuenta(despachados.data?.total)} sinRelleno>
          <Tabla
            columnas={colDespachados}
            filas={despachados.data?.datos}
            claveFila={(p) => p.id}
            descripcion="Pedidos despachados pendientes de entrega"
            cargando={despachados.isFetching && !despachados.data}
            error={despachados.error}
            reintentar={() => despachados.refetch()}
            alSeleccionar={irA}
            vacio={{
              titulo: "No hay pedidos en reparto",
              descripcion: "Los pedidos que despache aparecerán aquí hasta que marque su entrega al cliente.",
            }}
          />
          {despachados.data && (
            <Paginacion
              page={despachados.data.page}
              pageSize={despachados.data.pageSize}
              total={despachados.data.total}
              alCambiar={setPageDesp}
            />
          )}
        </Tarjeta>
      </div>

      <DialogoDespacho pedido={aDespachar} alCerrar={() => setADespachar(null)} />
    </>
  );
}
