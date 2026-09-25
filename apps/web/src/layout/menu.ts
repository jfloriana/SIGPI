import {
  Boxes,
  ClipboardList,
  FileClock,
  FilePlus2,
  History,
  Info,
  LayoutDashboard,
  PackageSearch,
  SlidersHorizontal,
  Store,
  Truck,
  TriangleAlert,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import type { Rol } from "../auth/roles";

export interface OpcionMenu {
  ruta: string;
  etiqueta: string;
  icono: LucideIcon;
  roles: readonly Rol[];
  grupo: "Operación" | "Inventario" | "Maestros" | "Control";
}

const TODOS: readonly Rol[] = ["ADMIN", "GERENTE", "VENDEDOR", "ALMACENERO"];

// Matriz de permisos del informe. El servidor aplica la misma regla en cada ruta;
// aquí solo se decide qué opciones se muestran.
export const MENU: OpcionMenu[] = [
  { ruta: "/tablero", etiqueta: "Tablero", icono: LayoutDashboard, roles: ["ADMIN", "GERENTE"], grupo: "Operación" },
  { ruta: "/pedidos/nuevo", etiqueta: "Nuevo pedido", icono: FilePlus2, roles: ["VENDEDOR"], grupo: "Operación" },
  { ruta: "/pedidos", etiqueta: "Pedidos", icono: ClipboardList, roles: TODOS, grupo: "Operación" },
  { ruta: "/despacho", etiqueta: "Cola de despacho", icono: Truck, roles: ["ALMACENERO"], grupo: "Operación" },
  { ruta: "/alertas", etiqueta: "Alertas de stock", icono: TriangleAlert, roles: ["ALMACENERO", "GERENTE", "ADMIN"], grupo: "Inventario" },
  { ruta: "/productos", etiqueta: "Productos", icono: Boxes, roles: TODOS, grupo: "Inventario" },
  { ruta: "/kardex", etiqueta: "Kardex", icono: PackageSearch, roles: ["ADMIN", "GERENTE", "ALMACENERO"], grupo: "Inventario" },
  { ruta: "/ajustes", etiqueta: "Ajustes de inventario", icono: SlidersHorizontal, roles: ["ADMIN", "ALMACENERO"], grupo: "Inventario" },
  { ruta: "/compras", etiqueta: "Proveedores y compras", icono: FileClock, roles: ["ADMIN", "GERENTE", "ALMACENERO"], grupo: "Inventario" },
  { ruta: "/clientes", etiqueta: "Clientes", icono: Store, roles: TODOS, grupo: "Maestros" },
  { ruta: "/usuarios", etiqueta: "Usuarios", icono: UserCog, roles: ["ADMIN", "GERENTE"], grupo: "Maestros" },
  { ruta: "/bitacora", etiqueta: "Bitácora", icono: History, roles: ["ADMIN", "GERENTE"], grupo: "Control" },
  { ruta: "/acerca", etiqueta: "Acerca del sistema", icono: Info, roles: TODOS, grupo: "Control" },
];

export const GRUPOS = ["Operación", "Inventario", "Maestros", "Control"] as const;

export function menuDe(rol: Rol) {
  return MENU.filter((o) => o.roles.includes(rol));
}
