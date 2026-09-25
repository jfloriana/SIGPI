import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { AccesoDenegado } from "../pages/AccesoDenegado";
import { useAuth } from "./AuthContext";
import type { Rol } from "./roles";

/** Exige sesión iniciada; si se indican roles, también exige uno de ellos. */
export function RutaProtegida({ roles, children }: { roles?: readonly Rol[]; children: ReactNode }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando) {
    return (
      <div role="status" className="grid min-h-dvh place-items-center text-slate-600">
        <LoaderCircle aria-hidden className="size-6 animate-spin" />
        <span className="sr-only">Cargando sesión…</span>
      </div>
    );
  }
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname }} />;
  if (roles && !roles.includes(usuario.rol)) return <AccesoDenegado />;
  return children;
}
