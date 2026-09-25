import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight, Download, FileClock, LoaderCircle, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { api, ApiError } from "../../api/cliente";
import { aQuery } from "../../api/tipos";
import { useUsuario } from "../../auth/AuthContext";
import { EstadoError } from "../../components/Estados";
import { Encabezado } from "../../components/Encabezado";
import { useNotificar } from "../../components/Notificaciones";
import { Tabla, type Columna } from "../../components/Tabla";
import { Tarjeta } from "../../components/Tarjeta";
import { formatoNumero, formatoSoles } from "../../utils/formato";
import { descargarVentasCsv } from "./exportarCsv";
import { GraficoEsqueleto, GraficoEstados, GraficoTopProductos, GraficoVendedores, GraficoVentasDia, GraficoZonas } from "./graficos";
import { FiltroPeriodo, usePeriodo } from "./Periodo";
import type { Tablero } from "./tipos";

type Alerta = Tablero["productosEnAlerta"][number];

export default function TableroPage() {
  const { rol } = useUsuario();
  const notificar = useNotificar();
  const periodo = usePeriodo();
  const { desde, hasta } = periodo.periodo;

  const consulta = useQuery({
    queryKey: ["reportes", "tablero", { desde, hasta }],
    queryFn: () => api.get<Tablero>(`/reportes/tablero${aQuery({ desde, hasta })}`),
    placeholderData: keepPreviousData,
  });
  const t = consulta.data;
  const cargandoInicial = !t && consulta.isPending;
  // Al cambiar el período, los gráficos conservan el dibujo anterior atenuado (sin saltos ni parpadeo).
  const atenuado = consulta.isFetching && consulta.isPlaceholderData;

  const [exportando, setExportando] = useState(false);
  async function exportar() {
    setExportando(true);
    try {
      const archivo = await descargarVentasCsv({ desde, hasta });
      notificar(`Se descargó ${archivo}`);
    } catch (e) {
      notificar(e instanceof ApiError ? e.message : "No se pudo descargar el archivo", "error");
    } finally {
      setExportando(false);
    }
  }

  const columnasAlerta: Columna<Alerta>[] = [
    {
      titulo: "Producto",
      celda: (a) => (
        <div className="max-w-72 min-w-44">
          <p className="truncate font-medium text-slate-900" title={a.nombre}>
            {a.nombre}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">{a.codigo}</p>
        </div>
      ),
    },
    { titulo: "Stock", alinear: "derecha", celda: (a) => <span className="font-semibold text-ambar-800">{formatoNumero(a.stock)}</span> },
    { titulo: "Mínimo", alinear: "derecha", ocultarEnMovil: true, celda: (a) => formatoNumero(a.stockMinimo) },
    { titulo: "Sugerido comprar", alinear: "derecha", celda: (a) => <span className="font-medium text-slate-900">{formatoNumero(a.cantidadSugerida)}</span> },
  ];

  return (
    <>
      <Encabezado
        titulo="Tablero"
        descripcion="Ventas despachadas del período, pedidos por estado y productos que necesitan reposición."
        acciones={
          <button type="button" onClick={exportar} disabled={exportando} className="btn-secundario">
            {exportando ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Download aria-hidden className="size-4" />}
            {exportando ? "Generando archivo…" : "Exportar ventas (CSV)"}
          </button>
        }
      />

      <FiltroPeriodo estado={periodo} />

      {consulta.error && !t ? (
        <Tarjeta>
          <EstadoError error={consulta.error} reintentar={() => consulta.refetch()} />
        </Tarjeta>
      ) : (
        <div className="space-y-6">
          <Indicadores tablero={t} atenuado={atenuado} />

          <Tarjeta
            titulo="Ventas por día"
            descripcion="Monto despachado cada día del período. Una venta cuenta el día en que sale del almacén."
          >
            {cargandoInicial || !t ? <GraficoEsqueleto alto={280} /> : <GraficoVentasDia datos={t.ventasPorDia} atenuado={atenuado} />}
          </Tarjeta>

          <div className="grid gap-6 lg:grid-cols-5">
            <Tarjeta
              className="min-w-0 lg:col-span-3"
              titulo="Productos más vendidos"
              descripcion="Los 10 productos con mayor monto vendido en el período."
            >
              {!t ? <GraficoEsqueleto alto={372} /> : <GraficoTopProductos datos={t.top10Productos} atenuado={atenuado} />}
            </Tarjeta>
            <Tarjeta
              className="min-w-0 lg:col-span-2"
              titulo="Pedidos por estado"
              descripcion="Todos los pedidos registrados en el período, según su estado actual."
            >
              {!t ? <GraficoEsqueleto alto={192} /> : <GraficoEstados datos={t.pedidosPorEstado} atenuado={atenuado} />}
            </Tarjeta>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Tarjeta className="min-w-0" titulo="Ventas por vendedor" descripcion="Monto despachado de los pedidos de cada vendedor.">
              {!t ? <GraficoEsqueleto alto={120} /> : <GraficoVendedores datos={t.ventasPorVendedor} atenuado={atenuado} />}
            </Tarjeta>
            <Tarjeta className="min-w-0" titulo="Ventas por zona" descripcion="Monto despachado según la zona de Trujillo del cliente.">
              {!t ? <GraficoEsqueleto alto={228} /> : <GraficoZonas datos={t.ventasPorZona} atenuado={atenuado} />}
            </Tarjeta>
          </div>

          <Tarjeta
            sinRelleno
            titulo="Productos en alerta de stock"
            descripcion="Productos activos con stock igual o menor al mínimo. Sugerido comprar = mínimo × 2 − stock."
            acciones={
              <>
                <Link to="/alertas" className="btn-secundario">
                  Ir a alertas de stock
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
                {rol === "GERENTE" && !!t?.productosEnAlerta.length && (
                  <Link to="/compras?sugerida=1" className="btn-primario">
                    <FileClock aria-hidden className="size-4" />
                    Generar orden de compra sugerida
                  </Link>
                )}
              </>
            }
          >
            <Tabla
              columnas={columnasAlerta}
              filas={t?.productosEnAlerta}
              claveFila={(a) => a.id}
              descripcion="Productos en alerta de stock"
              cargando={cargandoInicial}
              vacio={{ titulo: "Ningún producto está en alerta", descripcion: "Todos los productos activos tienen stock por encima de su mínimo." }}
            />
          </Tarjeta>
        </div>
      )}
    </>
  );
}

/**
 * Cifras del período en una sola franja (no cuatro tarjetas sueltas): etiqueta arriba, cifra grande,
 * sin adornos. Las ventas llevan el peso; «productos en alerta» es un enlace en ámbar a /alertas.
 */
function Indicadores({ tablero: t, atenuado }: { tablero?: Tablero; atenuado?: boolean }) {
  const alertas = t?.productosEnAlerta.length;
  const cifra = (valor: ReactNode) =>
    t ? valor : <span className="inline-block h-9 w-24 animate-pulse rounded bg-slate-100 align-middle" aria-hidden />;

  return (
    <section aria-label="Indicadores del período" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <dl
        aria-busy={!t || undefined}
        className={`grid grid-cols-2 gap-px bg-slate-200 transition-opacity duration-150 lg:grid-cols-[1.4fr_1fr_1fr_1fr] ${atenuado ? "opacity-60" : ""}`}
      >
        <Indicador etiqueta="Ventas del período" valor={cifra(formatoSoles(t?.ventasTotales))} />
        <Indicador etiqueta="Pedidos vendidos" valor={cifra(formatoNumero(t?.numPedidos))} />
        <Indicador etiqueta="Ticket promedio" valor={cifra(formatoSoles(t?.ticketPromedio))} />
        {/* Toda la celda es clicable: el enlace se estira sobre ella (dt/dd siguen siendo hijos directos del div). */}
        <div className="group relative flex min-h-28 min-w-0 flex-col justify-between gap-2 bg-white px-4 py-4 transition-colors duration-150 has-[a:hover]:bg-ambar-50 sm:px-5">
          <dt className="flex items-center gap-1.5 text-sm font-medium text-ambar-800">
            <TriangleAlert aria-hidden className="size-4 shrink-0" />
            Productos en alerta
          </dt>
          <dd className="flex flex-wrap items-end justify-between gap-x-2">
            <span className="text-2xl font-semibold tracking-tight text-ambar-800 sm:text-4xl">{cifra(formatoNumero(alertas))}</span>
            <Link
              to="/alertas"
              className="mb-1 inline-flex items-center gap-1 rounded text-sm font-medium text-ambar-800 group-hover:underline after:absolute after:inset-0 after:content-['']"
            >
              Revisar alertas
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </dd>
        </div>
      </dl>
    </section>
  );
}

function Indicador({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <div className="flex min-h-28 min-w-0 flex-col justify-between gap-2 bg-white px-4 py-4 sm:px-5">
      <dt className="text-sm font-medium text-slate-600">{etiqueta}</dt>
      <dd className="text-2xl font-semibold tracking-tight break-words text-slate-900 sm:text-4xl">{valor}</dd>
    </div>
  );
}
