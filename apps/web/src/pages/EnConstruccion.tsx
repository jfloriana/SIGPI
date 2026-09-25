import { Hammer } from "lucide-react";
import { Encabezado } from "../components/Encabezado";

/** Marcador temporal para los módulos de las fases siguientes. */
export function EnConstruccion({ titulo, fase }: { titulo: string; fase: number }) {
  return (
    <>
      <Encabezado titulo={titulo} />
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <Hammer aria-hidden className="mx-auto size-8 text-slate-400" />
        <p className="mt-3 font-medium text-slate-900">Módulo en construcción</p>
        <p className="mt-1 text-sm text-slate-600">Se implementa en la Fase {fase} del proyecto.</p>
      </div>
    </>
  );
}
