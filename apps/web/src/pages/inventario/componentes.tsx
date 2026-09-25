import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useId, useState, type KeyboardEvent, type Ref } from "react";
import { api } from "../../api/cliente";
import { aQuery, type Paginado } from "../../api/tipos";
import { Chip } from "../../components/Chip";
import { formatoNumero } from "../../utils/formato";
import { INFO_TIPO, type TipoMovimiento } from "./tipos";

export interface ProductoBuscado {
  id: number;
  codigo: string;
  nombre: string;
  unidad: string;
  stock: number;
  stockMinimo: number;
  enAlerta: boolean;
  activo: boolean;
  categoria: { id: number; nombre: string };
}

export function ChipTipoMovimiento({ tipo }: { tipo: TipoMovimiento }) {
  const t = INFO_TIPO[tipo];
  return <Chip tono={t.tono}>{t.texto}</Chip>;
}

/**
 * Barra horizontal «stock frente a mínimo». El ancho completo representa el stock mínimo;
 * la parte rellena es el stock y la parte rayada, lo que falta. El número va siempre en texto.
 */
export function BarraStock({ stock, stockMinimo, unidad }: { stock: number; stockMinimo: number; unidad: string }) {
  const pct = stockMinimo > 0 ? Math.min(100, Math.max(0, (stock / stockMinimo) * 100)) : 100;
  const falta = Math.max(0, stockMinimo - stock);
  return (
    <div className="w-44 sm:w-56">
      <p className="flex items-baseline justify-between gap-2 text-sm whitespace-nowrap">
        <span>
          <strong className="font-semibold text-slate-900 tabular-nums">{formatoNumero(stock)}</strong>
          <span className="text-slate-600"> de {formatoNumero(stockMinimo)} {unidad}</span>
        </span>
        <span className="text-xs font-semibold text-ambar-800 tabular-nums">{Math.round(pct)} %</span>
      </p>
      <div
        aria-hidden
        className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-[repeating-linear-gradient(135deg,var(--color-ambar-100)_0_4px,var(--color-ambar-50)_4px_8px)] ring-1 ring-ambar-100 ring-inset"
      >
        <div className="h-full rounded-full bg-ambar" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-600">
        {falta > 0 ? (
          <>
            Faltan <span className="font-semibold text-slate-900 tabular-nums">{formatoNumero(falta)}</span> para el mínimo
          </>
        ) : (
          "En el mínimo"
        )}
      </p>
    </div>
  );
}

function useRetardado<T>(valor: T, ms = 200): T {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}

/**
 * Buscador de productos (patrón combobox de ARIA) contra `GET /productos?buscar=&pageSize=20`.
 * Flechas para moverse, Enter para elegir, Escape para limpiar. La lista va en el flujo de la página.
 */
export function SelectorProducto({
  etiqueta,
  ayuda,
  error,
  alElegir,
  inputRef,
}: {
  etiqueta: string;
  ayuda: string;
  error?: string;
  alElegir: (p: ProductoBuscado) => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const [activo, setActivo] = useState(0);
  const buscar = useRetardado(texto.trim());
  const abierto = texto.trim().length > 0;

  const consulta = useQuery({
    queryKey: ["productos", "buscador-inventario", buscar],
    queryFn: () => api.get<Paginado<ProductoBuscado>>(`/productos${aQuery({ buscar, pageSize: 20 })}`),
    enabled: buscar.length > 0,
    placeholderData: keepPreviousData,
  });

  const lista = abierto && buscar ? (consulta.data?.datos ?? []) : [];
  useEffect(() => setActivo(0), [consulta.data]);

  function elegir(p: ProductoBuscado) {
    alElegir(p);
    setTexto("");
  }

  function alTeclear(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && lista.length) {
      e.preventDefault();
      setActivo((i) => (i + 1) % lista.length);
    } else if (e.key === "ArrowUp" && lista.length) {
      e.preventDefault();
      setActivo((i) => (i - 1 + lista.length) % lista.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const p = lista[activo];
      if (p) elegir(p);
    } else if (e.key === "Escape" && texto) {
      e.preventDefault();
      setTexto("");
    }
  }

  const esperando = abierto && (buscar !== texto.trim() || consulta.isFetching);

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
          aria-expanded={lista.length > 0}
          aria-controls={`${id}-lista`}
          aria-autocomplete="list"
          aria-activedescendant={lista[activo] ? `${id}-op-${lista[activo].id}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : !abierto ? `${id}-ayuda` : undefined}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={alTeclear}
          placeholder="Código o nombre, p. ej. ARR-005"
          autoComplete="off"
          enterKeyHint="search"
          className="campo-control pr-11 pl-9 [&::-webkit-search-cancel-button]:hidden"
        />
        {texto && (
          <button
            type="button"
            onClick={() => setTexto("")}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500 hover:text-slate-900"
            aria-label="Limpiar búsqueda"
          >
            {esperando ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <X aria-hidden className="size-4" />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="campo-error">
          {error}
        </p>
      )}
      {!abierto && !error && (
        <p id={`${id}-ayuda`} className="mt-1.5 text-sm text-slate-600">
          {ayuda}
        </p>
      )}

      <ul
        id={`${id}-lista`}
        role="listbox"
        aria-label={etiqueta}
        hidden={lista.length === 0}
        className="mt-2 max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white"
      >
        {lista.map((p, i) => (
          <li
            key={p.id}
            id={`${id}-op-${p.id}`}
            role="option"
            aria-selected={i === activo}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActivo(i)}
            onClick={() => elegir(p)}
            className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 px-3 py-2 transition-colors duration-100 ${
              i === activo ? "bg-marino-50" : ""
            }`}
          >
            <span className="min-w-0">
              <span className="mr-2 text-sm font-semibold text-slate-900 tabular-nums">{p.codigo}</span>
              <span className="text-sm text-slate-800">{p.nombre}</span>
              {!p.activo && <span className="ml-2 text-xs text-slate-500">(inactivo)</span>}
            </span>
            <span className="shrink-0 text-right text-xs text-slate-600 tabular-nums">
              {p.enAlerta ? <Chip tono="ambar">En alerta · {p.stock}</Chip> : `Stock ${formatoNumero(p.stock)} ${p.unidad}`}
            </span>
          </li>
        ))}
      </ul>

      {abierto && (
        <p aria-live="polite" className="mt-1.5 text-sm text-slate-600">
          {consulta.error ? (
            <span className="text-coral-700">No se pudo buscar. Intente de nuevo.</span>
          ) : esperando && lista.length === 0 ? (
            "Buscando…"
          ) : lista.length === 0 ? (
            `Ningún producto coincide con «${texto.trim()}».`
          ) : consulta.data && consulta.data.total > lista.length ? (
            `Se muestran ${lista.length} de ${consulta.data.total}: siga escribiendo para afinar.`
          ) : null}
        </p>
      )}
    </div>
  );
}
