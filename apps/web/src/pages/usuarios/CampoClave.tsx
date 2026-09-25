import { Check, Circle, Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

/** Reglas de la contraseña (las mismas que valida la API). */
export const REQUISITOS_CLAVE = [
  { texto: "Mínimo 8 caracteres", cumple: (c: string) => c.length >= 8 },
  { texto: "Al menos una letra", cumple: (c: string) => /\p{L}/u.test(c) },
  { texto: "Al menos un número", cumple: (c: string) => /\d/.test(c) },
];

/** Mismos mensajes que devuelve la API (API.md, regla «clave»). */
export function validarClave(clave: string): string | undefined {
  if (!clave) return "Ingrese la contraseña";
  if (clave.length < 8) return "La contraseña debe tener al menos 8 caracteres";
  if (clave.length > 72) return "La contraseña debe tener como máximo 72 caracteres";
  if (!/\p{L}/u.test(clave) || !/\d/.test(clave)) return "La contraseña debe incluir al menos una letra y un número";
  return undefined;
}

/** Campo de contraseña con botón mostrar/ocultar y requisitos visibles que se marcan al cumplirse. */
export function CampoClave({
  etiqueta,
  valor,
  alCambiar,
  error,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  error?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const idReq = `${id}-requisitos`;
  const idError = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="campo-etiqueta">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          autoComplete="new-password"
          maxLength={72}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error && idError, idReq].filter(Boolean).join(" ")}
          className="campo-control pr-12"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-[var(--radius-control)] text-slate-500 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-marino-500"
        >
          {visible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
        </button>
      </div>
      {error && (
        <p id={idError} className="campo-error">
          {error}
        </p>
      )}
      <ul id={idReq} className="mt-2 grid gap-1 text-sm sm:grid-cols-3">
        {REQUISITOS_CLAVE.map((r) => {
          const ok = r.cumple(valor);
          return (
            <li key={r.texto} className={`flex items-center gap-1.5 ${ok ? "text-teal-800" : "text-slate-600"}`}>
              {ok ? <Check aria-hidden className="size-4 shrink-0" /> : <Circle aria-hidden className="size-3.5 shrink-0" />}
              {r.texto}
              <span className="sr-only">{ok ? "(cumple)" : "(pendiente)"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
