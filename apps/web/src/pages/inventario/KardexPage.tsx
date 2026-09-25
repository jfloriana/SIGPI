import { useQuery } from "@tanstack/react-query";
import { CircleCheck, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { useId } from "react";
import { Link } from "react-router";
import { api } from "../../api/cliente";
import { aQuery } from "../../api/tipos";
import { useUsuario } from "../../auth/AuthContext";
import { ChipStock } from "../../components/Chip";
import { Encabezado } from "../../components/Encabezado";
import { EstadoError, EstadoVacio } from "../../components/Estados";
import { Paginacion, Tabla, type Columna } from "../../components/Tabla";
import { BarraFiltros, Tarjeta } from "../../components/Tarjeta";
import { useFiltrosUrl } from "../../hooks/useFiltrosUrl";
import { formatoFechaHora, formatoNumero } from "../../utils/formato";
import { ChipTipoMovimiento, SelectorProducto } from "./componentes";
import {
  cantidadConSigno,
  esTipoMovimiento,
  idPedidoDeReferencia,
  INFO_TIPO,
  TIPOS_MOVIMIENTO,
  type Kardex,
  type Movimiento,
  type ResumenKardex,
} from "./tipos";

const PAGE_SIZE = 20;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export default function KardexPage() {
  const { rol } = useUsuario();
  const registraAjustes = rol === "ADMIN" || rol === "ALMACENERO";
  const { filtros, setFiltro, setFiltros, page, setPage } = useFiltrosUrl(["productoId", "tipo", "desde", "hasta"] as const);
  const idTipo = useId();
  const idDesde = useId();
  const idHasta = useId();

  // La URL puede editarse a mano: solo se envían valores válidos.
  const productoId = /^\d+$/.test(filtros.productoId) ? Number(filtros.productoId) : null;
  const tipo = esTipoMovimiento(filtros.tipo) ? filtros.tipo : "";
  const desde = FECHA.test(filtros.desde) ? filtros.desde : "";
  const hasta = FECHA.test(filtros.hasta) ? filtros.hasta : "";
  const rangoInvalido = !!(desde && hasta && desde > hasta);
  const hayFiltros = !!(tipo || desde || hasta);

  const kardex = useQuery({
    queryKey: ["inventario", "kardex", productoId, { tipo, desde, hasta }, page],
    queryFn: () =>
      api.get<Kardex>(`/inventario/kardex/${productoId}${aQuery({ page, pageSize: PAGE_SIZE, tipo, desde, hasta })}`),
    enabled: productoId !== null && !rangoInvalido,
    placeholderData: (previo, consulta) =>
      // Conserva la página anterior solo mientras se pagina o filtra el MISMO producto.
      consulta?.queryKey[2] === productoId ? previo : undefined,
  });

  const producto = kardex.data?.producto;
  // La API entrega los más recientes primero; dentro de la página se muestran en orden cronológico.
  const filas = kardex.data ? [...kardex.data.datos].reverse() : undefined;

  const columnas: Columna<Movimiento>[] = [
    {
      titulo: "Fecha y hora",
      celda: (m) => <span className="whitespace-nowrap tabular-nums">{formatoFechaHora(m.fecha)}</span>,
    },
    { titulo: "Tipo", celda: (m) => <ChipTipoMovimiento tipo={m.tipo} /> },
    {
      titulo: "Cantidad",
      alinear: "derecha",
      celda: (m) => (
        <span className={`font-semibold whitespace-nowrap ${INFO_TIPO[m.tipo].signo > 0 ? "text-teal-800" : "text-slate-900"}`}>
          {cantidadConSigno(m.tipo, m.cantidad)}
        </span>
      ),
    },
    {
      titulo: "Stock resultante",
      alinear: "derecha",
      celda: (m) => <span className="whitespace-nowrap">{formatoNumero(m.stockResultante)}</span>,
    },
    {
      titulo: "Motivo",
      celda: (m) => <span className="block max-w-[16rem] min-w-[9rem] whitespace-normal">{m.motivo}</span>,
    },
    {
      titulo: "Referencia",
      ocultarEnMovil: true,
      celda: (m) => {
        const idPedido = idPedidoDeReferencia(m.referencia);
        if (idPedido)
          return (
            <Link to={`/pedidos/${idPedido}`} className="font-medium whitespace-nowrap text-marino tabular-nums hover:underline">
              {m.referencia}
            </Link>
          );
        return <span className="whitespace-nowrap text-slate-700">{m.referencia ?? "—"}</span>;
      },
    },
    {
      titulo: "Usuario",
      ocultarEnMovil: true,
      celda: (m) => <span className="whitespace-nowrap">{m.usuario.nombre}</span>,
    },
  ];

  return (
    <>
      <Encabezado
        titulo="Kardex"
        descripcion="Historial de movimientos de un producto: entradas, salidas por despacho y ajustes. El stock actual debe coincidir con la suma de todos sus movimientos."
        acciones={
          registraAjustes && productoId ? (
            <Link to={`/ajustes?productoId=${productoId}`} className="btn-secundario">
              <SlidersHorizontal aria-hidden className="size-4" />
              Registrar ajuste
            </Link>
          ) : undefined
        }
      />

      <div className="space-y-4">
        <Tarjeta>
          <div className="max-w-xl">
            <SelectorProducto
              etiqueta={productoId ? "Cambiar de producto" : "Producto"}
              ayuda="Escriba el código o parte del nombre y elija un producto de la lista."
              alElegir={(p) => setFiltros({ productoId: String(p.id), tipo: "", desde: "", hasta: "" })}
            />
          </div>
        </Tarjeta>

        {productoId === null ? (
          <Tarjeta>
            <EstadoVacio
              titulo="Elija un producto para ver su kardex"
              descripcion="Busque por código o nombre. También puede llegar aquí desde «Ver kardex» en Productos o en Alertas de stock."
            />
          </Tarjeta>
        ) : kardex.error && !kardex.data ? (
          <Tarjeta>
            <EstadoError error={kardex.error} reintentar={() => kardex.refetch()} />
          </Tarjeta>
        ) : (
          <>
            <CabeceraProducto kardex={kardex.data} />

            <Tarjeta sinRelleno titulo="Movimientos" descripcion="Página 1: los más recientes. Dentro de cada página, en orden cronológico.">
              <BarraFiltros>
                <div className="w-full sm:w-48">
                  <label htmlFor={idTipo} className="campo-etiqueta">
                    Tipo
                  </label>
                  <select id={idTipo} value={tipo} onChange={(e) => setFiltro("tipo", e.target.value)} className="campo-control">
                    <option value="">Todos</option>
                    {TIPOS_MOVIMIENTO.map((t) => (
                      <option key={t} value={t}>
                        {INFO_TIPO[t].texto.replace("+", "positivo").replace("−", "negativo")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-[calc(50%-0.375rem)] sm:w-44">
                  <label htmlFor={idDesde} className="campo-etiqueta">
                    Desde
                  </label>
                  <input
                    id={idDesde}
                    type="date"
                    value={desde}
                    max={hasta || undefined}
                    onChange={(e) => setFiltro("desde", e.target.value)}
                    aria-invalid={rangoInvalido || undefined}
                    aria-describedby={rangoInvalido ? `${idDesde}-error` : undefined}
                    className="campo-control"
                  />
                </div>
                <div className="w-[calc(50%-0.375rem)] sm:w-44">
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
                    className="campo-control"
                  />
                </div>
                {hayFiltros && (
                  <button
                    type="button"
                    onClick={() => setFiltros({ tipo: "", desde: "", hasta: "" })}
                    className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-marino hover:bg-marino-50"
                  >
                    Limpiar filtros
                  </button>
                )}
                {rangoInvalido && (
                  <p id={`${idDesde}-error`} role="alert" className="campo-error mt-0 w-full">
                    La fecha «Desde» no puede ser posterior a «Hasta».
                  </p>
                )}
              </BarraFiltros>

              {!rangoInvalido && (
                <>
                  <Tabla
                    descripcion={`Movimientos de ${producto?.codigo ?? "el producto"} en orden cronológico`}
                    columnas={columnas}
                    filas={filas}
                    claveFila={(m) => m.id}
                    cargando={kardex.isFetching}
                    error={kardex.error}
                    reintentar={() => kardex.refetch()}
                    resaltar={(m) => (m.tipo === "AJUSTE_NEGATIVO" || m.tipo === "AJUSTE_POSITIVO" ? "ambar" : undefined)}
                    vacio={
                      hayFiltros
                        ? {
                            titulo: "Ningún movimiento con estos filtros",
                            descripcion: "Pruebe con otro tipo o con un rango de fechas más amplio.",
                            accion: (
                              <button type="button" onClick={() => setFiltros({ tipo: "", desde: "", hasta: "" })} className="btn-secundario">
                                Limpiar filtros
                              </button>
                            ),
                          }
                        : { titulo: "Este producto aún no tiene movimientos" }
                    }
                  />
                  {kardex.data && (
                    <Paginacion page={page} pageSize={PAGE_SIZE} total={kardex.data.total} alCambiar={setPage} />
                  )}
                </>
              )}
            </Tarjeta>
          </>
        )}
      </div>
    </>
  );
}

function CabeceraProducto({ kardex }: { kardex: Kardex | undefined }) {
  if (!kardex)
    return (
      <div role="status" aria-label="Cargando producto" className="h-48 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
    );
  const { producto: p, resumen: r } = kardex;
  return (
    <section aria-labelledby="kardex-producto" className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-600 tabular-nums">{p.codigo}</p>
          <h2 id="kardex-producto" className="text-lg font-semibold text-slate-900">
            {p.nombre}
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">Unidad: {p.unidad}</p>
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
          <div>
            <dt className="text-sm text-slate-600">Stock actual</dt>
            <dd className="mt-0.5 flex items-center gap-2">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{formatoNumero(p.stock)}</span>
              {p.enAlerta && <ChipStock stock={p.stock} stockMinimo={p.stockMinimo} />}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-600">Stock mínimo</dt>
            <dd className="mt-0.5 text-2xl font-bold text-slate-900 tabular-nums">{formatoNumero(p.stockMinimo)}</dd>
          </div>
        </dl>
      </div>
      <Resumen resumen={r} stock={p.stock} />
    </section>
  );
}

function Resumen({ resumen: r, stock }: { resumen: ResumenKardex; stock: number }) {
  const cifras = [
    { texto: "Entradas", valor: r.entradas, signo: "+" },
    { texto: "Salidas", valor: r.salidas, signo: "−" },
    { texto: "Ajustes +", valor: r.ajustesPositivos, signo: "+" },
    { texto: "Ajustes −", valor: r.ajustesNegativos, signo: "−" },
  ];
  return (
    <div className="px-4 py-4 sm:px-5">
      <h3 className="sr-only">Resumen de todos los movimientos</h3>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
        {cifras.map((c) => (
          <div key={c.texto}>
            <dt className="text-sm text-slate-600">{c.texto}</dt>
            <dd className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">
              {c.valor > 0 ? c.signo : ""}
              {formatoNumero(c.valor)}
            </dd>
          </div>
        ))}
        <div className="col-span-2 border-t border-slate-200 pt-3 sm:col-span-1 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
          <dt className="text-sm text-slate-600">Saldo calculado</dt>
          <dd className="mt-0.5 text-lg font-bold text-slate-900 tabular-nums">= {formatoNumero(r.saldoCalculado)}</dd>
        </div>
      </dl>
      <div className="mt-4">
        {r.cuadra ? (
          <p role="status" className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800">
            <CircleCheck aria-hidden className="size-4 shrink-0" />
            El stock cuadra con los movimientos: {formatoNumero(r.saldoCalculado)} calculado = {formatoNumero(stock)} en stock.
          </p>
        ) : (
          <p role="alert" className="flex items-center gap-2 rounded-lg bg-coral-50 px-3 py-2 text-sm font-medium text-coral-800">
            <TriangleAlert aria-hidden className="size-4 shrink-0" />
            El stock no cuadra: los movimientos suman {formatoNumero(r.saldoCalculado)}, pero el stock registrado es{" "}
            {formatoNumero(stock)} (diferencia {formatoNumero(stock - r.saldoCalculado)}).
          </p>
        )}
      </div>
    </div>
  );
}

