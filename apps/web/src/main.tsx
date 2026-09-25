import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { ApiError } from "./api/cliente";
import { AuthProvider } from "./auth/AuthContext";
import { NotificacionesProvider } from "./components/Notificaciones";
import "./index.css";
import { router } from "./router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // No reintentar errores de negocio (4xx): solo fallas de red o del servidor.
      retry: (intentos, error) => intentos < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificacionesProvider>
          <RouterProvider router={router} />
        </NotificacionesProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
