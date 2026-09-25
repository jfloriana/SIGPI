import { CircleAlert, Inbox, LoaderCircle, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { ApiError } from "../api/cliente";

/** Indicador de carga en línea. */
export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600">
      <LoaderCircle aria-hidden className="size-5 animate-spin text-marino-500" />
      {texto}
    </div>
  );
}

/** Estado vacío: título, explicación y una acción opcional. */
export function EstadoVacio({ titulo, descripcion, accion }: { titulo: string; descripcion?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-slate-100 text-slate-500">
        <Inbox aria-hidden className="size-5" />
      </span>
      <p className="mt-3 font-medium text-slate-900">{titulo}</p>
      {descripcion && <p className="mt-1 max-w-sm text-sm text-slate-600">{descripcion}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

/** Estado de error con el mensaje de la API y botón para reintentar. */
export function EstadoError({ error, reintentar }: { error: unknown; reintentar?: () => void }) {
  const mensaje = error instanceof ApiError ? error.message : "No se pudo cargar la información.";
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-coral-50 text-coral-700">
        <CircleAlert aria-hidden className="size-5" />
      </span>
      <p className="mt-3 font-medium text-slate-900">Algo salió mal</p>
      <p className="mt-1 max-w-sm text-sm text-slate-600">{mensaje}</p>
      {reintentar && (
        <button type="button" onClick={reintentar} className="btn-secundario mt-4">
          <RotateCw aria-hidden className="size-4" />
          Reintentar
        </button>
      )}
    </div>
  );
}

/** Aviso destacado (información, éxito, alerta o error) dentro de una página. */
export function Aviso({
  tono = "info",
  titulo,
  children,
}: {
  tono?: "info" | "exito" | "alerta" | "error";
  titulo?: string;
  children: ReactNode;
}) {
  const estilos = {
    info: "border-marino-100 bg-marino-50 text-marino-800",
    exito: "border-teal-100 bg-teal-50 text-teal-800",
    alerta: "border-ambar-100 bg-ambar-50 text-ambar-800",
    error: "border-coral-100 bg-coral-50 text-coral-800",
  }[tono];
  return (
    <div role={tono === "error" ? "alert" : "status"} className={`rounded-lg border p-3 text-sm ${estilos}`}>
      {titulo && <p className="font-semibold">{titulo}</p>}
      <div className={titulo ? "mt-0.5" : ""}>{children}</div>
    </div>
  );
}
