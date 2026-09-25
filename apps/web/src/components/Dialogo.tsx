import { LoaderCircle, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";

interface PropsDialogo {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  descripcion?: ReactNode;
  children?: ReactNode;
  /** Pie con acciones. */
  pie?: ReactNode;
  ancho?: "sm" | "md" | "lg";
  /** "panel": se desliza desde la derecha a toda la altura (formularios de alta y edición). */
  variante?: "centro" | "panel";
}

/** Diálogo modal nativo (<dialog>): foco atrapado, Escape y clic fuera cierran. */
export function Dialogo({ abierto, alCerrar, titulo, descripcion, children, pie, ancho = "md", variante = "centro" }: PropsDialogo) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const idDesc = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  const maxW = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" }[ancho];
  const forma =
    variante === "panel"
      ? `my-0 mr-0 ml-auto h-dvh max-h-dvh w-full ${maxW} flex-col rounded-none open:animate-[deslizar_220ms_var(--ease-salida)]`
      : `m-auto w-[calc(100%-2rem)] ${maxW} rounded-xl open:animate-[aparecer_200ms_var(--ease-salida)]`;

  return (
    <dialog
      ref={ref}
      // React propaga «close» por el árbol de componentes: solo reacciona al cierre de ESTE diálogo.
      onClose={(e) => e.target === e.currentTarget && alCerrar()}
      onClick={(e) => e.target === e.currentTarget && alCerrar()}
      aria-labelledby={idTitulo}
      aria-describedby={descripcion ? idDesc : undefined}
      className={`${forma} bg-white p-0 text-slate-900 shadow-[0_12px_40px_-8px_rgb(15_30_51/0.35)] backdrop:bg-marino-900/40 open:flex open:flex-col`}
    >
      <div className="flex items-start gap-4 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 id={idTitulo} className="text-lg font-semibold">
            {titulo}
          </h2>
          {descripcion && (
            <div id={idDesc} className="mt-1 text-sm text-slate-600">
              {descripcion}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={alCerrar}
          className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Cerrar"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
      {children && (
        <div className={`overflow-y-auto px-5 py-4 ${variante === "panel" ? "flex-1" : "max-h-[70dvh]"}`}>{children}</div>
      )}
      {pie && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">{pie}</div>}
    </dialog>
  );
}

interface PropsConfirmacion {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  descripcion?: ReactNode;
  textoConfirmar: string;
  /** "peligro" para anular o desactivar. */
  tono?: "primario" | "peligro";
  /** Si se indica, pide un motivo obligatorio con esa longitud mínima. */
  motivoMinimo?: number;
  etiquetaMotivo?: string;
  /** Error devuelto por la API al confirmar. */
  error?: string | null;
  procesando?: boolean;
  alConfirmar: (motivo: string) => void;
  /** "md" cuando el contenido incluye una lista (p. ej., productos a despachar). */
  ancho?: "sm" | "md";
  /** Contenido adicional sobre el motivo (resumen de lo que se va a hacer). */
  children?: ReactNode;
}

/** Confirmación antes de acciones sensibles (despachar, anular, desactivar). */
export function DialogoConfirmacion({
  abierto,
  alCerrar,
  titulo,
  descripcion,
  textoConfirmar,
  tono = "primario",
  motivoMinimo,
  etiquetaMotivo = "Motivo",
  error,
  procesando,
  alConfirmar,
  ancho = "sm",
  children,
}: PropsConfirmacion) {
  const [motivo, setMotivo] = useState("");
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const idMotivo = useId();

  useEffect(() => {
    if (abierto) {
      setMotivo("");
      setErrorLocal(null);
    }
  }, [abierto]);

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (motivoMinimo && motivo.trim().length < motivoMinimo) {
      setErrorLocal(`El motivo debe tener al menos ${motivoMinimo} caracteres`);
      return;
    }
    alConfirmar(motivo.trim());
  }

  const idForm = `${idMotivo}-form`;
  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={titulo}
      descripcion={descripcion}
      ancho={ancho}
      pie={
        <>
          <button type="button" onClick={alCerrar} className="btn-secundario">
            Cancelar
          </button>
          <button type="submit" form={idForm} disabled={procesando} className={tono === "peligro" ? "btn-peligro" : "btn-primario"}>
            {procesando && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {textoConfirmar}
          </button>
        </>
      }
    >
      <form id={idForm} onSubmit={enviar} noValidate className="space-y-3">
        {children}
        {motivoMinimo !== undefined && (
          <div>
            <label htmlFor={idMotivo} className="campo-etiqueta">
              {etiquetaMotivo}
            </label>
            <textarea
              id={idMotivo}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              aria-invalid={!!errorLocal}
              aria-describedby={errorLocal ? `${idMotivo}-error` : `${idMotivo}-ayuda`}
              className="campo-control py-2"
            />
            {errorLocal ? (
              <p id={`${idMotivo}-error`} className="campo-error">
                {errorLocal}
              </p>
            ) : (
              <p id={`${idMotivo}-ayuda`} className="mt-1.5 text-sm text-slate-600">
                Mínimo {motivoMinimo} caracteres · {motivo.trim().length} escritos
              </p>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-lg border border-coral-100 bg-coral-50 p-3 text-sm text-coral-800">
            {error}
          </p>
        )}
        {motivoMinimo === undefined && !error && <p className="text-sm text-slate-600">Esta acción quedará registrada en la bitácora.</p>}
      </form>
    </Dialogo>
  );
}
