import { Ban, Check, Clock } from "lucide-react";
import type { ReactNode } from "react";
import { formatoFechaHora } from "../../../utils/formato";
import type { EstadoPedido, PedidoDetalle, RegistroHistorial } from "../tipos";

type Marca = "hecho" | "siguiente" | "pendiente" | "anulado";

interface Paso {
  clave: EstadoPedido;
  titulo: string;
  marca: Marca;
  quien?: string | null;
  cuando?: string | null;
  nota?: ReactNode;
}

const ORDEN: EstadoPedido[] = ["REGISTRADO", "APROBADO", "DESPACHADO", "ENTREGADO"];

function eventoDe(historial: RegistroHistorial[], estado: EstadoPedido) {
  if (estado === "REGISTRADO") return historial.find((h) => h.accion === "CREAR");
  if (estado === "ANULADO") return historial.find((h) => h.accion === "ANULAR" || h.despues?.estado === "ANULADO");
  // El último, por si hubiera más de uno.
  return [...historial].reverse().find((h) => h.accion === "CAMBIO_ESTADO" && h.despues?.estado === estado);
}

/**
 * Construye los pasos desde `historial` (quién y cuándo, según la bitácora). Si falta algún
 * registro, usa los campos del pedido (`fechaAprobacion`, `despachadoPor`, …).
 */
export function construirPasos(d: PedidoDetalle): Paso[] {
  const h = d.historial ?? [];
  const alcanzado = d.estado === "ANULADO" ? -1 : ORDEN.indexOf(d.estado);

  const creado = eventoDe(h, "REGISTRADO");
  const aprobado = eventoDe(h, "APROBADO");
  const despachado = eventoDe(h, "DESPACHADO");
  const entregado = eventoDe(h, "ENTREGADO");

  const automatica = aprobado?.despues?.aprobacion === "AUTOMATICA" || d.aprobacionAutomatica;
  const hechoAprob = alcanzado >= 1 || !!aprobado || !!d.fechaAprobacion;
  const hechoDesp = alcanzado >= 2 || !!despachado || !!d.fechaDespacho;
  const hechoEntr = alcanzado >= 3 || !!entregado || !!d.fechaEntrega;
  const movimientos = despachado?.despues?.movimientos?.length ?? d.lineas.length;

  const pasos: Paso[] = [
    {
      clave: "REGISTRADO",
      titulo: "Registrado",
      marca: "hecho",
      quien: creado?.usuario?.nombre ?? d.vendedor.nombre,
      cuando: creado?.fecha ?? d.fecha,
    },
    hechoAprob
      ? {
          clave: "APROBADO",
          titulo: automatica ? "Aprobación automática" : "Aprobado",
          marca: "hecho",
          quien: automatica ? "Sistema" : (aprobado?.usuario?.nombre ?? d.aprobadoPor?.nombre),
          cuando: aprobado?.fecha ?? d.fechaAprobacion,
          nota: automatica ? `Regla 7: ${aprobado?.despues?.regla ?? "Contado con total ≤ S/ 2 000"}` : undefined,
        }
      : { clave: "APROBADO", titulo: "Aprobación", marca: "pendiente", nota: "Pendiente de aprobación del gerente" },
    hechoDesp
      ? {
          clave: "DESPACHADO",
          titulo: "Despachado",
          marca: "hecho",
          quien: despachado?.usuario?.nombre ?? d.despachadoPor?.nombre,
          cuando: despachado?.fecha ?? d.fechaDespacho,
          nota: `Salida de stock de ${movimientos} ${movimientos === 1 ? "producto" : "productos"}`,
        }
      : {
          clave: "DESPACHADO",
          titulo: "Despacho",
          marca: "pendiente",
          nota: hechoAprob ? "En la cola de despacho del almacén" : "Después de la aprobación",
        },
    hechoEntr
      ? {
          clave: "ENTREGADO",
          titulo: "Entregado",
          marca: "hecho",
          quien: entregado?.usuario?.nombre,
          cuando: entregado?.fecha ?? d.fechaEntrega,
        }
      : { clave: "ENTREGADO", titulo: "Entrega", marca: "pendiente", nota: hechoDesp ? "En camino al cliente" : "Después del despacho" },
  ];

  if (d.estado === "ANULADO") {
    const anulado = eventoDe(h, "ANULADO");
    return [
      ...pasos.filter((p) => p.marca === "hecho"),
      {
        clave: "ANULADO",
        titulo: "Anulado",
        marca: "anulado",
        quien: anulado?.usuario?.nombre,
        cuando: anulado?.fecha,
        nota: (anulado?.despues?.motivo ?? d.motivoAnulacion) && <>Motivo: «{anulado?.despues?.motivo ?? d.motivoAnulacion}»</>,
      },
    ];
  }

  // El primer paso pendiente es el que el pedido está esperando ahora.
  const i = pasos.findIndex((p) => p.marca === "pendiente");
  if (i >= 0) pasos[i] = { ...pasos[i], marca: "siguiente" };
  return pasos;
}

const CIRCULO: Record<Marca, string> = {
  hecho: "bg-teal-700 text-white ring-teal-700",
  anulado: "bg-coral-700 text-white ring-coral-700",
  siguiente: "bg-white text-marino ring-marino-500",
  pendiente: "bg-white text-slate-400 ring-slate-200",
};

function Icono({ marca }: { marca: Marca }) {
  if (marca === "hecho") return <Check aria-hidden className="size-4" strokeWidth={2.5} />;
  if (marca === "anulado") return <Ban aria-hidden className="size-4" />;
  if (marca === "siguiente") return <Clock aria-hidden className="size-4" />;
  return <span aria-hidden className="size-1.5 rounded-full bg-current" />;
}

const ESTADO_SR: Record<Marca, string> = {
  hecho: "completado",
  anulado: "anulado",
  siguiente: "en espera",
  pendiente: "pendiente",
};

/** Línea de tiempo del estado del pedido: REGISTRADO → APROBADO → DESPACHADO → ENTREGADO (o ANULADO). */
export function LineaTiempo({ pedido }: { pedido: PedidoDetalle }) {
  const pasos = construirPasos(pedido);
  return (
    <ol aria-label="Línea de tiempo del pedido">
      {pasos.map((p, i) => {
        const ultimo = i === pasos.length - 1;
        const tramoHecho = p.marca === "hecho" && pasos[i + 1] && pasos[i + 1].marca !== "pendiente";
        return (
          <li key={p.clave} className="relative flex gap-3 pb-5 last:pb-0" aria-current={p.marca === "siguiente" ? "step" : undefined}>
            {!ultimo && (
              <span
                aria-hidden
                className={`absolute top-8 bottom-0 left-[15px] w-0.5 transition-colors duration-200 ${
                  tramoHecho ? "bg-teal-700" : "bg-slate-200"
                }`}
              />
            )}
            <span
              className={`relative grid size-8 shrink-0 place-items-center rounded-full ring-2 ring-inset transition-colors duration-200 ${CIRCULO[p.marca]}`}
            >
              <Icono marca={p.marca} />
            </span>
            <div className="min-w-0 pt-1">
              <p
                className={`text-sm font-semibold transition-colors duration-200 ${
                  p.marca === "pendiente" ? "text-slate-500" : p.marca === "anulado" ? "text-coral-800" : "text-slate-900"
                }`}
              >
                {p.titulo}
                <span className="sr-only"> ({ESTADO_SR[p.marca]})</span>
              </p>
              {(p.quien || p.cuando) && (
                <p className="mt-0.5 text-sm text-slate-700">
                  {p.quien}
                  {p.quien && p.cuando && <span className="text-slate-400"> · </span>}
                  {p.cuando && (
                    <time dateTime={p.cuando} className="whitespace-nowrap tabular-nums">
                      {formatoFechaHora(p.cuando)}
                    </time>
                  )}
                </p>
              )}
              {p.nota && (
                <p className={`mt-0.5 text-sm ${p.marca === "siguiente" ? "font-medium text-marino" : "text-slate-600"}`}>{p.nota}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
