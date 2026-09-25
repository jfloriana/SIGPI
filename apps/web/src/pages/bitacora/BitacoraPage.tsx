import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ExternalLink, History, Lock, PanelRightOpen, X } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";
import { api } from "../../api/cliente";
import { aQuery, type Paginado } from "../../api/tipos";
import { Buscador } from "../../components/Buscador";
import { Chip } from "../../components/Chip";
import { Encabezado } from "../../components/Encabezado";
import { Paginacion, Tabla, type Columna } from "../../components/Tabla";
import { BarraFiltros, Tarjeta } from "../../components/Tarjeta";
import { useFiltrosUrl } from "../../hooks/useFiltrosUrl";
import { formatoFechaHora } from "../../utils/formato";
import { resumen } from "./detalle";
import { PanelRegistro } from "./PanelRegistro";
import { infoAccion, nombreEntidad, rutaEntidad, type FiltrosBitacora, type RegistroBitacora } from "./tipos";

const PAGE_SIZE = 20;
const CLAVES = ["usuarioId", "entidad", "entidadId", "accion", "desde", "hasta"] as const;

interface UsuarioCombo {
  id: number;
  nombre: string;
}

function Sistema() {
  return <span className="text-slate-600 italic">Sistema</span>;
}

export default function BitacoraPage() {
  const { filtros, setFiltro, setFiltros, limpiar, page, setPage } = useFiltrosUrl(CLAVES);
  const [abierto, setAbierto] = useState<RegistroBitacora | null>(null);
  const ids = { usuario: useId(), entidad: useId(), accion: useId(), desde: useId(), hasta: useId() };

  const rangoInvalido = Boolean(filtros.desde && filtros.hasta && filtros.hasta < filtros.desde);

  const opciones = useQuery({
    queryKey: ["bitacora", "filtros"],
    queryFn: () => api.get<FiltrosBitacora>("/bitacora/filtros"),
    staleTime: 60_000,
  });

  const usuarios = useQuery({
    queryKey: ["usuarios", "combo"],
    queryFn: () => api.get<Paginado<UsuarioCombo>>("/usuarios?pageSize=100"),
    staleTime: 60_000,
  });

  const consulta = useQuery({
    queryKey: ["bitacora", filtros, page],
    queryFn: () => api.get<Paginado<RegistroBitacora>>(`/bitacora${aQuery({ ...filtros, entidadId: filtros.entidadId.trim(), page, pageSize: PAGE_SIZE })}`),
    placeholderData: keepPreviousData,
    enabled: !rangoInvalido,
  });

  const hayFiltros = CLAVES.some((k) => filtros[k]);
  const enHistoria = Boolean(filtros.entidad && filtros.entidadId);
  const rutaHistoria = enHistoria ? rutaEntidad(filtros.entidad, filtros.entidadId) : null;

  function verHistoria(r: RegistroBitacora) {
    setAbierto(null);
    setFiltros({ entidad: r.entidad, entidadId: r.entidadId ?? "", usuarioId: "", accion: "", desde: "", hasta: "" });
  }

  const columnas: Columna<RegistroBitacora>[] = [
    {
      titulo: "Fecha y hora",
      celda: (r) => (
        <>
          <time dateTime={r.fecha} className="whitespace-nowrap text-slate-900 tabular-nums">
            {formatoFechaHora(r.fecha)}
          </time>
          <span className="block text-xs text-slate-600 md:hidden">{r.usuario ? r.usuario.nombre : "Sistema"}</span>
        </>
      ),
    },
    {
      titulo: "Usuario",
      celda: (r) => (r.usuario ? <span className="text-slate-800">{r.usuario.nombre}</span> : <Sistema />),
      ocultarEnMovil: true,
    },
    {
      titulo: "Acción",
      celda: (r) => {
        const a = infoAccion(r.accion);
        return <Chip tono={a.tono}>{a.texto}</Chip>;
      },
    },
    {
      titulo: "Registro",
      celda: (r) => {
        const ruta = rutaEntidad(r.entidad, r.entidadId);
        const texto = (
          <>
            {nombreEntidad(r.entidad)}
            {r.entidadId && <span className="tabular-nums"> #{r.entidadId}</span>}
          </>
        );
        return (
          <>
            {ruta ? (
              <Link
                to={ruta}
                onClick={(e) => e.stopPropagation()}
                className="font-medium whitespace-nowrap text-marino underline decoration-marino-200 hover:decoration-marino"
              >
                {texto}
              </Link>
            ) : (
              <span className="whitespace-nowrap text-slate-800">{texto}</span>
            )}
            <span className="block max-w-[15rem] truncate text-xs text-slate-600 md:hidden">{resumen(r)}</span>
          </>
        );
      },
    },
    {
      titulo: "Cambio",
      celda: (r) => {
        const t = resumen(r);
        return (
          <span title={t} className="block max-w-[26rem] truncate text-slate-700">
            {t}
          </span>
        );
      },
      ocultarEnMovil: true,
    },
    {
      titulo: "Detalle",
      alinear: "derecha",
      celda: (r) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setAbierto(r);
          }}
          className="btn-secundario px-3"
          aria-label={`Ver antes y después del registro ${r.id}`}
        >
          <PanelRightOpen aria-hidden className="size-4" />
          <span className="hidden sm:inline">Ver</span>
        </button>
      ),
    },
  ];

  return (
    <>
      <Encabezado
        titulo="Bitácora"
        descripcion="Quién hizo qué y cuándo, con los datos antes y después de cada operación. El servidor la escribe dentro de la misma transacción que la operación; nadie puede editarla ni borrarla, tampoco el administrador (regla 17)."
        acciones={
          <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">
            <Lock aria-hidden className="size-4 text-marino-500" />
            Solo lectura
          </span>
        }
      />

      <Tarjeta sinRelleno>
        <BarraFiltros>
          <div className="w-full sm:w-52">
            <label htmlFor={ids.usuario} className="campo-etiqueta">
              Usuario
            </label>
            <select id={ids.usuario} value={filtros.usuarioId} onChange={(e) => setFiltro("usuarioId", e.target.value)} className="campo-control">
              <option value="">Todos</option>
              {usuarios.data?.datos.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="w-[calc(50%-0.375rem)] sm:w-44">
            <label htmlFor={ids.entidad} className="campo-etiqueta">
              Entidad
            </label>
            <select id={ids.entidad} value={filtros.entidad} onChange={(e) => setFiltro("entidad", e.target.value)} className="campo-control">
              <option value="">Todas</option>
              {opciones.data?.entidades.map((en) => (
                <option key={en} value={en}>
                  {nombreEntidad(en)}
                </option>
              ))}
            </select>
          </div>
          <div className="w-[calc(50%-0.375rem)] sm:w-44">
            <label htmlFor={ids.accion} className="campo-etiqueta">
              Acción
            </label>
            <select id={ids.accion} value={filtros.accion} onChange={(e) => setFiltro("accion", e.target.value)} className="campo-control">
              <option value="">Todas</option>
              {opciones.data?.acciones.map((a) => (
                <option key={a} value={a}>
                  {infoAccion(a).texto}
                </option>
              ))}
            </select>
          </div>
          <Buscador
            valor={filtros.entidadId}
            alCambiar={(v) => setFiltro("entidadId", v)}
            etiqueta="N.º de registro"
            placeholder="Id, p. ej. 8"
          />
          <div className="w-[calc(50%-0.375rem)] sm:w-40">
            <label htmlFor={ids.desde} className="campo-etiqueta">
              Desde
            </label>
            <input id={ids.desde} type="date" value={filtros.desde} onChange={(e) => setFiltro("desde", e.target.value)} className="campo-control" />
          </div>
          <div className="w-[calc(50%-0.375rem)] sm:w-40">
            <label htmlFor={ids.hasta} className="campo-etiqueta">
              Hasta
            </label>
            <input
              id={ids.hasta}
              type="date"
              value={filtros.hasta}
              min={filtros.desde || undefined}
              onChange={(e) => setFiltro("hasta", e.target.value)}
              aria-invalid={rangoInvalido || undefined}
              aria-describedby={rangoInvalido ? `${ids.hasta}-error` : undefined}
              className="campo-control"
            />
          </div>
          {hayFiltros && (
            <button type="button" onClick={limpiar} className="btn-secundario">
              <X aria-hidden className="size-4" />
              Quitar filtros
            </button>
          )}
          {rangoInvalido && (
            <p id={`${ids.hasta}-error`} className="campo-error w-full">
              La fecha «Hasta» no puede ser anterior a «Desde».
            </p>
          )}
        </BarraFiltros>

        {enHistoria && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-marino-100 bg-marino-50 px-4 py-3 text-sm text-marino-800 sm:px-5">
            <History aria-hidden className="size-4 shrink-0" />
            <p className="min-w-0 flex-1">
              <span className="font-semibold">
                Historia completa de {nombreEntidad(filtros.entidad).toLowerCase()} #{filtros.entidadId}
              </span>
              {consulta.data && !consulta.isPlaceholderData && (
                <>
                  {" "}
                  · {consulta.data.total} {consulta.data.total === 1 ? "registro" : "registros"}, del más reciente al más antiguo
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {rutaHistoria && (
                <Link to={rutaHistoria} className="btn-secundario">
                  <ExternalLink aria-hidden className="size-4" />
                  Abrir el {nombreEntidad(filtros.entidad).toLowerCase()}
                </Link>
              )}
              <button type="button" onClick={() => setFiltros({ entidad: "", entidadId: "" })} className="btn-secundario">
                <X aria-hidden className="size-4" />
                Salir de la historia
              </button>
            </div>
          </div>
        )}

        <Tabla
          columnas={columnas}
          filas={rangoInvalido ? [] : consulta.data?.datos}
          claveFila={(r) => r.id}
          descripcion="Registros de la bitácora, del más reciente al más antiguo"
          cargando={consulta.isFetching}
          error={consulta.error}
          reintentar={() => consulta.refetch()}
          alSeleccionar={(r) => setAbierto(r)}
          vacio={
            rangoInvalido
              ? { titulo: "Revise el rango de fechas", descripcion: "La fecha final debe ser igual o posterior a la inicial." }
              : hayFiltros
                ? {
                    titulo: "Ningún registro coincide con los filtros",
                    descripcion: "Quite algún filtro o amplíe el rango de fechas. El n.º de registro debe coincidir exactamente.",
                    accion: (
                      <button type="button" onClick={limpiar} className="btn-secundario">
                        Quitar filtros
                      </button>
                    ),
                  }
                : { titulo: "La bitácora aún no tiene registros", descripcion: "Cada inicio de sesión y cada operación crítica agregará un registro aquí." }
          }
        />
        {consulta.data && !rangoInvalido && (
          <Paginacion page={consulta.data.page} pageSize={consulta.data.pageSize} total={consulta.data.total} alCambiar={setPage} />
        )}
      </Tarjeta>

      {/* Montado solo mientras está abierto (la variante "panel" de Dialogo fija `flex`). */}
      {abierto && (
        <PanelRegistro
          registro={abierto}
          alCerrar={() => setAbierto(null)}
          alVerHistoria={verHistoria}
          enHistoria={enHistoria && filtros.entidad === abierto.entidad && filtros.entidadId === abierto.entidadId}
        />
      )}
    </>
  );
}
