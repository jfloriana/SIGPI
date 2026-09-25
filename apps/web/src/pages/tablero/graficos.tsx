import { useEffect, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EstadoPedido } from "../../components/Chip";
import { TEXTO_ESTADO_PEDIDO } from "../../components/Chip";
import { EstadoVacio } from "../../components/Estados";
import { formatoNumero, formatoSoles } from "../../utils/formato";

/*
 * Colores de los gráficos: solo tokens del sistema (variables CSS de Tailwind).
 * - Una sola serie (ventas) → un solo tono, marino-500, en todas las barras y en la línea.
 * - Pedidos por estado → los mismos tonos que ChipEstadoPedido, siempre con el nombre del estado al lado.
 */
const SERIE = "var(--color-marino-500)";
const REJILLA = "var(--color-slate-200)";
const TEXTO_EJE = "var(--color-slate-600)";
const COLOR_ESTADO: Record<EstadoPedido, string> = {
  REGISTRADO: "var(--color-slate-400)",
  APROBADO: "var(--color-marino-500)",
  DESPACHADO: "var(--color-ambar)",
  ENTREGADO: "var(--color-teal)",
  ANULADO: "var(--color-coral)",
};
const TICK = { fill: TEXTO_EJE, fontSize: 12 };

/** `2026-09-24` → `24/09`. Se corta el texto: las fechas del reporte ya vienen en hora de Lima. */
export const fechaCorta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/** `2026-09-24` → `24/09/2026`. */
export const fechaLarga = (iso: string) => `${fechaCorta(iso)}/${iso.slice(0, 4)}`;
const DIA_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const diaSemana = (iso: string) => DIA_SEMANA[new Date(`${iso}T12:00:00Z`).getUTCDay()];

/** Soles compactos para ejes y etiquetas: `S/ 850`, `S/ 1.2 mil`, `S/ 35 mil`. */
export function solesCorto(valor: number) {
  if (Math.abs(valor) < 1000) return `S/ ${formatoNumero(valor)}`;
  const miles = valor / 1000;
  return `S/ ${miles >= 10 ? formatoNumero(miles) : miles.toFixed(1).replace(/\.0$/, "")} mil`;
}

/** Marcas «redondas» del eje de montos (0, 500, 1 000…): nunca 650 ni 1.3 mil. */
export function marcasRedondas(maximo: number, cantidad = 4) {
  if (maximo <= 0) return [0];
  const bruto = maximo / cantidad;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const paso = ([1, 2, 2.5, 5, 10].find((f) => f * potencia >= bruto) ?? 10) * potencia;
  return Array.from({ length: Math.ceil(maximo / paso) + 1 }, (_, i) => i * paso);
}

/** Ancho de la ventana por debajo de `sm` (para ejes más angostos en celular). */
function useAngosto() {
  const consulta = "(max-width: 639px)";
  const [angosto, setAngosto] = useState(() => window.matchMedia(consulta).matches);
  useEffect(() => {
    const mq = window.matchMedia(consulta);
    const alCambiar = () => setAngosto(mq.matches);
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, []);
  return angosto;
}

/* ─────────────────────────── Piezas comunes ─────────────────────────── */

/** Contenedor de altura fija (incluye los ejes) para que el diseño no salte al cargar. */
function Lienzo({ alto, atenuado, children }: { alto: number; atenuado?: boolean; children: ReactNode }) {
  return (
    <div style={{ height: alto }} className={`min-w-0 transition-opacity duration-150 ${atenuado ? "opacity-60" : ""}`}>
      {children}
    </div>
  );
}

/** Marcador de carga con la misma altura que el gráfico. */
export function GraficoEsqueleto({ alto }: { alto: number }) {
  return (
    <div role="status" aria-label="Cargando gráfico" style={{ height: alto }} className="flex flex-col justify-end gap-3">
      {[0.55, 0.8, 0.4, 0.95, 0.65].map((ancho, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded bg-slate-100"
          style={{ width: `${ancho * 100}%`, animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

function Vacio({ alto, titulo, descripcion }: { alto: number; titulo: string; descripcion: string }) {
  return (
    <div style={{ minHeight: alto }} className="grid place-items-center">
      <EstadoVacio titulo={titulo} descripcion={descripcion} />
    </div>
  );
}

/** Globo del gráfico: el valor manda, la etiqueta acompaña. */
function Globo({ titulo, filas }: { titulo: string; filas: { clave: string; valor: string; color?: string }[] }) {
  return (
    <div className="max-w-72 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md shadow-slate-900/10">
      <p className="text-xs text-slate-600">{titulo}</p>
      {filas.map((f) => (
        <p key={f.clave} className="mt-0.5 flex items-center gap-2">
          {f.color && <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: f.color }} />}
          <span className="font-semibold text-slate-900 tabular-nums">{f.valor}</span>
          <span className="text-slate-600">{f.clave}</span>
        </p>
      ))}
    </div>
  );
}

/** Tabla equivalente al gráfico (acceso sin ratón y sin depender del color). */
function VerDatos({
  titulo,
  columnas,
  filas,
}: {
  titulo: string;
  columnas: { titulo: string; derecha?: boolean }[];
  filas: { clave: string | number; celdas: ReactNode[] }[];
}) {
  return (
    <details className="group mt-3 border-t border-slate-100 pt-2">
      <summary className="-mx-2 inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-marino hover:bg-slate-50">
        <span className="group-open:hidden">Ver datos en tabla</span>
        <span className="hidden group-open:inline">Ocultar tabla</span>
      </summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <caption className="sr-only">{titulo}</caption>
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              {columnas.map((c) => (
                <th
                  key={c.titulo}
                  scope="col"
                  className={`px-3 py-2 text-xs font-semibold whitespace-nowrap text-slate-600 ${c.derecha ? "text-right" : "text-left"}`}
                >
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.clave} className="border-t border-slate-100">
                {f.celdas.map((celda, i) => (
                  <td key={i} className={`px-3 py-1.5 ${columnas[i]?.derecha ? "text-right tabular-nums" : ""}`}>
                    {celda}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Recorta un nombre largo para el eje; el nombre completo va en `<title>` y en el globo. */
function recortar(texto: string, max: number) {
  return texto.length > max ? `${texto.slice(0, max - 1).trimEnd()}…` : texto;
}

function EtiquetaEje({ x, y, payload, maxCaracteres }: { x?: number | string; y?: number | string; payload?: { value: string }; maxCaracteres: number }) {
  const texto = payload?.value ?? "";
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill={TEXTO_EJE} fontSize={12}>
      <title>{texto}</title>
      {recortar(texto, maxCaracteres)}
    </text>
  );
}

/* ─────────────────────────── Ventas por día ─────────────────────────── */

export function GraficoVentasDia({ datos, atenuado }: { datos: { fecha: string; total: string; pedidos: number }[]; atenuado?: boolean }) {
  const alto = 280;
  const filas = datos.map((d) => ({ ...d, monto: Number(d.total) }));
  if (!filas.some((d) => d.monto > 0))
    return <Vacio alto={alto} titulo="No hubo ventas en este período" descripcion="Las ventas se cuentan al despachar el pedido. Pruebe con un rango más amplio." />;
  const conVentas = filas.filter((d) => d.monto > 0);
  const marcas = marcasRedondas(Math.max(...filas.map((d) => d.monto)));
  // Con pocos días los puntos ayudan a leer; con 90 días solo ensucian.
  const puntos = filas.length <= 31;

  return (
    <>
      <Lienzo alto={alto} atenuado={atenuado}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: alto }}>
          <AreaChart data={filas} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke={REJILLA} />
            <XAxis
              dataKey="fecha"
              tickFormatter={fechaCorta}
              tick={TICK}
              tickLine={false}
              axisLine={{ stroke: REJILLA }}
              minTickGap={28}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={solesCorto}
              tick={TICK}
              tickLine={false}
              axisLine={false}
              width={72}
              ticks={marcas}
              domain={[0, marcas[marcas.length - 1]]}
            />
            <Tooltip
              cursor={{ stroke: "var(--color-slate-400)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                const d = active ? (payload?.[0]?.payload as (typeof filas)[number] | undefined) : undefined;
                if (!d) return null;
                return (
                  <Globo
                    titulo={`${diaSemana(d.fecha)} ${fechaLarga(d.fecha)}`}
                    filas={[
                      { clave: "vendido", valor: formatoSoles(d.total), color: SERIE },
                      { clave: d.pedidos === 1 ? "pedido" : "pedidos", valor: String(d.pedidos) },
                    ]}
                  />
                );
              }}
            />
            <Area
              type="linear"
              dataKey="monto"
              name="Ventas"
              stroke={SERIE}
              strokeWidth={2}
              fill={SERIE}
              fillOpacity={0.1}
              dot={(props: { cx?: number; cy?: number; index?: number; payload?: { monto: number } }) =>
                puntos && props.payload && props.payload.monto > 0 ? (
                  <circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill={SERIE} stroke="var(--color-white)" strokeWidth={2} />
                ) : (
                  <g key={props.index} />
                )
              }
              activeDot={{ r: 5, fill: SERIE, stroke: "var(--color-white)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Lienzo>
      <VerDatos
        titulo="Ventas por día"
        columnas={[{ titulo: "Fecha" }, { titulo: "Pedidos", derecha: true }, { titulo: "Ventas", derecha: true }]}
        filas={conVentas.map((d) => ({ clave: d.fecha, celdas: [fechaLarga(d.fecha), d.pedidos, formatoSoles(d.total)] }))}
      />
    </>
  );
}

/* ───────────────────── Barras horizontales (ranking) ───────────────────── */

interface FilaBarra {
  clave: string;
  nombre: string;
  valor: number;
  color?: string;
  /** Texto del globo debajo del valor (p. ej., «12 unidades · ARR-001»). */
  detalle?: string;
}

function BarrasHorizontales({
  filas,
  formatoValor,
  formatoEtiqueta,
  claveGlobo,
  anchoEje,
  atenuado,
}: {
  filas: FilaBarra[];
  formatoValor: (v: number) => string;
  formatoEtiqueta: (v: number) => string;
  claveGlobo: string;
  anchoEje: { normal: number; angosto: number };
  atenuado?: boolean;
}) {
  const angosto = useAngosto();
  const ancho = angosto ? anchoEje.angosto : anchoEje.normal;
  const alto = filas.length * 36 + 12;
  return (
    <Lienzo alto={alto} atenuado={atenuado}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: alto }}>
        <BarChart data={filas} layout="vertical" margin={{ top: 4, right: 76, bottom: 4, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="nombre"
            width={ancho}
            tickLine={false}
            axisLine={{ stroke: REJILLA }}
            interval={0}
            tick={(props) => <EtiquetaEje {...props} maxCaracteres={Math.floor(ancho / 6.6)} />}
          />
          <Tooltip
            cursor={{ fill: "var(--color-slate-100)" }}
            content={({ active, payload }) => {
              const f = active ? (payload?.[0]?.payload as FilaBarra | undefined) : undefined;
              if (!f) return null;
              return (
                <Globo
                  titulo={f.nombre}
                  filas={[
                    { clave: claveGlobo, valor: formatoValor(f.valor), color: f.color ?? SERIE },
                    ...(f.detalle ? [{ clave: "", valor: f.detalle }] : []),
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="valor" barSize={22} radius={[0, 4, 4, 0]} fill={SERIE} isAnimationActive={false} minPointSize={2}>
            {filas.map((f) => (
              <Cell key={f.clave} fill={f.color ?? SERIE} />
            ))}
            <LabelList
              dataKey="valor"
              position="right"
              offset={8}
              formatter={(v: unknown) => formatoEtiqueta(Number(v))}
              style={{ fill: "var(--color-slate-800)", fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Lienzo>
  );
}

const SIN_VENTAS = {
  titulo: "Sin ventas en este período",
  descripcion: "Las ventas se cuentan al despachar el pedido.",
};

export function GraficoTopProductos({ datos, atenuado }: { datos: { productoId: number; codigo: string; nombre: string; cantidad: number; total: string }[]; atenuado?: boolean }) {
  if (datos.length === 0) return <Vacio alto={200} {...SIN_VENTAS} />;
  return (
    <>
      <BarrasHorizontales
        filas={datos.map((p) => ({
          clave: String(p.productoId),
          nombre: p.nombre,
          valor: Number(p.total),
          detalle: `${formatoNumero(p.cantidad)} ${p.cantidad === 1 ? "unidad" : "unidades"} · ${p.codigo}`,
        }))}
        formatoValor={formatoSoles}
        formatoEtiqueta={solesCorto}
        claveGlobo="vendido"
        anchoEje={{ normal: 200, angosto: 124 }}
        atenuado={atenuado}
      />
      <VerDatos
        titulo="Top 10 de productos por monto vendido"
        columnas={[{ titulo: "Producto" }, { titulo: "Unidades", derecha: true }, { titulo: "Vendido", derecha: true }]}
        filas={datos.map((p) => ({
          clave: p.productoId,
          celdas: [`${p.codigo} · ${p.nombre}`, formatoNumero(p.cantidad), formatoSoles(p.total)],
        }))}
      />
    </>
  );
}

export function GraficoVendedores({ datos, atenuado }: { datos: { vendedorId: number; nombre: string; total: string; pedidos: number }[]; atenuado?: boolean }) {
  if (datos.length === 0) return <Vacio alto={160} {...SIN_VENTAS} />;
  return (
    <>
      <BarrasHorizontales
        filas={datos.map((v) => ({
          clave: String(v.vendedorId),
          nombre: v.nombre,
          valor: Number(v.total),
          detalle: `${v.pedidos} ${v.pedidos === 1 ? "pedido" : "pedidos"}`,
        }))}
        formatoValor={formatoSoles}
        formatoEtiqueta={solesCorto}
        claveGlobo="vendido"
        anchoEje={{ normal: 160, angosto: 116 }}
        atenuado={atenuado}
      />
      <VerDatos
        titulo="Ventas por vendedor"
        columnas={[{ titulo: "Vendedor" }, { titulo: "Pedidos", derecha: true }, { titulo: "Vendido", derecha: true }]}
        filas={datos.map((v) => ({ clave: v.vendedorId, celdas: [v.nombre, v.pedidos, formatoSoles(v.total)] }))}
      />
    </>
  );
}

export function GraficoZonas({ datos, atenuado }: { datos: { zona: string; total: string; pedidos: number }[]; atenuado?: boolean }) {
  if (!datos.some((z) => Number(z.total) > 0)) return <Vacio alto={220} {...SIN_VENTAS} />;
  return (
    <>
      <BarrasHorizontales
        filas={datos.map((z) => ({
          clave: z.zona,
          nombre: z.zona,
          valor: Number(z.total),
          detalle: `${z.pedidos} ${z.pedidos === 1 ? "pedido" : "pedidos"}`,
        }))}
        formatoValor={formatoSoles}
        formatoEtiqueta={solesCorto}
        claveGlobo="vendido"
        anchoEje={{ normal: 104, angosto: 96 }}
        atenuado={atenuado}
      />
      <VerDatos
        titulo="Ventas por zona"
        columnas={[{ titulo: "Zona" }, { titulo: "Pedidos", derecha: true }, { titulo: "Vendido", derecha: true }]}
        filas={datos.map((z) => ({ clave: z.zona, celdas: [z.zona, z.pedidos, formatoSoles(z.total)] }))}
      />
    </>
  );
}

export function GraficoEstados({ datos, atenuado }: { datos: { estado: EstadoPedido; cantidad: number }[]; atenuado?: boolean }) {
  const total = datos.reduce((s, e) => s + e.cantidad, 0);
  if (total === 0) return <Vacio alto={200} titulo="No se registraron pedidos" descripcion="Aquí se cuentan todos los pedidos por su fecha de registro." />;
  const porcentaje = (n: number) => `${Math.round((n / total) * 100)} %`;
  return (
    <>
      <BarrasHorizontales
        filas={datos.map((e) => ({
          clave: e.estado,
          nombre: TEXTO_ESTADO_PEDIDO[e.estado],
          valor: e.cantidad,
          color: COLOR_ESTADO[e.estado],
          detalle: `${porcentaje(e.cantidad)} del total`,
        }))}
        formatoValor={(v) => `${formatoNumero(v)} ${v === 1 ? "pedido" : "pedidos"}`}
        formatoEtiqueta={formatoNumero}
        claveGlobo=""
        anchoEje={{ normal: 96, angosto: 92 }}
        atenuado={atenuado}
      />
      <VerDatos
        titulo="Pedidos por estado"
        columnas={[{ titulo: "Estado" }, { titulo: "Pedidos", derecha: true }, { titulo: "Porcentaje", derecha: true }]}
        filas={datos.map((e) => ({
          clave: e.estado,
          celdas: [TEXTO_ESTADO_PEDIDO[e.estado], e.cantidad, porcentaje(e.cantidad)],
        }))}
      />
    </>
  );
}
