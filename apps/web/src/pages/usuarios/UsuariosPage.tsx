import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Pencil, UserPlus } from "lucide-react";
import { useId, useState } from "react";
import { api } from "../../api/cliente";
import { aQuery, type Paginado } from "../../api/tipos";
import { useUsuario } from "../../auth/AuthContext";
import { NOMBRE_ROL, type Rol } from "../../auth/roles";
import { Buscador } from "../../components/Buscador";
import { Chip, ChipActivo, type TonoChip } from "../../components/Chip";
import { Encabezado } from "../../components/Encabezado";
import { Paginacion, Tabla, type Columna } from "../../components/Tabla";
import { BarraFiltros, Tarjeta } from "../../components/Tarjeta";
import { useFiltrosUrl } from "../../hooks/useFiltrosUrl";
import { formatoFecha } from "../../utils/formato";
import { ChipBloqueado, PanelEditarUsuario, PanelNuevoUsuario } from "./PanelesUsuario";
import { ROLES } from "./SelectorRol";
import { iniciales, type UsuarioApi } from "./tipos";

const PAGE_SIZE = 20;

const TONO_ROL: Record<Rol, TonoChip> = {
  ADMIN: "marino",
  GERENTE: "marino",
  VENDEDOR: "neutro",
  ALMACENERO: "neutro",
};

export default function UsuariosPage() {
  const yo = useUsuario();
  const esAdmin = yo.rol === "ADMIN";
  const { filtros, setFiltro, page, setPage } = useFiltrosUrl(["buscar", "rol", "activo"] as const);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [editando, setEditando] = useState<UsuarioApi | null>(null);
  const idRol = useId();
  const idEstado = useId();

  const consulta = useQuery({
    queryKey: ["usuarios", filtros, page],
    queryFn: () =>
      api.get<Paginado<UsuarioApi>>(
        `/usuarios${aQuery({ buscar: filtros.buscar.trim(), rol: filtros.rol, activo: filtros.activo, page, pageSize: PAGE_SIZE })}`,
      ),
    placeholderData: keepPreviousData,
  });

  const hayFiltros = Boolean(filtros.buscar || filtros.rol || filtros.activo);

  const columnas: Columna<UsuarioApi>[] = [
    {
      titulo: "Nombre",
      celda: (u) => (
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full bg-marino-50 text-xs font-semibold text-marino ring-1 ring-marino-100 ring-inset"
          >
            {iniciales(u.nombre)}
          </span>
          <span className="min-w-0">
            <span className="block font-medium text-slate-900">
              {u.nombre}
              {u.id === yo.id && <span className="ml-1.5 text-xs font-normal text-slate-600">(usted)</span>}
            </span>
            <span className="block text-xs text-slate-600 md:hidden">{u.email}</span>
          </span>
        </div>
      ),
    },
    {
      titulo: "Correo",
      celda: (u) => <span className="text-slate-700">{u.email}</span>,
      ocultarEnMovil: true,
    },
    {
      titulo: "Rol",
      celda: (u) => <Chip tono={TONO_ROL[u.rol]}>{NOMBRE_ROL[u.rol] ?? u.rol}</Chip>,
    },
    {
      titulo: "Estado",
      celda: (u) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <ChipActivo activo={u.activo} />
          {u.bloqueado && u.bloqueadoHasta && <ChipBloqueado hasta={u.bloqueadoHasta} />}
        </div>
      ),
    },
    {
      titulo: "Creado",
      celda: (u) => <span className="text-slate-700 tabular-nums">{formatoFecha(u.creadoEn)}</span>,
      ocultarEnMovil: true,
    },
  ];

  if (esAdmin) {
    columnas.push({
      titulo: "Acciones",
      alinear: "derecha",
      fijaEnMovil: true,
      celda: (u) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEditando(u);
          }}
          className="btn-secundario px-3"
          aria-label={`Editar a ${u.nombre}`}
        >
          <Pencil aria-hidden className="size-4" />
          <span className="hidden sm:inline">Editar</span>
        </button>
      ),
    });
  }

  return (
    <>
      <Encabezado
        titulo="Usuarios"
        descripcion={
          esAdmin
            ? "Cuentas y roles del personal. El administrador gestiona los accesos, pero no aprueba pedidos ni órdenes de compra: eso le corresponde al gerente (segregación de funciones)."
            : "Cuentas y roles del personal (solo consulta). El administrador gestiona los accesos, pero no aprueba operaciones: segregación de funciones."
        }
        acciones={
          esAdmin && (
            <button type="button" onClick={() => setNuevoAbierto(true)} className="btn-primario">
              <UserPlus aria-hidden className="size-4" />
              Nuevo usuario
            </button>
          )
        }
      />

      <Tarjeta sinRelleno>
        <BarraFiltros>
          <Buscador valor={filtros.buscar} alCambiar={(v) => setFiltro("buscar", v)} etiqueta="Buscar" placeholder="Nombre o correo" />
          <div className="w-full sm:w-44">
            <label htmlFor={idRol} className="campo-etiqueta">
              Rol
            </label>
            <select id={idRol} value={filtros.rol} onChange={(e) => setFiltro("rol", e.target.value)} className="campo-control">
              <option value="">Todos</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {NOMBRE_ROL[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-40">
            <label htmlFor={idEstado} className="campo-etiqueta">
              Estado
            </label>
            <select id={idEstado} value={filtros.activo} onChange={(e) => setFiltro("activo", e.target.value)} className="campo-control">
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </div>
        </BarraFiltros>

        <Tabla
          columnas={columnas}
          filas={consulta.data?.datos}
          claveFila={(u) => u.id}
          descripcion="Usuarios del sistema"
          cargando={consulta.isFetching}
          error={consulta.error}
          reintentar={() => consulta.refetch()}
          alSeleccionar={esAdmin ? (u) => setEditando(u) : undefined}
          resaltar={(u) => (u.bloqueado ? "ambar" : undefined)}
          vacio={
            hayFiltros
              ? {
                  titulo: "Ningún usuario coincide con los filtros",
                  descripcion: "Pruebe con otro nombre o correo, o quite el filtro de rol o estado.",
                }
              : {
                  titulo: "Aún no hay usuarios",
                  descripcion: esAdmin ? "Cree la primera cuenta con «Nuevo usuario»." : undefined,
                }
          }
        />
        {consulta.data && (
          <Paginacion page={consulta.data.page} pageSize={consulta.data.pageSize} total={consulta.data.total} alCambiar={setPage} />
        )}
      </Tarjeta>

      {/* Se montan solo mientras están abiertos: la variante "panel" de Dialogo lleva `flex` fijo,
          que anula el `display: none` del <dialog> cerrado. */}
      {esAdmin && nuevoAbierto && <PanelNuevoUsuario abierto alCerrar={() => setNuevoAbierto(false)} />}
      {esAdmin && editando && (
        <>
          <PanelEditarUsuario
            usuario={editando}
            esUnoMismo={editando?.id === yo.id}
            alCerrar={() => setEditando(null)}
            alActualizar={(u) => setEditando((actual) => (actual && actual.id === u.id ? u : actual))}
          />
        </>
      )}
    </>
  );
}
