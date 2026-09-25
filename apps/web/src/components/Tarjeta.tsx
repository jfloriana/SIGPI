import type { ReactNode } from "react";

/** Superficie blanca con borde para agrupar contenido (tablas, formularios, gráficos). */
export function Tarjeta({
  titulo,
  descripcion,
  acciones,
  children,
  className = "",
  sinRelleno,
}: {
  titulo?: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Para tablas: el contenido llega hasta el borde. */
  sinRelleno?: boolean;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white ${className}`}>
      {(titulo || acciones) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {titulo && <h2 className="font-semibold text-slate-900">{titulo}</h2>}
            {descripcion && <p className="mt-0.5 text-sm text-slate-600">{descripcion}</p>}
          </div>
          {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
        </header>
      )}
      <div className={sinRelleno ? "" : "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}

/** Barra de filtros sobre una tabla. */
export function BarraFiltros({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">{children}</div>;
}
