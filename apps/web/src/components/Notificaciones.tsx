import { CircleAlert, CircleCheck, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type Tono = "exito" | "error";
interface Notificacion {
  id: number;
  tono: Tono;
  mensaje: string;
}

const Contexto = createContext<{ notificar: (mensaje: string, tono?: Tono) => void } | null>(null);

/** Avisos breves (4 s) en la esquina inferior: «Cliente creado», «Pedido despachado»… */
export function NotificacionesProvider({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Notificacion[]>([]);
  const siguiente = useRef(1);

  const quitar = useCallback((id: number) => setLista((l) => l.filter((n) => n.id !== id)), []);

  const notificar = useCallback(
    (mensaje: string, tono: Tono = "exito") => {
      const id = siguiente.current++;
      setLista((l) => [...l.slice(-2), { id, tono, mensaje }]);
      setTimeout(() => quitar(id), 4000);
    },
    [quitar],
  );

  const valor = useMemo(() => ({ notificar }), [notificar]);

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6">
        {lista.map((n) => (
          <div
            key={n.id}
            role={n.tono === "error" ? "alert" : "status"}
            className="pointer-events-auto flex w-full max-w-sm animate-[aparecer_200ms_var(--ease-salida)] items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg"
          >
            {n.tono === "exito" ? (
              <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-teal-700" />
            ) : (
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-coral-700" />
            )}
            <p className="flex-1 text-slate-900">{n.mensaje}</p>
            <button
              type="button"
              onClick={() => quitar(n.id)}
              className="-m-1 grid size-7 place-items-center rounded text-slate-500 hover:text-slate-900"
              aria-label="Cerrar aviso"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}

export function useNotificar() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useNotificar debe usarse dentro de <NotificacionesProvider>");
  return ctx.notificar;
}
