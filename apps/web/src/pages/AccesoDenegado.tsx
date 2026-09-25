import { ShieldX } from "lucide-react";
import { Link } from "react-router";
import { useUsuario } from "../auth/AuthContext";
import { INICIO_POR_ROL, NOMBRE_ROL } from "../auth/roles";

export function AccesoDenegado() {
  const usuario = useUsuario();
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-coral-50 text-coral-700">
        <ShieldX aria-hidden className="size-6" />
      </span>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Acceso denegado</h1>
      <p className="mt-2 text-slate-600">
        Su rol ({NOMBRE_ROL[usuario.rol]}) no tiene permiso para ver esta pantalla. Si lo necesita, solicítelo al
        administrador del sistema.
      </p>
      <Link to={INICIO_POR_ROL[usuario.rol]} className="btn-primario mt-6">
        Ir a mi pantalla de inicio
      </Link>
    </div>
  );
}
