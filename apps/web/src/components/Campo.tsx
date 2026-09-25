import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

interface PropsCampo {
  etiqueta: string;
  /** Mensaje de error (del servidor o local); se muestra junto al campo. */
  error?: string;
  /** Texto de ayuda bajo el campo. */
  ayuda?: ReactNode;
  opcional?: boolean;
  className?: string;
  /** Un único control (`input`, `select`, `textarea`). Recibe id, aria-invalid y aria-describedby. */
  children: ReactElement<Record<string, unknown>>;
}

/**
 * Envoltorio accesible de un control: etiqueta visible, error junto al campo y ayuda.
 * Ejemplo: <Campo etiqueta="RUC" error={errores.numDoc}><input className="campo-control" … /></Campo>
 */
export function Campo({ etiqueta, error, ayuda, opcional, className = "", children }: PropsCampo) {
  const id = useId();
  const idError = `${id}-error`;
  const idAyuda = `${id}-ayuda`;
  const describedBy = [error && idError, ayuda && idAyuda].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: (children.props.id as string | undefined) ?? id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })
    : children;

  return (
    <div className={className}>
      <label htmlFor={(isValidElement(children) && (children.props.id as string | undefined)) || id} className="campo-etiqueta">
        {etiqueta}
        {opcional && <span className="ml-1 font-normal text-slate-500">(opcional)</span>}
      </label>
      {control}
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
    </div>
  );
}
