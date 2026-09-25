import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "../../api/cliente";
import { Campo } from "../../components/Campo";
import { ChipActivo } from "../../components/Chip";
import { Dialogo, DialogoConfirmacion } from "../../components/Dialogo";
import { Aviso } from "../../components/Estados";
import { useNotificar } from "../../components/Notificaciones";
import { errorDocumento, LONGITUD_DOC, ZONAS, type Cliente, type TipoDoc } from "./tipos";

export type ModoPanel = { modo: "crear" } | { modo: "editar"; cliente: Cliente } | { modo: "ver"; cliente: Cliente };

interface Formulario {
  tipoDoc: TipoDoc;
  numDoc: string;
  razonSocial: string;
  direccion: string;
  telefono: string;
  zona: string;
}

type Errores = Partial<Record<keyof Formulario | "_", string>>;

const VACIO: Formulario = { tipoDoc: "RUC", numDoc: "", razonSocial: "", direccion: "", telefono: "", zona: "" };

function desdeCliente(c: Cliente): Formulario {
  return {
    tipoDoc: c.tipoDoc,
    numDoc: c.numDoc,
    razonSocial: c.razonSocial,
    direccion: c.direccion,
    telefono: c.telefono ?? "",
    zona: c.zona,
  };
}

/** Validación local mínima: mismas reglas y mensajes que la API (el servidor igual valida). */
function validar(f: Formulario): Errores {
  const e: Errores = {};
  const nombre = f.tipoDoc === "DNI" ? "el nombre" : "la razón social";
  if (!f.numDoc.trim()) e.numDoc = "Ingrese el número de documento";
  else {
    const m = errorDocumento(f.tipoDoc, f.numDoc.trim());
    if (m) e.numDoc = m;
  }
  if (f.razonSocial.trim().length < 3) e.razonSocial = `Ingrese ${nombre} (mínimo 3 caracteres)`;
  if (f.direccion.trim().length < 5) e.direccion = "Ingrese la dirección (mínimo 5 caracteres)";
  if (f.telefono.trim() && !/^[0-9 +()-]{6,20}$/.test(f.telefono.trim())) e.telefono = "Teléfono no válido";
  if (!f.zona) e.zona = "Seleccione la zona";
  return e;
}

/** Solo los campos que cambian (PATCH parcial); tipoDoc y numDoc viajan juntos. */
function cambios(original: Cliente, f: Formulario): Record<string, string> {
  const c: Record<string, string> = {};
  const numDoc = f.numDoc.trim();
  if (f.tipoDoc !== original.tipoDoc || numDoc !== original.numDoc) {
    c.tipoDoc = f.tipoDoc;
    c.numDoc = numDoc;
  }
  if (f.razonSocial.trim() !== original.razonSocial) c.razonSocial = f.razonSocial.trim();
  if (f.direccion.trim() !== original.direccion) c.direccion = f.direccion.trim();
  if (f.telefono.trim() !== (original.telefono ?? "")) c.telefono = f.telefono.trim();
  if (f.zona !== original.zona) c.zona = f.zona;
  return c;
}

function erroresDeApi(err: unknown): Errores {
  if (err instanceof ApiError) {
    const campos = err.campos ?? {};
    const conocidos: Errores = {};
    let general: string | undefined = campos._;
    for (const [k, v] of Object.entries(campos)) {
      if (k in VACIO) conocidos[k as keyof Formulario] = v;
      else if (k !== "_") general ??= v;
    }
    if (Object.keys(conocidos).length === 0 && !general) general = err.message;
    return { ...conocidos, ...(general && { _: general }) };
  }
  return { _: "No se pudo guardar. Intente de nuevo." };
}

export function PanelCliente({
  panel,
  alCerrar,
  puedeCambiarEstado,
}: {
  panel: ModoPanel | null;
  alCerrar: () => void;
  /** Solo ADMIN desactiva y reactiva. */
  puedeCambiarEstado: boolean;
}) {
  const titulo = !panel ? "" : panel.modo === "crear" ? "Nuevo cliente" : panel.modo === "editar" ? "Editar cliente" : "Detalle del cliente";
  const idForm = useId();
  const [guardando, setGuardando] = useState(false);

  const descripcion =
    panel?.modo === "crear"
      ? "Los campos marcados como opcionales pueden quedar en blanco."
      : panel?.modo === "ver"
        ? "Su rol puede consultar clientes, pero no modificarlos."
        : undefined;

  return (
    <Dialogo
      abierto={!!panel}
      alCerrar={alCerrar}
      titulo={titulo}
      descripcion={descripcion}
      variante="panel"
      pie={
        panel?.modo === "ver" ? (
          <button type="button" onClick={alCerrar} className="btn-secundario">
            Cerrar
          </button>
        ) : (
          <>
            <button type="button" onClick={alCerrar} className="btn-secundario">
              Cancelar
            </button>
            <button type="submit" form={idForm} disabled={guardando} className="btn-primario">
              {guardando && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
              {guardando ? "Guardando…" : panel?.modo === "crear" ? "Guardar cliente" : "Guardar cambios"}
            </button>
          </>
        )
      }
    >
      {panel?.modo === "ver" && <DetalleCliente cliente={panel.cliente} />}
      {panel && panel.modo !== "ver" && (
        <FormularioCliente
          key={panel.modo === "editar" ? panel.cliente.id : "nuevo"}
          idForm={idForm}
          cliente={panel.modo === "editar" ? panel.cliente : null}
          puedeCambiarEstado={puedeCambiarEstado}
          alGuardando={setGuardando}
          alTerminar={alCerrar}
        />
      )}
    </Dialogo>
  );
}

function FormularioCliente({
  idForm,
  cliente,
  puedeCambiarEstado,
  alGuardando,
  alTerminar,
}: {
  idForm: string;
  cliente: Cliente | null;
  puedeCambiarEstado: boolean;
  alGuardando: (v: boolean) => void;
  alTerminar: () => void;
}) {
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const [f, setF] = useState<Formulario>(() => (cliente ? desdeCliente(cliente) : VACIO));
  const [errores, setErrores] = useState<Errores>({});
  const [confirmar, setConfirmar] = useState(false);
  const idTipo = useId();
  const refForm = useRef<HTMLFormElement>(null);

  const guardar = useMutation({
    mutationFn: (cuerpo: Record<string, string>) =>
      cliente ? api.patch<Cliente>(`/clientes/${cliente.id}`, cuerpo) : api.post<Cliente>("/clientes", cuerpo),
    onMutate: () => alGuardando(true),
    onSettled: () => alGuardando(false),
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      notificar(cliente ? `Cliente «${c.razonSocial}» actualizado` : `Cliente «${c.razonSocial}» creado`);
      alTerminar();
    },
    onError: (err) => setErrores(erroresDeApi(err)),
  });

  const estado = useMutation({
    mutationFn: (activo: boolean) => api.patch<Cliente>(`/clientes/${cliente!.id}`, { activo }),
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      notificar(c.activo ? `Cliente «${c.razonSocial}» reactivado` : `Cliente «${c.razonSocial}» desactivado`);
      setConfirmar(false);
      alTerminar();
    },
  });

  function cambiar<K extends keyof Formulario>(campo: K, valor: Formulario[K]) {
    setF((prev) => ({ ...prev, [campo]: valor }));
    if (errores[campo] || errores._) setErrores((e) => ({ ...e, [campo]: undefined, _: undefined }));
  }

  function cambiarTipo(tipo: TipoDoc) {
    setF((prev) => ({ ...prev, tipoDoc: tipo, numDoc: prev.numDoc.slice(0, LONGITUD_DOC[tipo]) }));
    setErrores((e) => ({ ...e, numDoc: undefined, _: undefined }));
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    const locales = validar(f);
    setErrores(locales);
    if (Object.keys(locales).length > 0) {
      // Lleva el foco al primer campo con error (tras pintar los mensajes).
      requestAnimationFrame(() => refForm.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    if (cliente) {
      const cuerpo = cambios(cliente, f);
      if (Object.keys(cuerpo).length === 0) {
        notificar("No se realizaron cambios");
        alTerminar();
        return;
      }
      guardar.mutate(cuerpo);
    } else {
      const cuerpo: Record<string, string> = {
        tipoDoc: f.tipoDoc,
        numDoc: f.numDoc.trim(),
        razonSocial: f.razonSocial.trim(),
        direccion: f.direccion.trim(),
        zona: f.zona,
      };
      if (f.telefono.trim()) cuerpo.telefono = f.telefono.trim();
      guardar.mutate(cuerpo);
    }
  }

  const esDni = f.tipoDoc === "DNI";
  const errorEstado = estado.error instanceof ApiError ? estado.error.message : estado.error ? "No se pudo cambiar el estado." : null;

  return (
    <>
      <form ref={refForm} id={idForm} onSubmit={enviar} noValidate className="space-y-5">
        {errores._ && <Aviso tono="error">{errores._}</Aviso>}

        <fieldset>
          <legend id={idTipo} className="campo-etiqueta">
            Tipo de documento
          </legend>
          <div className="grid grid-cols-2 gap-1 rounded-[var(--radius-control)] bg-slate-100 p-1">
            {(["RUC", "DNI"] as const).map((tipo) => (
              <label
                key={tipo}
                className="relative flex min-h-10 cursor-pointer items-center justify-center rounded-md text-sm font-semibold text-slate-600 transition-colors duration-150 hover:text-slate-900 has-checked:bg-white has-checked:text-marino has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-marino-500"
              >
                <input
                  type="radio"
                  name="tipoDoc"
                  value={tipo}
                  checked={f.tipoDoc === tipo}
                  onChange={() => cambiarTipo(tipo)}
                  className="sr-only"
                />
                {tipo === "RUC" ? "RUC (empresa)" : "DNI (persona)"}
              </label>
            ))}
          </div>
        </fieldset>

        <Campo
          etiqueta={`Número de ${f.tipoDoc}`}
          error={errores.numDoc}
          ayuda={esDni ? "8 dígitos." : "11 dígitos; empieza con 10 o 20."}
        >
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={LONGITUD_DOC[f.tipoDoc]}
            value={f.numDoc}
            onChange={(e) => cambiar("numDoc", e.target.value.replace(/\D/g, ""))}
            className="campo-control tabular-nums"
          />
        </Campo>

        <Campo etiqueta={esDni ? "Nombre" : "Razón social"} error={errores.razonSocial}>
          <input
            type="text"
            autoComplete="off"
            maxLength={150}
            value={f.razonSocial}
            onChange={(e) => cambiar("razonSocial", e.target.value)}
            className="campo-control"
          />
        </Campo>

        <Campo etiqueta="Dirección" error={errores.direccion}>
          <input
            type="text"
            autoComplete="off"
            maxLength={200}
            value={f.direccion}
            onChange={(e) => cambiar("direccion", e.target.value)}
            className="campo-control"
          />
        </Campo>

        <div className="grid gap-5 sm:grid-cols-2">
          <Campo etiqueta="Teléfono" opcional error={errores.telefono}>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="off"
              maxLength={20}
              value={f.telefono}
              onChange={(e) => cambiar("telefono", e.target.value)}
              className="campo-control tabular-nums"
            />
          </Campo>

          <Campo etiqueta="Zona" error={errores.zona}>
            <select value={f.zona} onChange={(e) => cambiar("zona", e.target.value)} className="campo-control">
              <option value="" disabled>
                Seleccione…
              </option>
              {ZONAS.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </form>

      {cliente && puedeCambiarEstado && (
        <div className="mt-8 border-t border-slate-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                Estado <ChipActivo activo={cliente.activo} />
              </p>
              <p className="mt-1 max-w-xs text-sm text-slate-600">
                {cliente.activo
                  ? "Los clientes activos aparecen al registrar pedidos."
                  : "No aparece al registrar pedidos. Sus pedidos anteriores se conservan."}
              </p>
            </div>
            {cliente.activo ? (
              <button type="button" onClick={() => setConfirmar(true)} className="btn-secundario text-coral-700 hover:bg-coral-50">
                Desactivar cliente
              </button>
            ) : (
              <button type="button" onClick={() => estado.mutate(true)} disabled={estado.isPending} className="btn-secundario">
                {estado.isPending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
                {estado.isPending ? "Reactivando…" : "Reactivar cliente"}
              </button>
            )}
          </div>
          {!cliente.activo && errorEstado && (
            <div className="mt-3">
              <Aviso tono="error">{errorEstado}</Aviso>
            </div>
          )}
        </div>
      )}

      {cliente && (
        <DialogoConfirmacion
          abierto={confirmar}
          alCerrar={() => {
            setConfirmar(false);
            estado.reset();
          }}
          titulo="¿Desactivar este cliente?"
          descripcion={
            <>
              <strong className="font-semibold text-slate-900">{cliente.razonSocial}</strong> ya no aparecerá al registrar
              nuevos pedidos. Sus pedidos anteriores se conservan y puede reactivarlo cuando quiera.
            </>
          }
          textoConfirmar={estado.isPending ? "Desactivando…" : "Desactivar"}
          tono="peligro"
          procesando={estado.isPending}
          error={errorEstado}
          alConfirmar={() => estado.mutate(false)}
        />
      )}
    </>
  );
}

function DetalleCliente({ cliente }: { cliente: Cliente }) {
  const filas: [string, ReactNode][] = [
    ["Documento", <span className="tabular-nums">{`${cliente.tipoDoc} ${cliente.numDoc}`}</span>],
    [cliente.tipoDoc === "DNI" ? "Nombre" : "Razón social", cliente.razonSocial],
    ["Dirección", cliente.direccion],
    ["Teléfono", cliente.telefono ? <span className="tabular-nums">{cliente.telefono}</span> : <span className="text-slate-500">Sin teléfono</span>],
    ["Zona", cliente.zona],
    ["Estado", <ChipActivo activo={cliente.activo} />],
  ];
  return (
    <dl className="divide-y divide-slate-100">
      {filas.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[8rem_1fr] gap-3 py-3 text-sm">
          <dt className="text-slate-600">{k}</dt>
          <dd className="font-medium text-slate-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
