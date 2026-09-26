import { Search, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

/** Campo de búsqueda con espera de 300 ms antes de avisar el cambio. */
export function Buscador({
  valor,
  alCambiar,
  etiqueta = "Buscar",
  placeholder,
  className = "",
}: {
  valor: string;
  alCambiar: (valor: string) => void;
  etiqueta?: string;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  const [texto, setTexto] = useState(valor);

  useEffect(() => setTexto(valor), [valor]);

  useEffect(() => {
    if (texto === valor) return;
    const t = setTimeout(() => alCambiar(texto), 300);
    return () => clearTimeout(t);
  }, [texto, valor, alCambiar]);

  return (
    <div className={`min-w-0 flex-1 sm:max-w-xs ${className}`}>
      <label htmlFor={id} className="campo-etiqueta">
        {etiqueta}
      </label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
        <input
          id={id}
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={placeholder}
          className="campo-control pr-11 pl-9"
          autoComplete="off"
        />
        {texto && (
          <button
            type="button"
            onClick={() => {
              setTexto("");
              alCambiar("");
            }}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-[var(--radius-control)] text-slate-500 transition-colors duration-150 hover:text-slate-900"
            aria-label="Limpiar búsqueda"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
