import type { ReactNode } from "react";

export type TonoChip = "neutro" | "marino" | "teal" | "ambar" | "coral";

const TONOS: Record<TonoChip, string> = {
  neutro: "bg-slate-100 text-slate-700 ring-slate-200",
  marino: "bg-marino-50 text-marino ring-marino-100",
  teal: "bg-teal-50 text-teal-800 ring-teal-100",
  ambar: "bg-ambar-50 text-ambar-800 ring-ambar-100",
  coral: "bg-coral-50 text-coral-800 ring-coral-100",
};

const PUNTO: Record<TonoChip, string> = {
  neutro: "bg-slate-400",
  marino: "bg-marino-500",
  teal: "bg-teal",
  ambar: "bg-ambar",
  coral: "bg-coral",
};

/** Etiqueta compacta con punto de color. El texto siempre acompaña al color (no solo color). */
export function Chip({ tono = "neutro", children }: { tono?: TonoChip; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${TONOS[tono]}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${PUNTO[tono]}`} />
      {children}
    </span>
  );
}

export type EstadoPedido = "REGISTRADO" | "APROBADO" | "DESPACHADO" | "ENTREGADO" | "ANULADO";
export type EstadoOrden = "PENDIENTE" | "APROBADA" | "RECIBIDA" | "ANULADA";

const PEDIDO: Record<EstadoPedido, { tono: TonoChip; texto: string }> = {
  REGISTRADO: { tono: "neutro", texto: "Registrado" },
  APROBADO: { tono: "marino", texto: "Aprobado" },
  DESPACHADO: { tono: "ambar", texto: "Despachado" },
  ENTREGADO: { tono: "teal", texto: "Entregado" },
  ANULADO: { tono: "coral", texto: "Anulado" },
};

const ORDEN: Record<EstadoOrden, { tono: TonoChip; texto: string }> = {
  PENDIENTE: { tono: "neutro", texto: "Pendiente" },
  APROBADA: { tono: "marino", texto: "Aprobada" },
  RECIBIDA: { tono: "teal", texto: "Recibida" },
  ANULADA: { tono: "coral", texto: "Anulada" },
};

export const TEXTO_ESTADO_PEDIDO = Object.fromEntries(Object.entries(PEDIDO).map(([k, v]) => [k, v.texto])) as Record<
  EstadoPedido,
  string
>;

export function ChipEstadoPedido({ estado }: { estado: EstadoPedido }) {
  const e = PEDIDO[estado] ?? { tono: "neutro" as const, texto: estado };
  return <Chip tono={e.tono}>{e.texto}</Chip>;
}

export function ChipEstadoOrden({ estado }: { estado: EstadoOrden }) {
  const e = ORDEN[estado] ?? { tono: "neutro" as const, texto: estado };
  return <Chip tono={e.tono}>{e.texto}</Chip>;
}

/** Indicador de stock: ámbar cuando stock ≤ mínimo. */
export function ChipStock({ stock, stockMinimo }: { stock: number; stockMinimo: number }) {
  if (stock <= stockMinimo) return <Chip tono="ambar">En alerta · {stock}</Chip>;
  return <Chip tono="teal">{stock}</Chip>;
}

export function ChipActivo({ activo }: { activo: boolean }) {
  return activo ? <Chip tono="teal">Activo</Chip> : <Chip tono="neutro">Inactivo</Chip>;
}
