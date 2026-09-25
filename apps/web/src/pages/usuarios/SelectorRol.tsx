import { useId, type ReactNode } from "react";
import { NOMBRE_ROL, type Rol } from "../../auth/roles";

export const ROLES: Rol[] = ["ADMIN", "GERENTE", "VENDEDOR", "ALMACENERO"];

/** Qué puede hacer cada rol (resumen de la matriz ROLES Y PERMISOS de la especificación). */
export const DESCRIPCION_ROL: Record<Rol, string> = {
  ADMIN: "Gestiona usuarios, clientes, productos e inventario; consulta pedidos y bitácora. No aprueba operaciones.",
  GERENTE: "Aprueba y anula pedidos, crea y aprueba órdenes de compra; ve tablero, reportes y bitácora.",
  VENDEDOR: "Registra clientes y pedidos; ve solo sus pedidos y sus ventas.",
  ALMACENERO: "Despacha y entrega pedidos, recepciona compras y registra entradas y ajustes de inventario.",
};

/** Grupo de opciones de rol, cada una con su descripción. */
export function SelectorRol({
  valor,
  alCambiar,
  error,
  deshabilitado,
  ayuda,
}: {
  valor: Rol | "";
  alCambiar: (rol: Rol) => void;
  error?: string;
  deshabilitado?: boolean;
  ayuda?: ReactNode;
}) {
  const id = useId();
  const idError = `${id}-error`;
  const idAyuda = `${id}-ayuda`;
  return (
    <fieldset
      aria-invalid={error ? true : undefined}
      aria-describedby={[error && idError, ayuda && idAyuda].filter(Boolean).join(" ") || undefined}
      disabled={deshabilitado}
    >
      <legend className="campo-etiqueta">Rol</legend>
      <div
        className={`divide-y divide-slate-200 rounded-[var(--radius-control)] border ${error ? "border-coral-700" : "border-slate-300"}`}
      >
        {ROLES.map((r) => (
          <label
            key={r}
            className={`flex min-h-11 items-start gap-3 px-3 py-2.5 transition-colors duration-150 first:rounded-t-[var(--radius-control)] last:rounded-b-[var(--radius-control)] ${
              deshabilitado ? "cursor-not-allowed bg-slate-50" : "cursor-pointer hover:bg-slate-50"
            } ${valor === r ? "bg-marino-50/70" : ""} has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-marino-500`}
          >
            <input
              type="radio"
              name={id}
              value={r}
              checked={valor === r}
              onChange={() => alCambiar(r)}
              className="mt-0.5 size-4 shrink-0 focus:outline-none"
            />
            <span className="min-w-0">
              <span className={`block text-sm font-medium ${deshabilitado ? "text-slate-600" : "text-slate-900"}`}>{NOMBRE_ROL[r]}</span>
              <span className="block text-sm text-slate-600">{DESCRIPCION_ROL[r]}</span>
            </span>
          </label>
        ))}
      </div>
      {ayuda && !error && (
        <p id={idAyuda} className="mt-1.5 text-sm text-slate-600">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} className="campo-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}
