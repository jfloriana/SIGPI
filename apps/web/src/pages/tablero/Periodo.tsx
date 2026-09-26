import { useId, useRef } from "react";
import { useFiltrosUrl } from "../../hooks/useFiltrosUrl";
import { fechaISO, formatoFecha, haceDias } from "../../utils/formato";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ATAJOS = [
  { valor: "7", texto: "7 días" },
  { valor: "30", texto: "30 días" },
  { valor: "90", texto: "90 días" },
] as const;
const MAX_DIAS = 366;

export interface Periodo {
  desde: string;
  hasta: string;
}

/** Días entre dos fechas `AAAA-MM-DD`, ambas inclusive. */
export function diasEntre(desde: string, hasta: string) {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1;
}

/**
 * Período del tablero guardado en la URL: `?rango=7|30|90` o `?rango=personalizado&desde=…&hasta=…`.
 * Sin parámetros: los últimos 30 días (el mismo valor por defecto que la API).
 * Si el rango personalizado es inválido, se sigue consultando el último período válido y se explica el error.
 */
export function usePeriodo() {
  const { filtros, setFiltros } = useFiltrosUrl(["rango", "desde", "hasta"] as const);
  const hoy = fechaISO();
  const personalizado = filtros.rango === "personalizado";
  const atajo = ATAJOS.some((a) => a.valor === filtros.rango) ? filtros.rango : "30";

  let solicitado: Periodo = { desde: haceDias(Number(atajo) - 1), hasta: hoy };
  let error = "";
  if (personalizado) {
    const desde = FECHA.test(filtros.desde) ? filtros.desde : "";
    const hasta = FECHA.test(filtros.hasta) ? filtros.hasta : "";
    if (!desde || !hasta) error = "Elija las dos fechas del rango.";
    else if (hasta < desde) error = "La fecha «Hasta» no puede ser anterior a «Desde».";
    else if (hasta > hoy) error = "La fecha «Hasta» no puede ser posterior a hoy.";
    else if (diasEntre(desde, hasta) > MAX_DIAS) error = `El rango no puede superar ${MAX_DIAS} días.`;
    solicitado = { desde, hasta };
  }

  const ultimoValido = useRef<Periodo>(solicitado);
  if (!error) ultimoValido.current = solicitado;

  return {
    periodo: error ? ultimoValido.current : solicitado,
    solicitado,
    personalizado,
    atajo,
    error,
    hoy,
    elegirAtajo: (valor: string) => setFiltros({ rango: valor === "30" ? "" : valor, desde: "", hasta: "" }),
    elegirPersonalizado: () =>
      setFiltros({ rango: "personalizado", desde: ultimoValido.current.desde, hasta: ultimoValido.current.hasta }),
    cambiarFechas: (cambios: Partial<Periodo>) => setFiltros({ rango: "personalizado", ...cambios }),
  };
}

/** Fila de filtros del tablero: atajos de período y rango personalizado. Filtra todo lo que está debajo. */
export function FiltroPeriodo({ estado }: { estado: ReturnType<typeof usePeriodo> }) {
  const { periodo, solicitado, personalizado, atajo, error, hoy, elegirAtajo, elegirPersonalizado, cambiarFechas } = estado;
  const idDesde = useId();
  const idHasta = useId();
  const idError = useId();
  const idGrupo = useId();

  return (
    <div className="mb-6 flex flex-wrap items-end gap-x-4 gap-y-3">
      <div className="min-w-0">
        <p id={idGrupo} className="campo-etiqueta">
          Período
        </p>
        <div role="group" aria-labelledby={idGrupo} className="flex flex-wrap gap-1.5">
          {ATAJOS.map((a) => (
            <button
              key={a.valor}
              type="button"
              aria-pressed={!personalizado && atajo === a.valor}
              onClick={() => elegirAtajo(a.valor)}
              className="pastilla-filtro"
            >
              {a.texto}
            </button>
          ))}
          <button type="button" aria-pressed={personalizado} onClick={elegirPersonalizado} className="pastilla-filtro">
            Personalizado
          </button>
        </div>
      </div>

      {personalizado && (
        <div className="flex min-w-0 basis-full gap-3 sm:basis-auto">
          <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
            <label htmlFor={idDesde} className="campo-etiqueta">
              Desde
            </label>
            <input
              id={idDesde}
              type="date"
              value={solicitado.desde}
              max={solicitado.hasta || hoy}
              onChange={(e) => cambiarFechas({ desde: e.target.value })}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? idError : undefined}
              className="campo-control"
            />
          </div>
          <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
            <label htmlFor={idHasta} className="campo-etiqueta">
              Hasta
            </label>
            <input
              id={idHasta}
              type="date"
              value={solicitado.hasta}
              min={solicitado.desde || undefined}
              max={hoy}
              onChange={(e) => cambiarFechas({ hasta: e.target.value })}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? idError : undefined}
              className="campo-control"
            />
          </div>
        </div>
      )}

      <p className="basis-full text-sm text-slate-600 sm:basis-auto sm:pb-3" aria-live="polite">
        Del <span className="font-medium text-slate-900 tabular-nums">{formatoFecha(`${periodo.desde}T12:00:00`)}</span> al{" "}
        <span className="font-medium text-slate-900 tabular-nums">{formatoFecha(`${periodo.hasta}T12:00:00`)}</span>
        {" · "}
        {diasEntre(periodo.desde, periodo.hasta)} días
      </p>

      {error && (
        <p id={idError} role="alert" className="campo-error mt-0 basis-full">
          {error} Se muestran los datos del último período válido.
        </p>
      )}
    </div>
  );
}
