import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Plus } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/cliente";
import { Campo } from "../../components/Campo";
import { Dialogo } from "../../components/Dialogo";
import { Aviso } from "../../components/Estados";
import { useNotificar } from "../../components/Notificaciones";
import { Tabla, type Columna } from "../../components/Tabla";
import { Tarjeta } from "../../components/Tarjeta";
import { formatoNumero } from "../../utils/formato";
import { validarCategoria, type Categoria } from "./tipos";

export function SeccionCategorias({
  categorias,
  cargando,
  error,
  reintentar,
  esAdmin,
  alVerProductos,
  alNueva,
  alRenombrar,
}: {
  categorias: Categoria[] | undefined;
  cargando: boolean;
  error: unknown;
  reintentar: () => void;
  esAdmin: boolean;
  alVerProductos: (c: Categoria) => void;
  alNueva: () => void;
  alRenombrar: (c: Categoria) => void;
}) {
  const columnas: Columna<Categoria>[] = [
    {
      titulo: "Categoría",
      celda: (c) => <span className="font-medium text-slate-900">{c.nombre}</span>,
    },
    {
      titulo: "Productos",
      alinear: "derecha",
      celda: (c) => formatoNumero(c.numProductos),
    },
    {
      titulo: "Acciones",
      alinear: "derecha",
      celda: (c) => (
        <div className="relative flex justify-end gap-1">
          <button
            type="button"
            onClick={() => alVerProductos(c)}
            disabled={c.numProductos === 0}
            className="btn-fantasma disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline disabled:hover:bg-transparent"
          >
            Ver productos<span className="sr-only"> de {c.nombre}</span>
          </button>
          {esAdmin && (
            <button
              type="button"
              onClick={() => alRenombrar(c)}
              className="btn-fantasma-neutro"
            >
              Renombrar<span className="sr-only"> {c.nombre}</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Tarjeta sinRelleno titulo="Categorías" descripcion="El conteo incluye productos activos e inactivos.">
      <Tabla
        descripcion="Categorías de productos con su número de productos"
        columnas={columnas}
        filas={categorias}
        claveFila={(c) => c.id}
        cargando={cargando}
        error={error}
        reintentar={reintentar}
        vacio={{
          titulo: "Aún no hay categorías",
          descripcion: esAdmin
            ? "Cree la primera categoría para poder registrar productos."
            : "El administrador aún no registró categorías.",
          accion: esAdmin ? (
            <button type="button" onClick={alNueva} className="btn-primario">
              <Plus aria-hidden className="size-4" />
              Nueva categoría
            </button>
          ) : undefined,
        }}
      />
    </Tarjeta>
  );
}

export function PanelCategoria({
  abierto,
  categoria,
  alCerrar,
}: {
  abierto: boolean;
  /** `null` = alta. */
  categoria: Categoria | null;
  alCerrar: () => void;
}) {
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const idForm = useId();
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setNombre(categoria?.nombre ?? "");
    setError(undefined);
    setErrorGeneral(null);
  }, [abierto, categoria]);

  const guardar = useMutation({
    mutationFn: (n: string) =>
      categoria ? api.patch<Categoria>(`/categorias/${categoria.id}`, { nombre: n }) : api.post<Categoria>("/categorias", { nombre: n }),
    onSuccess: async (c) => {
      notificar(categoria ? `Categoría renombrada a «${c.nombre}»` : `Categoría «${c.nombre}» creada`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["categorias"] }),
        // Los productos muestran el nombre de su categoría.
        queryClient.invalidateQueries({ queryKey: ["productos"] }),
      ]);
      alCerrar();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.campos?.nombre) setError(err.campos.nombre);
      else setErrorGeneral(err instanceof ApiError ? err.message : "No se pudo guardar. Intente de nuevo.");
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    setErrorGeneral(null);
    const local = validarCategoria(nombre);
    setError(local);
    if (local) return;
    if (categoria && nombre.trim() === categoria.nombre) {
      alCerrar();
      return;
    }
    guardar.mutate(nombre.trim());
  }

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      variante="panel"
      titulo={categoria ? `Renombrar «${categoria.nombre}»` : "Nueva categoría"}
      descripcion={
        categoria
          ? `El nuevo nombre se verá en sus ${formatoNumero(categoria.numProductos)} productos.`
          : "El nombre no puede repetirse (sin distinguir mayúsculas)."
      }
      pie={
        <>
          <button type="button" onClick={alCerrar} className="btn-secundario">
            Cancelar
          </button>
          <button type="submit" form={idForm} disabled={guardar.isPending} className="btn-primario">
            {guardar.isPending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {guardar.isPending ? "Guardando…" : "Guardar categoría"}
          </button>
        </>
      }
    >
      <form id={idForm} onSubmit={enviar} noValidate className="space-y-4">
        {errorGeneral && <Aviso tono="error">{errorGeneral}</Aviso>}
        <Campo etiqueta="Nombre de la categoría" error={error}>
          <input
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              if (error) setError(undefined);
            }}
            className="campo-control"
            autoComplete="off"
            maxLength={60}
            autoFocus
          />
        </Campo>
      </form>
    </Dialogo>
  );
}
