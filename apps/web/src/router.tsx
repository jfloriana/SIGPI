import { createBrowserRouter, Navigate } from "react-router";
import { useAuth } from "./auth/AuthContext";
import { INICIO_POR_ROL } from "./auth/roles";
import { RutaProtegida } from "./auth/RutaProtegida";
import { Layout } from "./layout/Layout";
import { MENU } from "./layout/menu";
import { EnConstruccion } from "./pages/EnConstruccion";
import { LoginPage } from "./pages/login/LoginPage";

// Fase en la que se construye cada pantalla (las pantallas reales reemplazan a estos marcadores).
const FASE: Record<string, number> = {
  "/tablero": 5,
  "/pedidos/nuevo": 3,
  "/pedidos": 3,
  "/despacho": 3,
  "/alertas": 4,
  "/productos": 2,
  "/kardex": 4,
  "/ajustes": 4,
  "/compras": 4,
  "/clientes": 2,
  "/usuarios": 2,
  "/bitacora": 5,
  "/acerca": 5,
};

function Inicio() {
  const { usuario } = useAuth();
  return <Navigate to={usuario ? INICIO_POR_ROL[usuario.rol] : "/login"} replace />;
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: (
      <RutaProtegida>
        <Layout />
      </RutaProtegida>
    ),
    children: [
      { index: true, element: <Inicio /> },
      ...MENU.map((opcion) => ({
        path: opcion.ruta,
        element: (
          <RutaProtegida roles={opcion.roles}>
            <EnConstruccion titulo={opcion.etiqueta} fase={FASE[opcion.ruta]} />
          </RutaProtegida>
        ),
      })),
      { path: "*", element: <Inicio /> },
    ],
  },
]);
