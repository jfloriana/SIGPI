import { ChevronDown, CircleAlert, Clock, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { ApiError } from "../../api/cliente";
import { useAuth } from "../../auth/AuthContext";
import { INICIO_POR_ROL } from "../../auth/roles";
import { Logo } from "../../components/Logo";

const CUENTAS_DEMO = [
  { email: "admin@distrinorte.pe", rol: "Administrador" },
  { email: "gerente@distrinorte.pe", rol: "Gerente" },
  { email: "vendedor1@distrinorte.pe", rol: "Vendedor" },
  { email: "vendedor2@distrinorte.pe", rol: "Vendedor" },
  { email: "almacen@distrinorte.pe", rol: "Almacenero" },
];

export function LoginPage() {
  const { usuario, iniciarSesion, aviso } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const id = useId();

  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ mensaje: string; bloqueada: boolean } | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});

  if (usuario) return <Navigate to={INICIO_POR_ROL[usuario.rol]} replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const locales: Record<string, string> = {};
    if (!email.trim()) locales.email = "Ingrese su correo";
    if (!clave) locales.clave = "Ingrese su contraseña";
    setErrores(locales);
    setError(null);
    if (Object.keys(locales).length) return;

    setEnviando(true);
    try {
      const u = await iniciarSesion(email, clave);
      const destino = (location.state as { desde?: string } | null)?.desde;
      navigate(destino && destino !== "/login" ? destino : INICIO_POR_ROL[u.rol], { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrores(err.campos);
        setError({ mensaje: err.message, bloqueada: err.codigo === "CUENTA_BLOQUEADA" });
      } else {
        setError({ mensaje: "Ocurrió un error inesperado", bloqueada: false });
      }
    } finally {
      setEnviando(false);
    }
  }

  const mensajeGeneral = error ?? (aviso ? { mensaje: aviso, bloqueada: false } : null);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(28rem,36rem)]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-marino p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <Logo className="size-10" />
          <div className="leading-tight">
            <p className="text-lg font-bold">SIGPI</p>
            <p className="text-sm text-marino-200">DistriNorte S.A.C. · Trujillo</p>
          </div>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl leading-tight font-bold text-balance">
            Pedidos, inventario y compras en un solo sistema.
          </h2>
          <p className="mt-4 text-marino-100">
            Registro de pedidos en campo, aprobación, despacho con control de stock, alertas de reposición y
            trazabilidad completa de cada operación.
          </p>
        </div>
        <p className="text-xs text-marino-200">
          Sistema demo académico · Sistemas de Información Empresarial · Universidad Nacional de Trujillo
        </p>
      </section>

      <main className="flex items-center justify-center bg-white px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo className="size-10" />
            <div className="leading-tight">
              <p className="text-lg font-bold text-marino">SIGPI</p>
              <p className="text-sm text-slate-600">DistriNorte S.A.C.</p>
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-slate-600">Ingrese con su correo corporativo.</p>

          {mensajeGeneral && (
            <div
              role="alert"
              className="mt-6 flex gap-3 rounded-lg border border-coral-100 bg-coral-50 p-3 text-sm text-coral-800 animate-[aparecer_200ms_var(--ease-salida)]"
            >
              {mensajeGeneral.bloqueada ? (
                <Clock aria-hidden className="mt-0.5 size-4 shrink-0" />
              ) : (
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              )}
              <p>{mensajeGeneral.mensaje}</p>
            </div>
          )}

          <form onSubmit={enviar} noValidate className="mt-6 space-y-5">
            <div>
              <label htmlFor={`${id}-email`} className="campo-etiqueta">
                Correo
              </label>
              <input
                id={`${id}-email`}
                type="email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errores.email}
                aria-describedby={errores.email ? `${id}-email-error` : undefined}
                className="campo-control"
                placeholder="nombre@distrinorte.pe"
              />
              {errores.email && (
                <p id={`${id}-email-error`} className="campo-error">
                  {errores.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor={`${id}-clave`} className="campo-etiqueta">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id={`${id}-clave`}
                  type={verClave ? "text" : "password"}
                  autoComplete="current-password"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  aria-invalid={!!errores.clave}
                  aria-describedby={errores.clave ? `${id}-clave-error` : undefined}
                  className="campo-control pr-12"
                />
                <button
                  type="button"
                  onClick={() => setVerClave((v) => !v)}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-slate-600 hover:text-slate-900"
                  aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={verClave}
                >
                  {verClave ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
                </button>
              </div>
              {errores.clave && (
                <p id={`${id}-clave-error`} className="campo-error">
                  {errores.clave}
                </p>
              )}
            </div>

            <button type="submit" disabled={enviando} className="btn-primario w-full">
              {enviando && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
              {enviando ? "Ingresando…" : "Ingresar"}
            </button>
          </form>

          <details className="group mt-8 rounded-lg border border-slate-200 text-sm">
            <summary className="flex min-h-11 list-none items-center justify-between gap-2 rounded-lg px-4 font-medium text-slate-700 transition-colors duration-150 select-none hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              Usuarios de demostración
              <ChevronDown aria-hidden className="size-4 text-slate-500 transition-transform duration-200 ease-[var(--ease-salida)] group-open:rotate-180" />
            </summary>
            <div className="border-t border-slate-200 px-4 py-3">
              <p className="mb-2 text-slate-600">
                Contraseña de todos: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-900">Demo2026!</code>
              </p>
              <ul className="-mx-2 space-y-0.5">
                {CUENTAS_DEMO.map((c) => (
                  <li key={c.email}>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail(c.email);
                        setErrores({});
                      }}
                      className="flex min-h-11 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] px-2 text-left transition-colors duration-150 hover:bg-marino-50/60"
                    >
                      <span className="truncate text-slate-900">{c.email}</span>
                      <span className="shrink-0 text-xs text-slate-600">{c.rol}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </div>
      </main>
    </div>
  );
}
