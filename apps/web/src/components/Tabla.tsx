import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { EstadoError, EstadoVacio } from "./Estados";

export interface Columna<T> {
  /** Encabezado visible. */
  titulo: string;
  /** Contenido de la celda. */
  celda: (fila: T) => ReactNode;
  /** Alineación: números y montos a la derecha. */
  alinear?: "izquierda" | "derecha" | "centro";
  /** Oculta la columna en pantallas angostas (se sigue viendo en el detalle). */
  ocultarEnMovil?: boolean;
  /**
   * Columna de acción fija al borde derecho en pantallas angostas: si la tabla hace scroll horizontal,
   * el botón sigue a la vista sin desplazar.
   */
  fijaEnMovil?: boolean;
  className?: string;
}

interface PropsTabla<T> {
  columnas: Columna<T>[];
  filas: T[] | undefined;
  claveFila: (fila: T) => string | number;
  /** Texto accesible que describe la tabla (se muestra como caption solo para lectores de pantalla). */
  descripcion: string;
  cargando?: boolean;
  error?: unknown;
  reintentar?: () => void;
  vacio?: { titulo: string; descripcion?: ReactNode; accion?: ReactNode };
  /** Si se indica, la fila completa es navegable/seleccionable (el enlace/botón principal va en una celda). */
  alSeleccionar?: (fila: T) => void;
  /** Marca visualmente filas (p. ej., productos en alerta). */
  resaltar?: (fila: T) => "ambar" | "coral" | undefined;
}

const ALINEAR = { izquierda: "text-left", derecha: "text-right tabular-nums", centro: "text-center" };

/*
 * Celda fija (solo < md): fondo opaco equivalente al de la fila y un filo slate-200 a la izquierda.
 * Los fondos traslúcidos de fila (hover marino-50/60, alerta ámbar-50/60) se replican mezclados con blanco.
 */
const FIJA = "max-md:sticky max-md:right-0 max-md:z-[1] max-md:shadow-[inset_1px_0_0_var(--color-slate-200)]";
const FONDO_FIJA = {
  normal: "bg-white",
  ambar: "bg-[color-mix(in_oklab,var(--color-ambar-50)_60%,white)]",
  coral: "bg-[color-mix(in_oklab,var(--color-coral-50)_60%,white)]",
};
const HOVER_FIJA = "group-hover:bg-[color-mix(in_oklab,var(--color-marino-50)_60%,white)]";

/**
 * Tabla de datos con estados de carga, vacío y error. En celular hace scroll horizontal
 * dentro de su propio contenedor (la página nunca se desborda).
 */
export function Tabla<T>({
  columnas,
  filas,
  claveFila,
  descripcion,
  cargando,
  error,
  reintentar,
  vacio = { titulo: "No hay registros" },
  alSeleccionar,
  resaltar,
}: PropsTabla<T>) {
  if (error) return <EstadoError error={error} reintentar={reintentar} />;
  if (cargando && !filas) return <TablaEsqueleto columnas={columnas.length} />;
  if (!filas || filas.length === 0) return <EstadoVacio {...vacio} />;

  return (
    // Región con scroll alcanzable con el teclado (axe: scrollable-region-focusable) cuando la tabla se desborda.
    <div role="region" aria-label={descripcion} tabIndex={0} className="relative -mx-px overflow-x-auto focus-visible:outline-offset-[-2px]">
      <table className="w-full min-w-max border-collapse text-sm">
        <caption className="sr-only">{descripcion}</caption>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columnas.map((c) => (
              <th
                key={c.titulo}
                scope="col"
                className={`px-4 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap text-slate-600 uppercase ${
                  ALINEAR[c.alinear ?? "izquierda"]
                } ${c.ocultarEnMovil ? "hidden md:table-cell" : ""} ${c.fijaEnMovil ? `${FIJA} bg-slate-50` : ""} ${c.className ?? ""}`}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={cargando ? "opacity-60 transition-opacity duration-150" : ""}>
          {filas.map((fila) => {
            const marca = resaltar?.(fila);
            return (
              <tr
                key={claveFila(fila)}
                onClick={alSeleccionar ? () => alSeleccionar(fila) : undefined}
                className={`group border-b border-slate-100 transition-colors duration-150 last:border-0 ${
                  alSeleccionar ? "cursor-pointer hover:bg-marino-50/60" : ""
                } ${marca === "ambar" ? "bg-ambar-50/60" : marca === "coral" ? "bg-coral-50/60" : ""}`}
              >
                {columnas.map((c) => (
                  <td
                    key={c.titulo}
                    className={`relative px-4 py-3 align-middle ${ALINEAR[c.alinear ?? "izquierda"]} ${
                      c.ocultarEnMovil ? "hidden md:table-cell" : ""
                    } ${
                      c.fijaEnMovil
                        ? `${FIJA} max-md:transition-colors max-md:duration-150 ${FONDO_FIJA[marca ?? "normal"]} ${alSeleccionar ? HOVER_FIJA : ""} md:bg-transparent`
                        : ""
                    } ${c.className ?? ""}`}
                  >
                    {c.celda(fila)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Filas grises mientras llega la primera carga (evita saltos de diseño). */
export function TablaEsqueleto({ columnas, filas = 6 }: { columnas: number; filas?: number }) {
  return (
    <div role="status" aria-label="Cargando registros" className="divide-y divide-slate-100">
      <div className="h-10 bg-slate-50" />
      {Array.from({ length: filas }, (_, f) => (
        <div key={f} className="flex gap-4 px-4 py-3.5">
          {Array.from({ length: columnas }, (_, c) => (
            <div
              key={c}
              className="h-3.5 flex-1 animate-pulse rounded bg-slate-100"
              style={{ maxWidth: c === 0 ? "7rem" : undefined, animationDelay: `${f * 60}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Paginación "Anterior / Siguiente" con conteo. */
export function Paginacion({
  page,
  pageSize,
  total,
  alCambiar,
}: {
  page: number;
  pageSize: number;
  total: number;
  alCambiar: (page: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const desde = (page - 1) * pageSize + 1;
  const hasta = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm">
      <p className="text-slate-600">
        <span className="font-medium text-slate-900 tabular-nums">
          {desde}–{hasta}
        </span>{" "}
        de <span className="font-medium text-slate-900 tabular-nums">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => alCambiar(page - 1)} disabled={page <= 1} className="btn-secundario px-3">
          <ChevronLeft aria-hidden className="size-4" />
          Anterior
        </button>
        <span className="px-1 text-slate-600 tabular-nums">
          {page} / {paginas}
        </span>
        <button type="button" onClick={() => alCambiar(page + 1)} disabled={page >= paginas} className="btn-secundario px-3">
          Siguiente
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>
    </nav>
  );
}
