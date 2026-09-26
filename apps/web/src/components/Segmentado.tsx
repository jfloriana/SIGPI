import { useId } from "react";

/**
 * Opciones de un control segmentado (radios nativos con aspecto de interruptor de dos o más posiciones).
 * Va dentro del `<fieldset>` de quien lo usa, que pone su propia `<legend>` (visible o `sr-only`).
 * Cada segmento mide 44 px de alto (objetivo táctil) y usa la esquina de control; el elegido se
 * levanta con la sombra `segmento` y texto marino.
 */
export function OpcionesSegmentadas<T extends string>({
  opciones,
  valor,
  alCambiar,
  nombre,
}: {
  opciones: readonly { valor: T; texto: string }[];
  valor: T;
  alCambiar: (valor: T) => void;
  /** Nombre del grupo de radios; por defecto uno único. */
  nombre?: string;
}) {
  const idGrupo = useId();
  const grupo = nombre ?? idGrupo;
  return (
    <div
      className="grid gap-1 rounded-[calc(var(--radius-control)+4px)] bg-slate-100 p-1"
      style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}
    >
      {opciones.map((o) => (
        <label key={o.valor} className="relative">
          <input
            type="radio"
            name={grupo}
            value={o.valor}
            checked={valor === o.valor}
            onChange={() => alCambiar(o.valor)}
            className="peer sr-only"
          />
          <span className="flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--radius-control)] px-2 text-center text-sm font-semibold text-slate-600 transition-[color,background-color,box-shadow] duration-150 ease-[var(--ease-salida)] peer-checked:bg-white peer-checked:text-marino peer-checked:shadow-segmento peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-marino-500 hover:text-slate-900">
            {o.texto}
          </span>
        </label>
      ))}
    </div>
  );
}
