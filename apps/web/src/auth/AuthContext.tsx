import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, registrarExpiracionSesion, sesionGuardada } from "../api/cliente";
import type { Usuario } from "./roles";

interface EstadoAuth {
  usuario: Usuario | null;
  cargando: boolean;
  /** Mensaje para la pantalla de login (p. ej., sesión expirada). */
  aviso: string | null;
  iniciarSesion: (email: string, clave: string) => Promise<Usuario>;
  cerrarSesion: (aviso?: string) => void;
}

const AuthContext = createContext<EstadoAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(() => sesionGuardada.leer() !== null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cerrarSesion = useCallback(
    (nuevoAviso?: string) => {
      sesionGuardada.borrar();
      queryClient.clear();
      setUsuario(null);
      setAviso(nuevoAviso ?? null);
    },
    [queryClient],
  );

  useEffect(() => {
    registrarExpiracionSesion(() => cerrarSesion("Su sesión expiró. Inicie sesión nuevamente."));
  }, [cerrarSesion]);

  // Recupera la sesión guardada al recargar la página.
  useEffect(() => {
    if (!sesionGuardada.leer()) return;
    api
      .get<{ usuario: Usuario }>("/auth/me")
      .then((r) => setUsuario(r.usuario))
      .catch(() => sesionGuardada.borrar())
      .finally(() => setCargando(false));
  }, []);

  const iniciarSesion = useCallback(async (email: string, clave: string) => {
    const r = await api.post<{ token: string; usuario: Usuario }>("/auth/login", { email, clave });
    sesionGuardada.guardar(r.token);
    setAviso(null);
    setUsuario(r.usuario);
    return r.usuario;
  }, []);

  const valor = useMemo(
    () => ({ usuario, cargando, aviso, iniciarSesion, cerrarSesion }),
    [usuario, cargando, aviso, iniciarSesion, cerrarSesion],
  );
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

/** Usuario autenticado (solo dentro de rutas protegidas). */
export function useUsuario(): Usuario {
  const { usuario } = useAuth();
  if (!usuario) throw new Error("useUsuario requiere una sesión activa");
  return usuario;
}
