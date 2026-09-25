import type { ReactNode } from "react";

/** Título de página con descripción opcional y acciones a la derecha. */
export function Encabezado({ titulo, descripcion, acciones }: { titulo: string; descripcion?: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-prose text-sm text-slate-600">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}
