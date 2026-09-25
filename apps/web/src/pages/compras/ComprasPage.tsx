import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Plus, Sparkles } from "lucide-react";
import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router";
import { api } from "../../api/cliente";
import type { Paginado } from "../../api/tipos";
import { useUsuario } from "../../auth/AuthContext";
import { Encabezado } from "../../components/Encabezado";
import { useFiltrosUrl } from "../../hooks/useFiltrosUrl";
import { menuDe } from "../../layout/menu";
import { FormularioOrden } from "./FormularioOrden";
import { SeccionOrdenes } from "./Ordenes";
import { PanelOrden } from "./PanelOrden";
import { PanelProveedor, SeccionProveedores } from "./Proveedores";
import type { Proveedor } from "./tipos";

const CLAVES = ["vista", "estado", "proveedorId", "desde", "hasta", "buscar"] as const;
const PESTANAS = [
  { id: "ordenes", texto: "Órdenes de compra" },
  { id: "proveedores", texto: "Proveedores" },
] as const;
type Vista = (typeof PESTANAS)[number]["id"];

export default function ComprasPage() {
  const { rol } = useUsuario();
  const puedeCrearOrden = rol === "ADMIN" || rol === "GERENTE";
  const puedeCrearProveedor = rol === "ADMIN" || rol === "GERENTE";
  const puedeEditarProveedor = rol === "ADMIN";
  const esAlmacenero = rol === "ALMACENERO";
  const veKardex = menuDe(rol).some((o) => o.ruta === "/kardex");

  const { filtros, setFiltro, setFiltros, page, setPage } = useFiltrosUrl(CLAVES);
  const [params, setParams] = useSearchParams();
  const vista: Vista = filtros.vista === "proveedores" ? "proveedores" : "ordenes";
  const idTabs = useId();
  const refsTabs = useRef<(HTMLButtonElement | null)[]>([]);
  const [panelProveedor, setPanelProveedor] = useState<{ abierto: boolean; proveedor: Proveedor | null }>({
    abierto: false,
    proveedor: null,
  });

  // Detalle y formulario viven en la URL: ?oc=<id>, ?nueva=1, ?sugerida=1&productos=1,2
  const ocId = Number(params.get("oc")) || null;
  const abrirSugerida = puedeCrearOrden && params.get("sugerida") === "1";
  const abrirNueva = puedeCrearOrden && !abrirSugerida && params.get("nueva") === "1";
  const textoProductos = params.get("productos") ?? "";
  const productoIds = useMemo(
    () =>
      textoProductos
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isInteger(n) && n > 0),
    [textoProductos],
  );

  const proveedores = useQuery({
    queryKey: ["proveedores", "todos"],
    queryFn: () => api.get<Paginado<Proveedor>>("/proveedores?pageSize=100"),
  });

  /** Cambia parámetros de la URL partiendo de la URL actual (quita los vacíos). */
  const cambiarUrl = useCallback(
    (cambios: Record<string, string | null>, reemplazar = false) => {
      const n = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(cambios)) {
        if (v) n.set(k, v);
        else n.delete(k);
      }
      setParams(n, { replace: reemplazar });
    },
    [setParams],
  );

  const abrirOrden = useCallback((id: number) => cambiarUrl({ oc: String(id) }), [cambiarUrl]);
  const cerrarFormulario = () => cambiarUrl({ nueva: null, sugerida: null, productos: null }, true);

  function elegirVista(v: Vista) {
    setFiltro("vista", v === "ordenes" ? "" : v);
  }

  function teclaTabs(e: KeyboardEvent, i: number) {
    let destino = -1;
    if (e.key === "ArrowRight") destino = (i + 1) % PESTANAS.length;
    else if (e.key === "ArrowLeft") destino = (i - 1 + PESTANAS.length) % PESTANAS.length;
    else if (e.key === "Home") destino = 0;
    else if (e.key === "End") destino = PESTANAS.length - 1;
    if (destino < 0) return;
    e.preventDefault();
    elegirVista(PESTANAS[destino].id);
    refsTabs.current[destino]?.focus();
  }

  const alBuscarProveedor = useCallback((v: string) => setFiltro("buscar", v), [setFiltro]);

  const acciones =
    vista === "ordenes" ? (
      puedeCrearOrden ? (
        <>
          <button type="button" onClick={() => cambiarUrl({ sugerida: "1", nueva: null, productos: null })} className="btn-secundario">
            <Sparkles aria-hidden className="size-4" />
            Generar orden sugerida
          </button>
          <button type="button" onClick={() => cambiarUrl({ nueva: "1", sugerida: null, productos: null })} className="btn-primario">
            <Plus aria-hidden className="size-4" />
            Nueva orden
          </button>
        </>
      ) : undefined
    ) : puedeCrearProveedor ? (
      <button type="button" onClick={() => setPanelProveedor({ abierto: true, proveedor: null })} className="btn-primario">
        <Plus aria-hidden className="size-4" />
        Nuevo proveedor
      </button>
    ) : undefined;

  return (
    <>
      <Encabezado
        titulo="Proveedores y compras"
        descripcion={
          esAlmacenero
            ? "Órdenes de compra aprobadas por el gerente. Al recepcionarlas, el stock sube y queda una ENTRADA en el kardex."
            : "Órdenes de compra a proveedores: se crean pendientes, el gerente las aprueba y el almacén las recepciona."
        }
        acciones={acciones}
      />

      <div role="tablist" aria-label="Secciones de compras" className="mb-4 flex gap-1 border-b border-slate-200">
        {PESTANAS.map((t, i) => {
          const activa = vista === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refsTabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${idTabs}-tab-${t.id}`}
              aria-selected={activa}
              aria-controls={`${idTabs}-panel-${t.id}`}
              tabIndex={activa ? 0 : -1}
              onClick={() => elegirVista(t.id)}
              onKeyDown={(e) => teclaTabs(e, i)}
              className={`-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors duration-150 ${
                activa ? "border-marino text-marino-800" : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {t.texto}
              {t.id === "proveedores" && proveedores.data && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 tabular-nums">{proveedores.data.total}</span>
              )}
            </button>
          );
        })}
      </div>

      {vista === "ordenes" ? (
        <div role="tabpanel" id={`${idTabs}-panel-ordenes`} aria-labelledby={`${idTabs}-tab-ordenes`}>
          {esAlmacenero && (
            <p className="mb-3 flex items-center gap-2 text-sm text-slate-600">
              <ClipboardList aria-hidden className="size-4 shrink-0" />
              Solo se muestran órdenes aprobadas y recibidas.
            </p>
          )}
          <SeccionOrdenes
            filtros={{ estado: filtros.estado, proveedorId: filtros.proveedorId, desde: filtros.desde, hasta: filtros.hasta }}
            page={page}
            alFiltrar={(c) => setFiltros(c)}
            alLimpiar={() => setFiltros({ estado: "", proveedorId: "", desde: "", hasta: "" })}
            alPaginar={setPage}
            alAbrir={abrirOrden}
            proveedores={proveedores.data?.datos}
            esAlmacenero={esAlmacenero}
            puedeCrear={puedeCrearOrden}
            alNueva={() => cambiarUrl({ nueva: "1" })}
          />
        </div>
      ) : (
        <div role="tabpanel" id={`${idTabs}-panel-proveedores`} aria-labelledby={`${idTabs}-tab-proveedores`}>
          <SeccionProveedores
            buscar={filtros.buscar}
            page={page}
            alBuscar={alBuscarProveedor}
            alPaginar={setPage}
            puedeCrear={puedeCrearProveedor}
            puedeEditar={puedeEditarProveedor}
            alNuevo={() => setPanelProveedor({ abierto: true, proveedor: null })}
            alEditar={(p) => setPanelProveedor({ abierto: true, proveedor: p })}
            alVerOrdenes={(p) => setFiltros({ vista: "", buscar: "", estado: "", desde: "", hasta: "", proveedorId: String(p.id) })}
          />
        </div>
      )}

      {/* Se montan solo abiertos para que cada apertura empiece con el estado limpio. */}
      {ocId && <PanelOrden key={ocId} id={ocId} veKardex={veKardex} alCerrar={() => cambiarUrl({ oc: null }, true)} />}
      {(abrirSugerida || abrirNueva) && (
        <FormularioOrden
          key={abrirSugerida ? `s-${textoProductos}` : "n"}
          sugerida={abrirSugerida}
          productoIds={productoIds}
          proveedores={proveedores.data?.datos}
          alCerrar={cerrarFormulario}
          alCreada={(o) => cambiarUrl({ nueva: null, sugerida: null, productos: null, oc: String(o.id) }, true)}
        />
      )}
      {panelProveedor.abierto && (
        <PanelProveedor
          proveedor={panelProveedor.proveedor}
          alCerrar={() => setPanelProveedor((p) => ({ ...p, abierto: false }))}
        />
      )}
    </>
  );
}
