import { LogOut, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { useAuth, useUsuario } from "../auth/AuthContext";
import { NOMBRE_ROL } from "../auth/roles";
import { Logo } from "../components/Logo";
import { GRUPOS, menuDe } from "./menu";

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function Navegacion({ alNavegar }: { alNavegar?: () => void }) {
  const usuario = useUsuario();
  const opciones = menuDe(usuario.rol);
  const { pathname } = useLocation();

  // Una ruta de detalle (p. ej. /pedidos/12) mantiene marcada su sección, salvo que otra opción
  // del menú la cubra mejor (/pedidos/nuevo es «Nuevo pedido», no «Pedidos»).
  const seccion = opciones
    .filter((o) => pathname === o.ruta || pathname.startsWith(o.ruta + "/"))
    .sort((a, b) => b.ruta.length - a.ruta.length)[0]?.ruta;

  return (
    <nav aria-label="Menú principal" className="flex-1 overflow-y-auto px-3 py-4">
      {GRUPOS.map((grupo) => {
        const delGrupo = opciones.filter((o) => o.grupo === grupo);
        if (delGrupo.length === 0) return null;
        return (
          <div key={grupo} className="mb-5">
            <p className="px-3 pb-1.5 text-xs font-semibold tracking-wide text-marino-200 uppercase">{grupo}</p>
            <ul className="space-y-0.5">
              {delGrupo.map(({ ruta, etiqueta, icono: Icono }) => (
                <li key={ruta}>
                  <NavLink
                    to={ruta}
                    end
                    onClick={alNavegar}
                    className={({ isActive }) =>
                      `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-marino-100 ${
                        isActive || seccion === ruta ? "bg-white/12 text-white" : "text-marino-100 hover:bg-white/6 hover:text-white"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icono
                          aria-hidden
                          className={`size-[18px] shrink-0 transition-colors duration-150 ${isActive || seccion === ruta ? "text-teal-100" : ""}`}
                        />
                        {etiqueta}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function Marca() {
  return (
    <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10 px-5">
      <Logo className="size-8" />
      <div className="leading-tight">
        <p className="text-base font-bold tracking-tight text-white">SIGPI</p>
        <p className="text-xs text-marino-200">DistriNorte S.A.C.</p>
      </div>
    </div>
  );
}

export function Layout() {
  const { cerrarSesion } = useAuth();
  const usuario = useUsuario();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const dialogo = useRef<HTMLDialogElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (menuAbierto && !d.open) d.showModal();
    if (!menuAbierto && d.open) d.close();
  }, [menuAbierto]);

  // Al cambiar de página se cierra el menú móvil.
  useEffect(() => setMenuAbierto(false), [pathname]);

  return (
    <div className="min-h-dvh bg-slate-50 lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Barra lateral fija en escritorio */}
      <aside className="sticky top-0 hidden h-dvh flex-col bg-marino lg:flex">
        <Marca />
        <Navegacion />
      </aside>

      {/* Menú deslizable en celular y tableta */}
      <dialog
        ref={dialogo}
        onClose={() => setMenuAbierto(false)}
        onClick={(e) => e.target === e.currentTarget && setMenuAbierto(false)}
        aria-label="Menú"
        className="m-0 h-dvh max-h-dvh w-72 max-w-[85vw] bg-transparent p-0 backdrop:bg-marino-900/50 open:animate-[entrar_200ms_var(--ease-salida)] lg:hidden"
      >
        <div className="flex h-full flex-col bg-marino">
          <div className="relative">
            <Marca />
            <button
              type="button"
              onClick={() => setMenuAbierto(false)}
              className="absolute top-2.5 right-2 grid size-11 place-items-center rounded-lg text-marino-100 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-marino-100"
              aria-label="Cerrar menú"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <Navegacion alNavegar={() => setMenuAbierto(false)} />
        </div>
      </dialog>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            className="-ml-2 grid size-11 place-items-center rounded-lg text-slate-700 transition-colors duration-150 hover:bg-slate-100 lg:hidden"
            aria-label="Abrir menú"
            aria-expanded={menuAbierto}
          >
            <Menu aria-hidden className="size-5" />
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <Logo className="size-7" />
            <span className="font-bold text-marino">SIGPI</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-semibold text-slate-900">{usuario.nombre}</p>
              <p className="text-xs text-slate-600">{NOMBRE_ROL[usuario.rol]}</p>
            </div>
            <span
              aria-hidden
              className="grid size-9 place-items-center rounded-full bg-marino-50 text-sm font-semibold text-marino"
            >
              {iniciales(usuario.nombre)}
            </span>
            <span className="sr-only">
              {usuario.nombre}, {NOMBRE_ROL[usuario.rol]}
            </span>
            <button type="button" onClick={() => cerrarSesion()} className="btn-secundario px-3">
              <LogOut aria-hidden className="size-4" />
              <span>Salir</span>
            </button>
          </div>
        </header>

        <main id="contenido" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
