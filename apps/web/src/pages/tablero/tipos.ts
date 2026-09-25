import type { EstadoPedido } from "../../components/Chip";

/** Respuesta de `GET /reportes/tablero` (ver API.md › Reportes). Los montos llegan como string con 2 decimales. */
export interface Tablero {
  alcance: "TOTAL" | "PROPIO" | "STOCK";
  periodo: { desde: string; hasta: string };
  ventasTotales: string | null;
  numPedidos: number | null;
  ticketPromedio: string | null;
  pedidosPorEstado: { estado: EstadoPedido; cantidad: number }[];
  ventasPorDia: { fecha: string; total: string; pedidos: number }[];
  top10Productos: { productoId: number; codigo: string; nombre: string; cantidad: number; total: string }[];
  ventasPorVendedor: { vendedorId: number; nombre: string; total: string; pedidos: number }[];
  ventasPorZona: { zona: string; total: string; pedidos: number }[];
  productosEnAlerta: { id: number; codigo: string; nombre: string; stock: number; stockMinimo: number; cantidadSugerida: number }[];
}
