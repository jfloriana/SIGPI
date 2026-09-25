import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useId } from "react";
import { api } from "../../api/cliente";
import { aQuery, type Paginado } from "../../api/tipos";
import { ChipEstadoOrden, type EstadoOrden } from "../../components/Chip";
import { Paginacion, Tabla, type Columna } from "../../components/Tabla";
import { BarraFiltros, Tarjeta } from "../../components/Tarjeta";
import { formatoFecha, formatoSoles } from "../../utils/formato";
import { ESTADOS_ORDEN, type OrdenFila, type Proveedor } from "./tipos";

const PAGE_SIZE = 20;
const TEXTO_ESTADO: Record<EstadoOrden, string> = {
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  RECIBIDA: "Recibida",
  ANULADA: "Anulada",
};

export interface FiltrosOrdenes {
  estado: string;
  proveedorId: string;
  desde: string;
  hasta: string;
}

export function SeccionOrdenes({
  filtros,
  page,
  alFiltrar,
  alLimpiar,
  alPaginar,
  alAbrir,
  proveedores,
  esAlmacenero,
  puedeCrear,
  alNueva,
}: {
  filtros: FiltrosOrdenes;
  page: number;
  alFiltrar: (cambios: Partial<FiltrosOrdenes>) => void;
  alLimpiar: () => void;
  alPaginar: (p: number) => void;
  alAbrir: (id: number) => void;
  proveedores: Proveedor[] | undefined;
  esAlmacenero: boolean;
  puedeCrear: boolean;
  alNueva: () => void;
}) {
  const id = useId();
  const ordenes = useQuery({
    queryKey: ["ordenes-compra", "lista", filtros, page],
    queryFn: () => api.get<Paginado<OrdenFila>>(`/ordenes-compra${aQuery({ page, pageSize: PAGE_SIZE, ...filtros })}`),
    placeholderData: keepPreviousData,
  });

  // El almacenero solo ve órdenes APROBADAS y RECIBIDAS (la API ya filtra).
  const estados = esAlmacenero ? ESTADOS_ORDEN.filter((e) => e === "APROBADA" || e === "RECIBIDA") : ESTADOS_ORDEN;
  const hayFiltros = Boolean(filtros.estado || filtros.proveedorId || filtros.desde || filtros.hasta);
  const rangoInvalido = Boolean(filtros.desde && filtros.hasta && filtros.desde > filtros.hasta);

  const columnas: Columna<OrdenFila>[] = [
    {
      titulo: "Código",
      celda: (o) => (
        <div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              alAbrir(o.id);
            }}
            className="inline-flex min-h-11 items-center font-semibold whitespace-nowrap text-marino tabular-nums hover:underline"
          >
            {o.codigo}
          </button>
          <span className="block md:hidden">
            <ChipEstadoOrden estado={o.estado} />
          </span>
        </div>
      ),
    },
    { titulo: "Fecha", ocultarEnMovil: true, celda: (o) => <span className="whitespace-nowrap tabular-nums">{formatoFecha(o.fecha)}</span> },
    {
      titulo: "Proveedor",
      celda: (o) => (
        <div className="max-w-[16rem] min-w-[9rem] whitespace-normal md:max-w-xs">
          {o.proveedor.razonSocial}
          <span className="mt-0.5 block text-xs text-slate-600 tabular-nums md:hidden">
            {formatoFecha(o.fecha)} · <span className="font-semibold text-slate-900">{formatoSoles(o.total)}</span>
          </span>
        </div>
      ),
    },
    { titulo: "Líneas", alinear: "derecha", ocultarEnMovil: true, celda: (o) => o.numLineas },
    {
      titulo: "Total",
      alinear: "derecha",
      ocultarEnMovil: true,
      celda: (o) => <span className="whitespace-nowrap">{formatoSoles(o.total)}</span>,
    },
    { titulo: "Estado", ocultarEnMovil: true, celda: (o) => <ChipEstadoOrden estado={o.estado} /> },
  ];

  return (
    <Tarjeta sinRelleno>
      <BarraFiltros>
        <div className="w-[calc(50%-0.375rem)] sm:w-40">
          <label htmlFor={`${id}-estado`} className="campo-etiqueta">
            Estado
          </label>
          <select id={`${id}-estado`} value={filtros.estado} onChange={(e) => alFiltrar({ estado: e.target.value })} className="campo-control">
            <option value="">Todos</option>
            {estados.map((e) => (
              <option key={e} value={e}>
                {TEXTO_ESTADO[e]}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-64">
          <label htmlFor={`${id}-prov`} className="campo-etiqueta">
            Proveedor
          </label>
          <select
            id={`${id}-prov`}
            value={filtros.proveedorId}
            onChange={(e) => alFiltrar({ proveedorId: e.target.value })}
            className="campo-control"
          >
            <option value="">Todos</option>
            {proveedores?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.razonSocial}
              </option>
            ))}
          </select>
        </div>
        <div className="w-[calc(50%-0.375rem)] sm:w-40">
          <label htmlFor={`${id}-desde`} className="campo-etiqueta">
            Desde
          </label>
          <input
            id={`${id}-desde`}
            type="date"
            value={filtros.desde}
            max={filtros.hasta || undefined}
            onChange={(e) => alFiltrar({ desde: e.target.value })}
            className="campo-control tabular-nums"
          />
        </div>
        <div className="w-[calc(50%-0.375rem)] sm:w-40">
          <label htmlFor={`${id}-hasta`} className="campo-etiqueta">
            Hasta
          </label>
          <input
            id={`${id}-hasta`}
            type="date"
            value={filtros.hasta}
            min={filtros.desde || undefined}
            onChange={(e) => alFiltrar({ hasta: e.target.value })}
            aria-invalid={rangoInvalido || undefined}
            aria-describedby={rangoInvalido ? `${id}-rango` : undefined}
            className="campo-control tabular-nums"
          />
        </div>
        {hayFiltros && (
          <button
            type="button"
            onClick={alLimpiar}
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-marino hover:bg-marino-50"
          >
            Limpiar filtros
          </button>
        )}
        {rangoInvalido && (
          <p id={`${id}-rango`} className="campo-error w-full">
            La fecha «Desde» no puede ser posterior a «Hasta».
          </p>
        )}
      </BarraFiltros>

      <Tabla
        descripcion="Órdenes de compra con proveedor, total y estado"
        columnas={columnas}
        filas={ordenes.data?.datos}
        claveFila={(o) => o.id}
        cargando={ordenes.isFetching}
        error={ordenes.error}
        reintentar={() => ordenes.refetch()}
        alSeleccionar={(o) => alAbrir(o.id)}
        vacio={
          hayFiltros
            ? {
                titulo: "Ninguna orden coincide con los filtros",
                descripcion: "Pruebe con otro estado, proveedor o rango de fechas.",
                accion: (
                  <button type="button" onClick={alLimpiar} className="btn-secundario">
                    Limpiar filtros
                  </button>
                ),
              }
            : esAlmacenero
              ? {
                  titulo: "No hay órdenes aprobadas por recibir",
                  descripcion: "Cuando el gerente apruebe una orden de compra, aparecerá aquí para recepcionarla.",
                }
              : {
                  titulo: "Aún no hay órdenes de compra",
                  descripcion: "Genere una orden sugerida con los productos en alerta o registre una orden nueva.",
                  accion: puedeCrear ? (
                    <button type="button" onClick={alNueva} className="btn-secundario">
                      Registrar la primera orden
                    </button>
                  ) : undefined,
                }
        }
      />
      {ordenes.data && <Paginacion page={page} pageSize={PAGE_SIZE} total={ordenes.data.total} alCambiar={alPaginar} />}
    </Tarjeta>
  );
}
