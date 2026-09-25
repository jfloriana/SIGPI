import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useCallback, useId, useState } from "react";
import { useSearchParams } from "react-router";
import { api } from "../../api/cliente";
import { aQuery, type Paginado } from "../../api/tipos";
import { useUsuario } from "../../auth/AuthContext";
import { Buscador } from "../../components/Buscador";
import { ChipActivo } from "../../components/Chip";
import { Encabezado } from "../../components/Encabezado";
import { Paginacion, Tabla, type Columna } from "../../components/Tabla";
import { BarraFiltros, Tarjeta } from "../../components/Tarjeta";
import { useFiltrosUrl } from "../../hooks/useFiltrosUrl";
import { PanelCliente, type ModoPanel } from "./PanelCliente";
import { esZona, ZONAS, type Cliente } from "./tipos";

const PAGE_SIZE = 20;

export default function ClientesPage() {
  const { rol } = useUsuario();
  const puedeEditar = rol === "ADMIN" || rol === "VENDEDOR";
  const puedeCambiarEstado = rol === "ADMIN";

  const { filtros, setFiltro, page, setPage } = useFiltrosUrl(["buscar", "zona", "activo"] as const);
  // Solo se envían a la API valores válidos del catálogo (la URL puede editarse a mano).
  const zona = esZona(filtros.zona) ? filtros.zona : "";
  const activo = filtros.activo === "true" || filtros.activo === "false" ? filtros.activo : "";
  const buscar = filtros.buscar.trim();
  const hayFiltros = !!(buscar || zona || activo);

  const [panel, setPanel] = useState<ModoPanel | null>(null);
  const idZona = useId();
  const idEstado = useId();

  const consulta = useQuery({
    queryKey: ["clientes", { buscar, zona, activo }, page],
    queryFn: () => api.get<Paginado<Cliente>>(`/clientes${aQuery({ page, pageSize: PAGE_SIZE, buscar, zona, activo })}`),
    placeholderData: keepPreviousData,
  });

  const cambiarBuscar = useCallback((v: string) => setFiltro("buscar", v), [setFiltro]);

  // Un solo cambio de URL (tres setFiltro seguidos se pisarían entre sí).
  const [, setParams] = useSearchParams();
  const limpiarFiltros = () => setParams({}, { replace: true });

  const abrir = (c: Cliente) => setPanel(puedeEditar ? { modo: "editar", cliente: c } : { modo: "ver", cliente: c });

  const columnas: Columna<Cliente>[] = [
    {
      titulo: "Documento",
      celda: (c) => (
        <span className="whitespace-nowrap">
          <span className="mr-1.5 text-xs font-semibold text-slate-500">{c.tipoDoc}</span>
          <span className="tabular-nums text-slate-900">{c.numDoc}</span>
        </span>
      ),
    },
    {
      titulo: "Razón social",
      celda: (c) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            abrir(c);
          }}
          className="-mx-1 -my-2.5 min-h-11 rounded px-1 text-left font-medium text-marino hover:underline focus-visible:outline-2 focus-visible:outline-marino-500"
          aria-label={`${puedeEditar ? "Editar" : "Ver"} ${c.razonSocial}`}
        >
          {c.razonSocial}
        </button>
      ),
    },
    { titulo: "Zona", celda: (c) => <span className="whitespace-nowrap">{c.zona}</span> },
    {
      titulo: "Teléfono",
      ocultarEnMovil: true,
      celda: (c) => (c.telefono ? <span className="whitespace-nowrap tabular-nums">{c.telefono}</span> : <span className="text-slate-500">—</span>),
    },
    { titulo: "Dirección", ocultarEnMovil: true, celda: (c) => <span className="text-slate-700">{c.direccion}</span> },
    { titulo: "Estado", celda: (c) => <ChipActivo activo={c.activo} /> },
  ];

  const vacio = hayFiltros
    ? {
        titulo: buscar ? `No hay clientes que coincidan con “${buscar}”` : "No hay clientes con estos filtros",
        descripcion: buscar
          ? "Busque por razón social, nombre o número de documento (RUC o DNI), o quite los filtros de zona y estado."
          : "Pruebe con otra zona o estado.",
        accion: (
          <button type="button" onClick={limpiarFiltros} className="btn-secundario">
            Limpiar filtros
          </button>
        ),
      }
    : {
        titulo: "Aún no hay clientes registrados",
        descripcion: puedeEditar ? "Registre el primero para poder tomarle pedidos." : undefined,
        accion: puedeEditar ? (
          <button type="button" onClick={() => setPanel({ modo: "crear" })} className="btn-primario">
            <Plus aria-hidden className="size-4" />
            Registrar cliente
          </button>
        ) : undefined,
      };

  return (
    <>
      <Encabezado
        titulo="Clientes"
        descripcion="Bodegas y minimercados a los que vende DistriNorte. Solo los clientes activos aparecen al registrar un pedido."
        acciones={
          puedeEditar && (
            <button type="button" onClick={() => setPanel({ modo: "crear" })} className="btn-primario">
              <Plus aria-hidden className="size-4" />
              Nuevo cliente
            </button>
          )
        }
      />

      <Tarjeta sinRelleno>
        <BarraFiltros>
          <Buscador
            valor={filtros.buscar}
            alCambiar={cambiarBuscar}
            etiqueta="Buscar cliente"
            placeholder="Razón social o N.° de documento"
            className="basis-full sm:basis-auto"
          />
          <div className="min-w-0 flex-1 sm:w-44 sm:flex-none">
            <label htmlFor={idZona} className="campo-etiqueta">
              Zona
            </label>
            <select id={idZona} value={zona} onChange={(e) => setFiltro("zona", e.target.value)} className="campo-control">
              <option value="">Todas las zonas</option>
              {ZONAS.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
            <label htmlFor={idEstado} className="campo-etiqueta">
              Estado
            </label>
            <select id={idEstado} value={activo} onChange={(e) => setFiltro("activo", e.target.value)} className="campo-control">
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </div>
        </BarraFiltros>

        <Tabla
          columnas={columnas}
          filas={consulta.data?.datos}
          claveFila={(c) => c.id}
          descripcion="Lista de clientes"
          cargando={consulta.isFetching}
          error={consulta.error}
          reintentar={() => consulta.refetch()}
          vacio={vacio}
          alSeleccionar={abrir}
        />

        {consulta.data && (
          <Paginacion page={consulta.data.page} pageSize={consulta.data.pageSize} total={consulta.data.total} alCambiar={setPage} />
        )}
      </Tarjeta>

      {/* Se monta solo abierto: la variante "panel" de <Dialogo> lleva `flex` fijo y, cerrada, seguiría visible al pie de la página. */}
      {panel && <PanelCliente panel={panel} alCerrar={() => setPanel(null)} puedeCambiarEstado={puedeCambiarEstado} />}
    </>
  );
}
