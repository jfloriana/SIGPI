import { LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useId, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";

/** Devuelve `valor` tras `ms` sin cambios (para no consultar la API en cada tecla). */
export function useRetardado<T>(valor: T, ms = 150): T {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}

interface Props<T> {
  etiqueta: string;
  placeholder: string;
  /** Ayuda bajo el campo cuando no se ha escrito nada. */
  ayuda: ReactNode;
  texto: string;
  alCambiarTexto: (t: string) => void;
  resultados: T[] | undefined;
  total?: number;
  cargando: boolean;
  errorCarga?: string | null;
  /** Error de validación del formulario (se muestra bajo el campo). */
  error?: string;
  claveDe: (r: T) => number;
  textoDe: (r: T) => string;
  pintar: (r: T) => ReactNode;
  deshabilitado?: (r: T) => boolean;
  alElegir: (r: T) => void;
  sinResultados: (texto: string) => ReactNode;
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * Buscador con resultados en lista (patrón combobox de ARIA): flechas para moverse, Enter para
 * elegir y Escape para limpiar. La lista va en el flujo de la página (no flota), así no se
 * recorta dentro de contenedores con scroll y en el celular empuja el contenido.
 */
export function BuscadorLista<T>({
  etiqueta,
  placeholder,
  ayuda,
  texto,
  alCambiarTexto,
  resultados,
  total,
  cargando,
  errorCarga,
  error,
  claveDe,
  textoDe,
  pintar,
  deshabilitado,
  alElegir,
  sinResultados,
  inputRef,
}: Props<T>) {
  const id = useId();
  const idLista = `${id}-lista`;
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const [activo, setActivo] = useState(0);
  const abierto = texto.trim().length > 0;
  const lista = abierto ? (resultados ?? []) : [];

  useEffect(() => setActivo(0), [resultados]);

  function elegir(r: T) {
    if (deshabilitado?.(r)) return;
    alElegir(r);
  }

  function alTeclear(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && lista.length) {
      e.preventDefault();
      setActivo((i) => (i + 1) % lista.length);
    } else if (e.key === "ArrowUp" && lista.length) {
      e.preventDefault();
      setActivo((i) => (i - 1 + lista.length) % lista.length);
    } else if (e.key === "Enter") {
      // Enter nunca envía el formulario desde el buscador.
      e.preventDefault();
      const r = lista[activo];
      if (r) elegir(r);
    } else if (e.key === "Escape" && texto) {
      e.preventDefault();
      alCambiarTexto("");
    }
  }

  const describedBy = error ? idError : !abierto ? idAyuda : undefined;

  return (
    <div>
      <label htmlFor={id} className="campo-etiqueta">
        {etiqueta}
      </label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
        <input
          ref={inputRef}
          id={id}
          type="search"
          role="combobox"
          aria-expanded={abierto && lista.length > 0}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={abierto && lista[activo] ? `${id}-op-${claveDe(lista[activo])}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          value={texto}
          onChange={(e) => alCambiarTexto(e.target.value)}
          onKeyDown={alTeclear}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          className="campo-control pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
        />
        {texto && (
          <button
            type="button"
            onClick={() => alCambiarTexto("")}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500 hover:text-slate-900"
            aria-label="Limpiar búsqueda"
          >
            {cargando ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <X aria-hidden className="size-4" />}
          </button>
        )}
      </div>
      {error && (
        <p id={idError} className="campo-error">
          {error}
        </p>
      )}
      {!abierto && !error && (
        <p id={idAyuda} className="mt-1.5 text-sm text-slate-600">
          {ayuda}
        </p>
      )}

      <ul
        id={idLista}
        role="listbox"
        aria-label={etiqueta}
        hidden={!abierto || lista.length === 0}
        className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white"
      >
        {lista.map((r, i) => {
          const off = deshabilitado?.(r) ?? false;
          return (
            <li
              key={claveDe(r)}
              id={`${id}-op-${claveDe(r)}`}
              role="option"
              aria-selected={i === activo}
              aria-disabled={off || undefined}
              aria-label={textoDe(r)}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActivo(i)}
              onClick={() => elegir(r)}
              className={`flex min-h-12 items-center gap-3 px-3 py-2 transition-colors duration-100 ${
                off ? "cursor-not-allowed opacity-60" : "cursor-pointer"
              } ${i === activo && !off ? "bg-marino-50" : ""}`}
            >
              {pintar(r)}
            </li>
          );
        })}
      </ul>

      {abierto && (
        <p aria-live="polite" className="mt-1.5 text-sm text-slate-600">
          {errorCarga ? (
            <span className="text-coral-700">{errorCarga}</span>
          ) : resultados === undefined ? (
            "Buscando…"
          ) : lista.length === 0 ? (
            sinResultados(texto.trim())
          ) : total !== undefined && total > lista.length ? (
            `Se muestran ${lista.length} de ${total}: siga escribiendo para afinar.`
          ) : null}
        </p>
      )}
    </div>
  );
}
