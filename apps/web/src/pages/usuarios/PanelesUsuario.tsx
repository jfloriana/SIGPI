import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, LoaderCircle, LockOpen } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { ApiError, api } from "../../api/cliente";
import type { Rol } from "../../auth/roles";
import { Campo } from "../../components/Campo";
import { Chip } from "../../components/Chip";
import { Dialogo, DialogoConfirmacion } from "../../components/Dialogo";
import { Aviso } from "../../components/Estados";
import { useNotificar } from "../../components/Notificaciones";
import { formatoFechaHora } from "../../utils/formato";
import { CampoClave, validarClave } from "./CampoClave";
import { SelectorRol } from "./SelectorRol";
import { horaLima, type UsuarioApi } from "./tipos";

type Errores = Record<string, string | undefined>;

/** Separa el error de la API en errores por campo y un mensaje general. */
function erroresDeApi(err: unknown, camposConocidos: string[]): { campos: Errores; general?: string } {
  if (!(err instanceof ApiError)) return { campos: {}, general: "Ocurrió un error inesperado" };
  const campos: Errores = {};
  let general: string | undefined;
  for (const [k, v] of Object.entries(err.campos ?? {})) {
    if (camposConocidos.includes(k)) campos[k] = v;
    else general = v;
  }
  if (Object.keys(campos).length === 0) general = general ?? err.message;
  return { campos, general };
}

function validarNombre(nombre: string): string | undefined {
  const t = nombre.trim();
  if (!t) return "Ingrese el nombre";
  if (t.length < 3) return "Ingrese el nombre (mínimo 3 caracteres)";
  if (t.length > 100) return "Máximo 100 caracteres";
  return undefined;
}

function validarEmail(email: string): string | undefined {
  const t = email.trim();
  if (!t) return "Ingrese el correo";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return "Correo no válido";
  return undefined;
}

// ---------------------------------------------------------------- Alta

export function PanelNuevoUsuario({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  const [guardando, setGuardando] = useState(false);
  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      variante="panel"
      titulo="Nuevo usuario"
      descripcion="La persona ingresará con este correo y la contraseña inicial."
      pie={
        <>
          <button type="button" onClick={alCerrar} className="btn-secundario">
            Cancelar
          </button>
          <button type="submit" form="form-nuevo-usuario" disabled={guardando} className="btn-primario">
            {guardando && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {guardando ? "Creando usuario…" : "Crear usuario"}
          </button>
        </>
      }
    >
      {abierto && <FormularioNuevo alCerrar={alCerrar} alCambiarGuardando={setGuardando} />}
    </Dialogo>
  );
}

function FormularioNuevo({ alCerrar, alCambiarGuardando }: { alCerrar: () => void; alCambiarGuardando: (v: boolean) => void }) {
  const qc = useQueryClient();
  const notificar = useNotificar();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Rol | "">("");
  const [clave, setClave] = useState("");
  const [errores, setErrores] = useState<Errores>({});
  const [general, setGeneral] = useState<string>();

  const crear = useMutation({
    mutationFn: () => api.post<UsuarioApi>("/usuarios", { nombre: nombre.trim(), email: email.trim(), rol, clave }),
    onMutate: () => alCambiarGuardando(true),
    onSettled: () => alCambiarGuardando(false),
    onSuccess: (u) => {
      notificar(`Usuario «${u.nombre}» creado`);
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      alCerrar();
    },
    onError: (err) => {
      const r = erroresDeApi(err, ["nombre", "email", "rol", "clave"]);
      setErrores(r.campos);
      setGeneral(r.general);
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    const locales: Errores = {
      nombre: validarNombre(nombre),
      email: validarEmail(email),
      rol: rol ? undefined : "Elija un rol",
      clave: validarClave(clave),
    };
    setGeneral(undefined);
    setErrores(locales);
    if (Object.values(locales).some(Boolean)) return;
    crear.mutate();
  }

  return (
    <form id="form-nuevo-usuario" onSubmit={enviar} noValidate className="space-y-5">
      {general && <Aviso tono="error">{general}</Aviso>}
      <Campo etiqueta="Nombre completo" error={errores.nombre}>
        <input className="campo-control" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" maxLength={100} />
      </Campo>
      <Campo etiqueta="Correo" error={errores.email} ayuda="Será su usuario para iniciar sesión. No se puede cambiar después.">
        <input
          type="email"
          className="campo-control"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="off"
          maxLength={120}
          inputMode="email"
        />
      </Campo>
      <SelectorRol valor={rol} alCambiar={setRol} error={errores.rol} />
      <CampoClave etiqueta="Contraseña inicial" valor={clave} alCambiar={setClave} error={errores.clave} />
      <BotonEnviarOculto />
    </form>
  );
}

/** Permite enviar con Enter aunque el botón visible esté en el pie. */
function BotonEnviarOculto() {
  return <button type="submit" hidden aria-hidden tabIndex={-1} />;
}

// ---------------------------------------------------------------- Edición

export function PanelEditarUsuario({
  usuario,
  esUnoMismo,
  alCerrar,
  alActualizar,
}: {
  usuario: UsuarioApi | null;
  esUnoMismo: boolean;
  alCerrar: () => void;
  alActualizar: (u: UsuarioApi) => void;
}) {
  const idForm = useId();
  const [guardando, setGuardando] = useState(false);
  const [confirmarDesbloqueo, setConfirmarDesbloqueo] = useState(false);
  const qc = useQueryClient();
  const notificar = useNotificar();
  const desbloquear = useMutation({
    mutationFn: (id: number) => api.patch<UsuarioApi>(`/usuarios/${id}`, { desbloquear: true }),
    onSuccess: (u) => {
      notificar(`Cuenta de «${u.nombre}» desbloqueada`);
      setConfirmarDesbloqueo(false);
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      alActualizar(u);
    },
  });
  return (
    <>
      <Dialogo
        abierto={!!usuario}
        alCerrar={alCerrar}
        variante="panel"
        titulo="Editar usuario"
        descripcion={usuario ? usuario.nombre : undefined}
        pie={
          <>
            <button type="button" onClick={alCerrar} className="btn-secundario">
              Cancelar
            </button>
            <button type="submit" form={idForm} disabled={guardando} className="btn-primario">
              {guardando && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
          </>
        }
      >
        {usuario && (
          <FormularioEditar
            key={usuario.id}
            idForm={idForm}
            usuario={usuario}
            esUnoMismo={esUnoMismo}
            alCerrar={alCerrar}
            alActualizar={alActualizar}
            alCambiarGuardando={setGuardando}
            alPedirDesbloqueo={() => setConfirmarDesbloqueo(true)}
          />
        )}
      </Dialogo>
      {/* Hermano del panel (no hijo): el onClose de un <dialog> anidado se propaga por el árbol de React y cerraría el panel. */}
      {usuario && (
        <DialogoConfirmacion
          abierto={confirmarDesbloqueo}
          alCerrar={() => {
            setConfirmarDesbloqueo(false);
            desbloquear.reset();
          }}
          titulo="¿Desbloquear la cuenta?"
          descripcion={
            <>
              <span className="font-medium text-slate-900">{usuario.nombre}</span> podrá volver a iniciar sesión de inmediato y su contador
              de intentos fallidos vuelve a cero.
            </>
          }
          textoConfirmar="Sí, desbloquear"
          procesando={desbloquear.isPending}
          error={desbloquear.error ? desbloquear.error.message : null}
          alConfirmar={() => desbloquear.mutate(usuario.id)}
        />
      )}
    </>
  );
}

function FormularioEditar({
  idForm,
  usuario,
  esUnoMismo,
  alCerrar,
  alActualizar,
  alCambiarGuardando,
  alPedirDesbloqueo,
}: {
  idForm: string;
  usuario: UsuarioApi;
  esUnoMismo: boolean;
  alCerrar: () => void;
  alActualizar: (u: UsuarioApi) => void;
  alCambiarGuardando: (v: boolean) => void;
  alPedirDesbloqueo: () => void;
}) {
  const qc = useQueryClient();
  const notificar = useNotificar();
  const [nombre, setNombre] = useState(usuario.nombre);
  const [rol, setRol] = useState<Rol | "">(usuario.rol);
  const [activo, setActivo] = useState(usuario.activo);
  const [errores, setErrores] = useState<Errores>({});
  const [general, setGeneral] = useState<string>();
  const idActivo = useId();

  const cambios: Record<string, unknown> = {};
  if (nombre.trim() !== usuario.nombre) cambios.nombre = nombre.trim();
  if (rol !== usuario.rol) cambios.rol = rol;
  if (activo !== usuario.activo) cambios.activo = activo;

  const guardar = useMutation({
    mutationFn: (cuerpo: Record<string, unknown>) => api.patch<UsuarioApi>(`/usuarios/${usuario.id}`, cuerpo),
    onMutate: () => alCambiarGuardando(true),
    onSettled: () => alCambiarGuardando(false),
    onSuccess: (u, cuerpo) => {
      notificar(
        cuerpo.activo === false
          ? `Usuario «${u.nombre}» desactivado`
          : cuerpo.activo === true
            ? `Usuario «${u.nombre}» reactivado`
            : `Usuario «${u.nombre}» actualizado`,
      );
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      alActualizar(u);
      alCerrar();
    },
    onError: (err) => {
      const r = erroresDeApi(err, ["nombre", "rol", "activo"]);
      setErrores(r.campos);
      setGeneral(r.general);
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    const locales: Errores = { nombre: validarNombre(nombre) };
    setErrores(locales);
    setGeneral(undefined);
    if (locales.nombre) return;
    if (Object.keys(cambios).length === 0) {
      setGeneral("No hay cambios por guardar.");
      return;
    }
    guardar.mutate(cambios);
  }

  const rolPropio = "Es su propia cuenta: no puede quitarse el rol de administrador.";
  const activoPropio = "Es su propia cuenta: no puede desactivarla. Otro administrador tendría que hacerlo.";

  return (
    <div className="space-y-6">
      <form id={idForm} onSubmit={enviar} noValidate className="space-y-5">
        {general && <Aviso tono={general.startsWith("No hay cambios") ? "info" : "error"}>{general}</Aviso>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-600">Correo</dt>
          <dd className="min-w-0 font-medium break-all text-slate-900">{usuario.email}</dd>
          <dt className="text-slate-600">Creado</dt>
          <dd className="text-slate-900 tabular-nums">{formatoFechaHora(usuario.creadoEn)}</dd>
        </dl>
        <Campo etiqueta="Nombre completo" error={errores.nombre}>
          <input className="campo-control" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" maxLength={100} />
        </Campo>
        <SelectorRol
          valor={rol}
          alCambiar={setRol}
          error={errores.rol}
          deshabilitado={esUnoMismo}
          ayuda={esUnoMismo ? rolPropio : undefined}
        />
        <div>
          <div className="flex min-h-11 items-start gap-3">
            <input
              id={idActivo}
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              disabled={esUnoMismo}
              aria-invalid={errores.activo ? true : undefined}
              aria-describedby={`${idActivo}-ayuda`}
              className="mt-0.5 size-5 shrink-0 disabled:cursor-not-allowed"
            />
            <div>
              <label htmlFor={idActivo} className={`text-sm font-medium ${esUnoMismo ? "text-slate-600" : "text-slate-900"}`}>
                Cuenta activa
              </label>
              <p id={`${idActivo}-ayuda`} className="text-sm text-slate-600">
                {esUnoMismo ? activoPropio : "Una cuenta inactiva no puede iniciar sesión. Sus pedidos y registros se conservan."}
              </p>
            </div>
          </div>
          {errores.activo && <p className="campo-error">{errores.activo}</p>}
        </div>
        <BotonEnviarOculto />
      </form>

      <SeccionAcceso usuario={usuario} alActualizar={alActualizar} alPedirDesbloqueo={alPedirDesbloqueo} />
    </div>
  );
}

// ---------------------------------------------------------------- Acceso: contraseña y bloqueo

function SeccionAcceso({
  usuario,
  alActualizar,
  alPedirDesbloqueo,
}: {
  usuario: UsuarioApi;
  alActualizar: (u: UsuarioApi) => void;
  alPedirDesbloqueo: () => void;
}) {
  const qc = useQueryClient();
  const notificar = useNotificar();
  const [restableciendo, setRestableciendo] = useState(false);
  const [clave, setClave] = useState("");
  const [errorClave, setErrorClave] = useState<string>();
  const idFormClave = useId();

  const cambiarClave = useMutation({
    mutationFn: () => api.patch<UsuarioApi>(`/usuarios/${usuario.id}`, { clave }),
    onSuccess: (u) => {
      notificar(`Contraseña de «${u.nombre}» restablecida`);
      setRestableciendo(false);
      setClave("");
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      alActualizar(u);
    },
    onError: (err) => setErrorClave(err instanceof ApiError ? (err.campos.clave ?? err.message) : "Ocurrió un error inesperado"),
  });

  function enviarClave(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const err = validarClave(clave);
    setErrorClave(err);
    if (!err) cambiarClave.mutate();
  }

  return (
    <section aria-labelledby={`${idFormClave}-titulo`} className="space-y-4 border-t border-slate-200 pt-5">
      <h3 id={`${idFormClave}-titulo`} className="font-semibold text-slate-900">
        Acceso
      </h3>

      {usuario.bloqueado && usuario.bloqueadoHasta && (
        <div className="space-y-3 rounded-lg border border-ambar-100 bg-ambar-50 p-3">
          <p className="text-sm text-ambar-800">
            <span className="font-semibold">Cuenta bloqueada hasta las {horaLima(usuario.bloqueadoHasta)}</span> por 5 intentos fallidos de
            inicio de sesión. Se desbloquea sola al vencer el plazo.
          </p>
          <button type="button" onClick={alPedirDesbloqueo} className="btn-secundario">
            <LockOpen aria-hidden className="size-4" />
            Desbloquear cuenta
          </button>
        </div>
      )}

      {!restableciendo ? (
        <div>
          <button type="button" onClick={() => setRestableciendo(true)} className="btn-secundario">
            <KeyRound aria-hidden className="size-4" />
            Restablecer contraseña
          </button>
          <p className="mt-1.5 text-sm text-slate-600">Asigne una contraseña nueva y entréguela a la persona.</p>
        </div>
      ) : (
        <form id={idFormClave} onSubmit={enviarClave} noValidate className="space-y-3">
          <CampoClave etiqueta="Nueva contraseña" valor={clave} alCambiar={setClave} error={errorClave} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={cambiarClave.isPending} className="btn-primario">
              {cambiarClave.isPending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
              {cambiarClave.isPending ? "Guardando…" : "Guardar contraseña"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRestableciendo(false);
                setClave("");
                setErrorClave(undefined);
              }}
              className="btn-secundario"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export function ChipBloqueado({ hasta }: { hasta: string }) {
  return <Chip tono="ambar">Bloqueado hasta {horaLima(hasta)}</Chip>;
}
