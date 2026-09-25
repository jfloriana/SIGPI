import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus, TriangleAlert } from "lucide-react";
import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { api } from "../../api/cliente";
import { aQuery, type Paginado } from "../../api/tipos";
import { useUsuario } from "../../auth/AuthContext";
import { Buscador } from "../../components/Buscador";
import { ChipActivo, ChipStock } from "../../components/Chip";
import { Encabezado } from "../../components/Encabezado";
import { Paginacion, Tabla, type Columna } from "../../components/Tabla";
import { BarraFiltros, Tarjeta } from "../../components/Tarjeta";
import { useFiltrosUrl } from "../../hooks/useFiltrosUrl";
import { menuDe } from "../../layout/menu";
import { formatoNumero, formatoSoles } from "../../utils/formato";
import { PanelCategoria, SeccionCategorias } from "./Categorias";
import { PanelProducto } from "./PanelProducto";
import type { Categoria, Producto } from "./tipos";

const PAGE_SIZE = 20;
const CLAVES = ["vista", "buscar", "categoriaId", "alerta", "activo"] as const;
const PESTANAS = [
  { id: "productos", texto: "Productos" },
  { id: "categorias", texto: "Categorías" },
] as const;
type Vista = (typeof PESTANAS)[number]["id"];

export default function ProductosPage() {
  const { rol } = useUsuario();
  const esAdmin = rol === "ADMIN";
  // Solo los roles con Kardex en el menú ven el enlace (misma matriz que la API).
  const veKardex = menuDe(rol).some((o) => o.ruta === "/kardex");

  const { filtros, setFiltro, page, setPage } = useFiltrosUrl(CLAVES);
  const [, setParams] = useSearchParams();
  const vista: Vista = filtros.vista === "categorias" ? "categorias" : "productos";
  const idTabs = useId();
  const refsTabs = useRef<(HTMLButtonElement | null)[]>([]);

  const [panelProducto, setPanelProducto] = useState<{
    abierto: boolean;
    producto: Producto | null;
  }>({ abierto: false, producto: null });
  const [panelCategoria, setPanelCategoria] = useState<{
    abierto: boolean;
    categoria: Categoria | null;
  }>({ abierto: false, categoria: null });

  const categorias = useQuery({
    queryKey: ["categorias", "todas"],
    queryFn: () => api.get<Paginado<Categoria>>("/categorias?pageSize=100"),
  });

  const productos = useQuery({
    queryKey: ["productos", "lista", filtros.buscar, filtros.categoriaId, filtros.alerta, filtros.activo, page],
    queryFn: () =>
      api.get<Paginado<Producto>>(
        `/productos${aQuery({
          page,
          pageSize: PAGE_SIZE,
          buscar: filtros.buscar,
          categoriaId: filtros.categoriaId,
          alerta: filtros.alerta === "true" ? "true" : undefined,
          activo: filtros.activo,
        })}`,
      ),
    placeholderData: keepPreviousData,
    enabled: vista === "productos",
  });

  const enAlerta = useQuery({
    queryKey: ["productos", "alertas-total"],
    queryFn: () => api.get<Paginado<Producto>>("/productos?alerta=true&pageSize=1"),
  });

  const soloAlerta = filtros.alerta === "true";
  const hayFiltros = Boolean(filtros.buscar || filtros.categoriaId || filtros.alerta || filtros.activo);
  const totalAlertas = enAlerta.data?.total ?? 0;

  const alBuscar = useCallback((v: string) => setFiltro("buscar", v), [setFiltro]);

  function limpiarFiltros() {
    setParams(new URLSearchParams(), { replace: true });
  }

  function verProductosDe(c: Categoria) {
    setParams(new URLSearchParams({ categoriaId: String(c.id) }));
  }

  function elegirVista(v: Vista) {
    setFiltro("vista", v === "productos" ? "" : v);
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

  const columnas: Columna<Producto>[] = [
    {
      titulo: "Código",
      celda: (p) => <span className="font-medium whitespace-nowrap text-slate-900 tabular-nums">{p.codigo}</span>,
    },
    {
      titulo: "Nombre",
      celda: (p) => (
        <div className="max-w-[16rem] min-w-[10rem] whitespace-normal md:max-w-xs">
          <span className={p.activo ? "text-slate-900" : "text-slate-500"}>{p.nombre}</span>
          <span className="mt-0.5 block text-xs text-slate-600 md:hidden">
            {p.categoria.nombre} · {p.unidad}
          </span>
        </div>
      ),
    },
    {
      titulo: "Categoría",
      ocultarEnMovil: true,
      celda: (p) => <span className="whitespace-nowrap">{p.categoria.nombre}</span>,
    },
    { titulo: "Unidad", ocultarEnMovil: true, celda: (p) => p.unidad },
    {
      titulo: "Precio",
      alinear: "derecha",
      celda: (p) => <span className="whitespace-nowrap">{formatoSoles(p.precio)}</span>,
    },
    {
      titulo: "Stock",
      alinear: "derecha",
      celda: (p) => <ChipStock stock={p.stock} stockMinimo={p.stockMinimo} />,
    },
    {
      titulo: "Stock mín.",
      alinear: "derecha",
      ocultarEnMovil: true,
      celda: (p) => formatoNumero(p.stockMinimo),
    },
    { titulo: "Estado", celda: (p) => <ChipActivo activo={p.activo} /> },
  ];
  if (veKardex || esAdmin) {
    columnas.push({
      titulo: "Acciones",
      alinear: "derecha",
      celda: (p) => (
        <div className="relative flex justify-end gap-1">
          {veKardex && (
            <Link
              to={`/kardex?productoId=${p.id}`}
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap text-marino hover:bg-marino-50 hover:underline"
            >
              Ver kardex<span className="sr-only"> de {p.codigo}</span>
            </Link>
          )}
          {esAdmin && (
            <button
              type="button"
              onClick={() => setPanelProducto({ abierto: true, producto: p })}
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Editar<span className="sr-only"> {p.codigo}</span>
            </button>
          )}
        </div>
      ),
    });
  }

  const accionEncabezado = !esAdmin ? undefined : vista === "productos" ? (
    <button type="button" onClick={() => setPanelProducto({ abierto: true, producto: null })} className="btn-primario">
      <Plus aria-hidden className="size-4" />
      Nuevo producto
    </button>
  ) : (
    <button type="button" onClick={() => setPanelCategoria({ abierto: true, categoria: null })} className="btn-primario">
      <Plus aria-hidden className="size-4" />
      Nueva categoría
    </button>
  );

  return (
    <>
      <Encabezado
        titulo="Productos y categorías"
        descripcion="Catálogo de DistriNorte con precio y stock. Un producto entra en alerta cuando su stock es menor o igual al stock mínimo."
        acciones={accionEncabezado}
      />

      <div role="tablist" aria-label="Secciones del catálogo" className="mb-4 flex gap-1 border-b border-slate-200">
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
              {t.id === "categorias" && categorias.data && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 tabular-nums">{categorias.data.total}</span>
              )}
            </button>
          );
        })}
      </div>

      {vista === "productos" ? (
        <div role="tabpanel" id={`${idTabs}-panel-productos`} aria-labelledby={`${idTabs}-tab-productos`} className="space-y-4">
          {totalAlertas > 0 && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ambar-100 bg-ambar-50 px-4 py-2 text-sm text-ambar-800"
            >
              <p className="flex items-center gap-2">
                <TriangleAlert aria-hidden className="size-4 shrink-0 text-ambar-800" />
                <span>
                  <strong className="font-semibold tabular-nums">{totalAlertas}</strong>{" "}
                  {totalAlertas === 1 ? "producto activo en alerta" : "productos activos en alerta"} de stock
                  {soloAlerta && <span className="text-ambar-800"> · mostrando solo estos</span>}
                </span>
              </p>
              <button
                type="button"
                onClick={() => setFiltro("alerta", soloAlerta ? "" : "true")}
                className="inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-ambar-800 underline-offset-4 hover:bg-ambar-100 hover:underline"
              >
                {soloAlerta ? "Ver todos los productos" : "Ver solo alertas"}
              </button>
            </div>
          )}

          <Tarjeta sinRelleno>
            <BarraFiltros>
              <Buscador valor={filtros.buscar} alCambiar={alBuscar} etiqueta="Buscar producto" placeholder="Código o nombre" />
              <div className="w-full sm:w-52">
                <label htmlFor={`${idTabs}-cat`} className="campo-etiqueta">
                  Categoría
                </label>
                <select
                  id={`${idTabs}-cat`}
                  value={filtros.categoriaId}
                  onChange={(e) => setFiltro("categoriaId", e.target.value)}
                  className="campo-control"
                >
                  <option value="">Todas</option>
                  {categorias.data?.datos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-[calc(50%-0.375rem)] sm:w-36">
                <label htmlFor={`${idTabs}-est`} className="campo-etiqueta">
                  Estado
                </label>
                <select
                  id={`${idTabs}-est`}
                  value={filtros.activo}
                  onChange={(e) => setFiltro("activo", e.target.value)}
                  className="campo-control"
                >
                  <option value="">Todos</option>
                  <option value="true">Activos</option>
                  <option value="false">Inactivos</option>
                </select>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={soloAlerta}
                onClick={() => setFiltro("alerta", soloAlerta ? "" : "true")}
                className="inline-flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                <span
                  aria-hidden
                  className={`relative inline-block h-6 w-10 shrink-0 rounded-full transition-colors duration-150 ${soloAlerta ? "bg-ambar" : "bg-slate-300"}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-[0_1px_2px_rgb(15_30_51/0.3)] transition-transform duration-150 ${
                      soloAlerta ? "translate-x-4" : ""
                    }`}
                  />
                </span>
                Solo en alerta
              </button>
              {hayFiltros && (
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-marino hover:bg-marino-50"
                >
                  Limpiar filtros
                </button>
              )}
            </BarraFiltros>

            <Tabla
              descripcion="Productos con precio, stock y estado"
              columnas={columnas}
              filas={productos.data?.datos}
              claveFila={(p) => p.id}
              cargando={productos.isFetching}
              error={productos.error}
              reintentar={() => productos.refetch()}
              resaltar={(p) => (p.enAlerta ? "ambar" : undefined)}
              vacio={
                hayFiltros
                  ? {
                      titulo: soloAlerta ? "Ningún producto en alerta con estos filtros" : "Ningún producto coincide con los filtros",
                      descripcion: "Pruebe con otro código, nombre o categoría.",
                      accion: (
                        <button type="button" onClick={limpiarFiltros} className="btn-secundario">
                          Limpiar filtros
                        </button>
                      ),
                    }
                  : {
                      titulo: "Aún no hay productos",
                      descripcion: esAdmin ? "Registre el primer producto del catálogo." : "El administrador aún no registró productos.",
                    }
              }
            />
            {productos.data && <Paginacion page={page} pageSize={PAGE_SIZE} total={productos.data.total} alCambiar={setPage} />}
          </Tarjeta>
        </div>
      ) : (
        <div role="tabpanel" id={`${idTabs}-panel-categorias`} aria-labelledby={`${idTabs}-tab-categorias`}>
          <SeccionCategorias
            categorias={categorias.data?.datos}
            cargando={categorias.isFetching}
            error={categorias.error}
            reintentar={() => categorias.refetch()}
            esAdmin={esAdmin}
            alVerProductos={verProductosDe}
            alNueva={() => setPanelCategoria({ abierto: true, categoria: null })}
            alRenombrar={(c) => setPanelCategoria({ abierto: true, categoria: c })}
          />
        </div>
      )}

      {esAdmin && (
        <>
          {/* Se montan solo abiertos: la variante "panel" de Dialogo queda visible en el flujo cuando está cerrada. */}
          {panelProducto.abierto && (
            <PanelProducto
              abierto
              producto={panelProducto.producto}
              categorias={categorias.data?.datos ?? []}
              alCerrar={() => setPanelProducto((p) => ({ ...p, abierto: false }))}
            />
          )}
          {panelCategoria.abierto && (
            <PanelCategoria
              abierto
              categoria={panelCategoria.categoria}
              alCerrar={() => setPanelCategoria((c) => ({ ...c, abierto: false }))}
            />
          )}
        </>
      )}
    </>
  );
}
