import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useCallback, useId } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { api } from "../../api/cliente";
import { aQuery, type Paginado } from "../../api/tipos";
import { useUsuario } from "../../auth/AuthContext";
import { Buscador } from "../../components/Buscador";
import { ChipEstadoPedido, TEXTO_ESTADO_PEDIDO } from "../../components/Chip";
import { Encabezado } from "../../components/Encabezado";
import { Paginacion, Tabla, type Columna } from "../../components/Tabla";
import { BarraFiltros, Tarjeta } from "../../components/Tarjeta";
import { useFiltrosUrl } from "../../hooks/useFiltrosUrl";
import { formatoFechaHora, formatoSoles } from "../../utils/formato";
import { esEstadoPedido, ESTADOS_PEDIDO, TEXTO_CONDICION, type EstadoPedido, type PedidoFila } from "./tipos";

const PAGE_SIZE = 20;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const DESCRIPCION = {
  VENDEDOR: "Sus pedidos registrados. Solo usted y la gerencia pueden verlos.",
  GERENTE: "Todos los pedidos. Los registrados a crédito o mayores de S/ 2 000 esperan su aprobación.",
  ADMIN: "Todos los pedidos, en modo consulta: aprobar y anular corresponde al gerente.",
  ALMACENERO: "Pedidos aprobados, despachados y entregados.",
} as const;

export default function PedidosPage() {
  const { rol } = useUsuario();
  const navigate = useNavigate();
  const verVendedor = rol === "GERENTE" || rol === "ADMIN";
  const estadosVisibles: EstadoPedido[] =
    rol === "ALMACENERO" ? ["APROBADO", "DESPACHADO", "ENTREGADO"] : ESTADOS_PEDIDO;

  const { filtros, setFiltro, page, setPage } = useFiltrosUrl(["estado", "desde", "hasta", "vendedorId", "buscar"] as const);
  const estado = esEstadoPedido(filtros.estado) && estadosVisibles.includes(filtros.estado) ? filtros.estado : "";
  const desde = FECHA.test(filtros.desde) ? filtros.desde : "";
  const hasta = FECHA.test(filtros.hasta) ? filtros.hasta : "";
  const rangoInvalido = !!(desde && hasta && hasta < desde);
  const vendedorId = verVendedor && /^\d+$/.test(filtros.vendedorId) ? filtros.vendedorId : "";
  const buscar = filtros.buscar.trim();
  const hayFiltros = !!(estado || desde || hasta || vendedorId || buscar);

  const idDesde = useId();
  const idHasta = useId();
  const idVendedor = useId();
  const idErrorFechas = useId();

  const consulta = useQuery({
    queryKey: ["pedidos", { estado, desde, hasta: rangoInvalido ? "" : hasta, vendedorId, buscar }, page],
    queryFn: () =>
      api.get<Paginado<PedidoFila>>(
        `/pedidos${aQuery({ page, pageSize: PAGE_SIZE, estado, desde, hasta: rangoInvalido ? "" : hasta, vendedorId, buscar })}`,
      ),
    placeholderData: keepPreviousData,
  });

  const vendedores = useQuery({
    queryKey: ["usuarios", { rol: "VENDEDOR" }],
    queryFn: () => api.get<Paginado<{ id: number; nombre: string }>>(`/usuarios${aQuery({ rol: "VENDEDOR", pageSize: 100 })}`),
    enabled: verVendedor,
    staleTime: 5 * 60_000,
  });

  const cambiarBuscar = useCallback((v: string) => setFiltro("buscar", v), [setFiltro]);
  const [, setParams] = useSearchParams();
  const limpiarFiltros = () => setParams({}, { replace: true });

  const columnas: Columna<PedidoFila>[] = [
    {
      titulo: "Código",
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
      titulo: "Fecha",
      ocultarEnMovil: true,
      celda: (p) => <span className="whitespace-nowrap text-slate-700 tabular-nums">{formatoFechaHora(p.fecha)}</span>,
    },
    {
      titulo: "Cliente",
      celda: (p) => (
        <div className="max-w-64 min-w-40">
          <p className="truncate font-medium text-slate-900" title={p.cliente.razonSocial}>
            {p.cliente.razonSocial}
          </p>
          <p className="text-xs text-slate-500">{p.cliente.zona}</p>
        </div>
      ),
    },
    ...(verVendedor
      ? [{ titulo: "Vendedor", ocultarEnMovil: true, celda: (p: PedidoFila) => <span className="whitespace-nowrap">{p.vendedor.nombre}</span> }]
      : []),
    { titulo: "Condición", ocultarEnMovil: true, celda: (p) => TEXTO_CONDICION[p.condicionPago] },
    {
      titulo: "Total",
      alinear: "derecha",
      celda: (p) => <span className="font-medium whitespace-nowrap text-slate-900">{formatoSoles(p.total)}</span>,
    },
    { titulo: "Estado", celda: (p) => <ChipEstadoPedido estado={p.estado} /> },
  ];

  const vacio = hayFiltros
    ? {
        titulo: buscar ? `No hay pedidos que coincidan con “${buscar}”` : "No hay pedidos con estos filtros",
        descripcion: "Busque por código (p. ej., 12 o PED-000012) o razón social, o amplíe el rango de fechas.",
        accion: (
          <button type="button" onClick={limpiarFiltros} className="btn-secundario">
            Limpiar filtros
          </button>
        ),
      }
    : rol === "VENDEDOR"
      ? {
          titulo: "Aún no ha registrado pedidos",
          descripcion: "Registre el primero desde la bodega del cliente: elija el cliente, agregue productos y confirme.",
          accion: (
            <Link to="/pedidos/nuevo" className="btn-primario">
              <Plus aria-hidden className="size-4" />
              Registrar pedido
            </Link>
          ),
        }
      : { titulo: "Aún no hay pedidos", descripcion: "Los pedidos que registren los vendedores aparecerán aquí." };

  const opcionesEstado: { valor: string; texto: string }[] = [
    { valor: "", texto: "Todos" },
    ...estadosVisibles.map((e) => ({ valor: e, texto: TEXTO_ESTADO_PEDIDO[e] })),
  ];

  return (
    <>
      <Encabezado
        titulo="Pedidos"
        descripcion={DESCRIPCION[rol]}
        acciones={
          rol === "VENDEDOR" && (
            <Link to="/pedidos/nuevo" className="btn-primario">
              <Plus aria-hidden className="size-4" />
              Nuevo pedido
            </Link>
          )
        }
      />

      <Tarjeta sinRelleno>
        <div className="border-b border-slate-200 px-4 pt-3 sm:px-5">
          <div role="group" aria-label="Filtrar por estado" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-3">
            {opcionesEstado.map((o) => {
              const activo = estado === o.valor;
              return (
                <button
                  key={o.valor || "todos"}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => setFiltro("estado", o.valor)}
                  className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
                    activo ? "bg-marino text-white" : "text-slate-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50"
                  }`}
                >
                  {o.texto}
                </button>
              );
            })}
          </div>
        </div>

        <BarraFiltros>
          <Buscador
            valor={filtros.buscar}
            alCambiar={cambiarBuscar}
            etiqueta="Buscar pedido"
            placeholder="Código o razón social"
            className="basis-full sm:basis-auto"
          />
          <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
            <label htmlFor={idDesde} className="campo-etiqueta">
              Desde
            </label>
            <input
              id={idDesde}
              type="date"
              value={desde}
              max={hasta || undefined}
              onChange={(e) => setFiltro("desde", e.target.value)}
              className="campo-control"
            />
          </div>
          <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
            <label htmlFor={idHasta} className="campo-etiqueta">
              Hasta
            </label>
            <input
              id={idHasta}
              type="date"
              value={hasta}
              min={desde || undefined}
              onChange={(e) => setFiltro("hasta", e.target.value)}
              aria-invalid={rangoInvalido || undefined}
              aria-describedby={rangoInvalido ? idErrorFechas : undefined}
              className="campo-control"
            />
          </div>
          {verVendedor && (
            <div className="min-w-0 basis-full sm:w-56 sm:basis-auto">
              <label htmlFor={idVendedor} className="campo-etiqueta">
                Vendedor
              </label>
              <select
                id={idVendedor}
                value={vendedorId}
                onChange={(e) => setFiltro("vendedorId", e.target.value)}
                className="campo-control"
              >
                <option value="">Todos los vendedores</option>
                {vendedores.data?.datos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          {hayFiltros && (
            <button type="button" onClick={limpiarFiltros} className="btn-secundario">
              Limpiar filtros
            </button>
          )}
          {rangoInvalido && (
            <p id={idErrorFechas} className="campo-error mt-0 basis-full">
              La fecha «Hasta» no puede ser anterior a «Desde»: se muestra sin límite final.
            </p>
          )}
        </BarraFiltros>

        <Tabla
          columnas={columnas}
          filas={consulta.data?.datos}
          claveFila={(p) => p.id}
          descripcion="Lista de pedidos"
          cargando={consulta.isFetching}
          error={consulta.error}
          reintentar={() => consulta.refetch()}
          vacio={vacio}
          alSeleccionar={(p) => navigate(`/pedidos/${p.id}`)}
        />

        {consulta.data && (
          <Paginacion page={consulta.data.page} pageSize={consulta.data.pageSize} total={consulta.data.total} alCambiar={setPage} />
        )}
      </Tarjeta>
    </>
  );
}
