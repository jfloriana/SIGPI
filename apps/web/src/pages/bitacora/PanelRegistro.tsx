import { ExternalLink, History } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Chip } from "../../components/Chip";
import { Dialogo } from "../../components/Dialogo";
import { formatoFechaHora } from "../../utils/formato";
import { comparar, esPlano, etiquetaCampo, textoElemento, textoValor, type Cambio, type FilaComparacion } from "./detalle";
import { infoAccion, nombreEntidad, rutaEntidad, type Datos, type RegistroBitacora } from "./tipos";

const MARCA: Record<Cambio, { texto: string; fila: string; etiqueta: string } | null> = {
  cambio: { texto: "Cambió", fila: "bg-teal-50", etiqueta: "text-teal-800" },
  nuevo: { texto: "Dato nuevo", fila: "bg-marino-50", etiqueta: "text-marino" },
  quitado: { texto: "Se quitó", fila: "bg-marino-50", etiqueta: "text-marino" },
  igual: null,
  creado: null,
};

function Valor({ campo, valor }: { campo: string; valor: unknown }) {
  if (valor === undefined || valor === null || valor === "") return <span className="text-slate-400">—</span>;
  if (esPlano(valor)) return <span className="break-words">{textoValor(campo, valor)}</span>;
  if (Array.isArray(valor)) {
    if (valor.length === 0) return <span className="text-slate-500">Ninguno</span>;
    return (
      <ul className="space-y-1">
        {valor.map((el, i) => (
          <li key={i} className="break-words">
            {textoElemento(el)}
          </li>
        ))}
      </ul>
    );
  }
  const o = valor as Datos;
  return (
    <ul className="space-y-0.5">
      {Object.entries(o).map(([k, x]) => (
        <li key={k} className="break-words">
          <span className="text-slate-600">{etiquetaCampo(k)}:</span> {esPlano(x) ? textoValor(k, x) : textoElemento(x)}
        </li>
      ))}
    </ul>
  );
}

function FilaCampo({ fila }: { fila: FilaComparacion }) {
  const marca = MARCA[fila.cambio];
  return (
    <tr className={`border-b border-slate-100 align-top last:border-0 ${marca?.fila ?? ""}`}>
      <th scope="row" className="px-3 py-2.5 text-left font-medium text-slate-900">
        {etiquetaCampo(fila.campo)}
        {marca && <span className={`mt-0.5 block text-xs font-semibold ${marca.etiqueta}`}>{marca.texto}</span>}
      </th>
      <td className="px-3 py-2.5 text-slate-700">
        <Valor campo={fila.campo} valor={fila.antes} />
      </td>
      <td className={`px-3 py-2.5 ${marca ? "font-medium text-slate-900" : "text-slate-700"}`}>
        <Valor campo={fila.campo} valor={fila.despues} />
      </td>
    </tr>
  );
}

function Dato({ termino, children }: { termino: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-600">{termino}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export function PanelRegistro({
  registro,
  alCerrar,
  alVerHistoria,
  enHistoria,
}: {
  registro: RegistroBitacora;
  alCerrar: () => void;
  alVerHistoria: (r: RegistroBitacora) => void;
  /** La tabla ya está filtrada por la historia de este mismo registro. */
  enHistoria: boolean;
}) {
  const accion = infoAccion(registro.accion);
  const antes = registro.detalle?.antes ?? null;
  const despues = registro.detalle?.despues ?? null;
  const filas = comparar(antes, despues);
  const nCambios = filas.filter((f) => f.cambio === "cambio").length;
  const ruta = rutaEntidad(registro.entidad, registro.entidadId);
  const nombre = nombreEntidad(registro.entidad);

  return (
    <Dialogo
      abierto
      alCerrar={alCerrar}
      variante="panel"
      ancho="lg"
      titulo={`Registro n.º ${registro.id} · ${accion.texto}`}
      descripcion="Solo lectura: los registros de la bitácora no se pueden editar ni borrar."
      pie={
        <>
          <button type="button" onClick={alCerrar} className="btn-secundario">
            Cerrar
          </button>
          {ruta && (
            <Link to={ruta} className="btn-secundario">
              <ExternalLink aria-hidden className="size-4" />
              Abrir el {nombre.toLowerCase()}
            </Link>
          )}
          {registro.entidadId && !enHistoria && (
            <button type="button" onClick={() => alVerHistoria(registro)} className="btn-primario">
              <History aria-hidden className="size-4" />
              Ver toda la historia de este registro
            </button>
          )}
        </>
      }
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Dato termino="Acción">
          <span className="flex flex-wrap items-center gap-2">
            <Chip tono={accion.tono}>{accion.texto}</Chip>
            <code className="text-xs text-slate-600">{registro.accion}</code>
          </span>
        </Dato>
        <Dato termino="Registro afectado">
          {nombre}
          {registro.entidadId && <span className="tabular-nums"> #{registro.entidadId}</span>}
        </Dato>
        <Dato termino="Usuario">
          {registro.usuario ? (
            <>
              {registro.usuario.nombre}
              <span className="block truncate text-xs text-slate-600">{registro.usuario.email}</span>
            </>
          ) : (
            <>
              Sistema
              <span className="block text-xs text-slate-600">Sin usuario (carga inicial o correo no registrado)</span>
            </>
          )}
        </Dato>
        <Dato termino="Fecha y hora">
          <time dateTime={registro.fecha} className="tabular-nums">
            {formatoFechaHora(registro.fecha)}
          </time>
          {registro.ip && <span className="block text-xs text-slate-600">IP {registro.ip}</span>}
        </Dato>
      </dl>

      <h3 className="mt-6 font-semibold text-slate-900">Antes y después</h3>
      <p className="mt-1 text-sm text-slate-600">
        {!antes && despues
          ? "Es un alta: no había datos anteriores. Se muestra lo que quedó registrado."
          : nCambios > 0
            ? `${nCambios} ${nCambios === 1 ? "campo cambió" : "campos cambiaron"}; se marcan con «Cambió». «Dato nuevo» es información que la operación agregó.`
            : "Ningún campo cambió de valor; se muestran los datos que guardó la operación."}
      </p>

      {filas.length === 0 ? (
        <p className="mt-3 rounded-lg border border-slate-200 px-3 py-4 text-sm text-slate-600">Este registro no guarda datos de antes ni de después.</p>
      ) : (
        <div className="relative mt-3 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full table-fixed border-collapse text-sm">
            <caption className="sr-only">Comparación campo por campo del registro {registro.id}</caption>
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[35%]" />
              <col className="w-[35%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                <th scope="col" className="px-3 py-2">
                  Campo
                </th>
                <th scope="col" className="px-3 py-2">
                  Antes
                </th>
                <th scope="col" className="px-3 py-2">
                  Después
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <FilaCampo key={f.campo} fila={f} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="mt-5 rounded-lg border border-slate-200">
        <summary className="flex min-h-11 items-center px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
          Ver JSON completo (antes / después)
        </summary>
        <pre className="max-h-96 overflow-auto border-t border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800">
          {JSON.stringify(registro.detalle, null, 2)}
        </pre>
      </details>
    </Dialogo>
  );
}
