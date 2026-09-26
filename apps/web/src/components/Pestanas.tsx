import { useRef, type KeyboardEvent } from "react";

export interface Pestana<T extends string> {
  id: T;
  texto: string;
  /** Conteo opcional junto al texto (p. ej., total de categorías). */
  cuenta?: number;
}

/**
 * Pestañas accesibles (patrón WAI-ARIA con activación automática): flechas izquierda/derecha,
 * Inicio y Fin mueven el foco y eligen la pestaña. Los paneles los pinta quien la usa con
 * `id={`${idBase}-panel-${id}`}` y `aria-labelledby={`${idBase}-tab-${id}`}`.
 */
export function Pestanas<T extends string>({
  etiqueta,
  idBase,
  pestanas,
  activa,
  alElegir,
}: {
  etiqueta: string;
  idBase: string;
  pestanas: readonly Pestana<T>[];
  activa: T;
  alElegir: (id: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function tecla(e: KeyboardEvent, i: number) {
    const n = pestanas.length;
    let destino = -1;
    if (e.key === "ArrowRight") destino = (i + 1) % n;
    else if (e.key === "ArrowLeft") destino = (i - 1 + n) % n;
    else if (e.key === "Home") destino = 0;
    else if (e.key === "End") destino = n - 1;
    if (destino < 0) return;
    e.preventDefault();
    alElegir(pestanas[destino].id);
    refs.current[destino]?.focus();
  }

  return (
    <div role="tablist" aria-label={etiqueta} className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
      {pestanas.map((t, i) => {
        const sel = activa === t.id;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${t.id}`}
            aria-selected={sel}
            aria-controls={`${idBase}-panel-${t.id}`}
            tabIndex={sel ? 0 : -1}
            onClick={() => alElegir(t.id)}
            onKeyDown={(e) => tecla(e, i)}
            className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-150 ease-[var(--ease-salida)] focus-visible:-outline-offset-2 ${
              sel ? "border-marino text-marino-800" : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
            }`}
          >
            {t.texto}
            {t.cuenta !== undefined && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs tabular-nums transition-colors duration-150 ${
                  sel ? "bg-marino-50 text-marino-800" : "bg-slate-100 text-slate-700"
                }`}
              >
                {t.cuenta}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
