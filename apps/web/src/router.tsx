import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { useAuth } from "./auth/AuthContext";
import { INICIO_POR_ROL, type Rol } from "./auth/roles";
import { RutaProtegida } from "./auth/RutaProtegida";
import { Cargando } from "./components/Estados";
import { Layout } from "./layout/Layout";
import { MENU } from "./layout/menu";
import { LoginPage } from "./pages/login/LoginPage";

// Cada pantalla se carga por separado (la landing con Three.js no pesa en el sistema interno).
const Landing = lazy(() => import("./pages/landing/LandingPage"));

const PANTALLAS: Record<string, LazyExoticComponent<ComponentType>> = {
  "/tablero": lazy(() => import("./pages/tablero/TableroPage")),
  "/pedidos/nuevo": lazy(() => import("./pages/pedidos/NuevoPedidoPage")),
  "/pedidos": lazy(() => import("./pages/pedidos/PedidosPage")),
  "/despacho": lazy(() => import("./pages/despacho/DespachoPage")),
  "/alertas": lazy(() => import("./pages/inventario/AlertasPage")),
  "/productos": lazy(() => import("./pages/productos/ProductosPage")),
  "/kardex": lazy(() => import("./pages/inventario/KardexPage")),
  "/ajustes": lazy(() => import("./pages/inventario/AjustesPage")),
  "/compras": lazy(() => import("./pages/compras/ComprasPage")),
  "/clientes": lazy(() => import("./pages/clientes/ClientesPage")),
  "/usuarios": lazy(() => import("./pages/usuarios/UsuariosPage")),
  "/bitacora": lazy(() => import("./pages/bitacora/BitacoraPage")),
  "/acerca": lazy(() => import("./pages/acerca/AcercaPage")),
};

const PedidoDetalle = lazy(() => import("./pages/pedidos/PedidoDetallePage"));

/** Rutas protegidas que no aparecen en el menú. */
const EXTRA: { ruta: string; roles: readonly Rol[]; Pantalla: LazyExoticComponent<ComponentType> }[] = [
  { ruta: "/pedidos/:id", roles: ["ADMIN", "GERENTE", "VENDEDOR", "ALMACENERO"], Pantalla: PedidoDetalle },
];

function Inicio() {
  const { usuario } = useAuth();
  return <Navigate to={usuario ? INICIO_POR_ROL[usuario.rol] : "/"} replace />;
}

function conCarga(Pantalla: ComponentType) {
  return (
    <Suspense fallback={<Cargando />}>
      <Pantalla />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <Suspense fallback={<div className="min-h-dvh bg-marino-50" />}>
        <Landing />
      </Suspense>
    ),
  },
  { path: "/login", element: <LoginPage /> },
  {
    element: (
      <RutaProtegida>
        <Layout />
      </RutaProtegida>
    ),
    children: [
      { path: "/inicio", element: <Inicio /> },
      ...MENU.map((opcion) => ({
        path: opcion.ruta,
        element: <RutaProtegida roles={opcion.roles}>{conCarga(PANTALLAS[opcion.ruta])}</RutaProtegida>,
      })),
      ...EXTRA.map(({ ruta, roles, Pantalla }) => ({
        path: ruta,
        element: <RutaProtegida roles={roles}>{conCarga(Pantalla)}</RutaProtegida>,
      })),
      { path: "*", element: <Inicio /> },
    ],
  },
]);
