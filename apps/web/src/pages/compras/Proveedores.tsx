import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useCallback, useId, useRef, useState, type FormEvent } from "react";
import { api } from "../../api/cliente";
import { aQuery, type Paginado } from "../../api/tipos";
import { Buscador } from "../../components/Buscador";
import { Campo } from "../../components/Campo";
import { Dialogo } from "../../components/Dialogo";
import { Aviso } from "../../components/Estados";
import { useNotificar } from "../../components/Notificaciones";
import { Paginacion, Tabla, type Columna } from "../../components/Tabla";
import { BarraFiltros, Tarjeta } from "../../components/Tarjeta";
import { repartirError, validarProveedor, type CampoProveedor, type Proveedor, type ValoresProveedor } from "./tipos";

const PAGE_SIZE = 20;

export function SeccionProveedores({
  buscar,
  page,
  alBuscar,
  alPaginar,
  puedeCrear,
  puedeEditar,
  alNuevo,
  alEditar,
  alVerOrdenes,
}: {
  buscar: string;
  page: number;
  alBuscar: (v: string) => void;
  alPaginar: (p: number) => void;
  puedeCrear: boolean;
  puedeEditar: boolean;
  alNuevo: () => void;
  alEditar: (p: Proveedor) => void;
  alVerOrdenes: (p: Proveedor) => void;
}) {
  const proveedores = useQuery({
    queryKey: ["proveedores", "lista", buscar, page],
    queryFn: () => api.get<Paginado<Proveedor>>(`/proveedores${aQuery({ page, pageSize: PAGE_SIZE, buscar })}`),
    placeholderData: keepPreviousData,
  });

  const columnas: Columna<Proveedor>[] = [
    { titulo: "RUC", celda: (p) => <span className="font-medium whitespace-nowrap text-slate-900 tabular-nums">{p.ruc}</span> },
    {
      titulo: "Razón social",
      celda: (p) => (
        <div className="max-w-[18rem] min-w-[10rem] whitespace-normal md:max-w-md">
          {p.razonSocial}
          <span className="mt-0.5 block text-xs text-slate-600 tabular-nums md:hidden">{p.telefono ?? "Sin teléfono"}</span>
        </div>
      ),
    },
    {
      titulo: "Teléfono",
      ocultarEnMovil: true,
      celda: (p) => (p.telefono ? <span className="whitespace-nowrap tabular-nums">{p.telefono}</span> : <span className="text-slate-500">—</span>),
    },
    {
      titulo: "Acciones",
      alinear: "derecha",
      celda: (p) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => alVerOrdenes(p)}
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap text-marino hover:bg-marino-50 hover:underline"
          >
            Ver órdenes<span className="sr-only"> de {p.razonSocial}</span>
          </button>
          {puedeEditar && (
            <button
              type="button"
              onClick={() => alEditar(p)}
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Editar<span className="sr-only"> {p.razonSocial}</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Tarjeta sinRelleno>
      <BarraFiltros>
        <Buscador valor={buscar} alCambiar={alBuscar} etiqueta="Buscar proveedor" placeholder="Razón social o RUC" />
      </BarraFiltros>
      <Tabla
        descripcion="Proveedores con RUC y teléfono"
        columnas={columnas}
        filas={proveedores.data?.datos}
        claveFila={(p) => p.id}
        cargando={proveedores.isFetching}
        error={proveedores.error}
        reintentar={() => proveedores.refetch()}
        vacio={
          buscar
            ? {
                titulo: "Ningún proveedor coincide con la búsqueda",
                descripcion: "Pruebe con otra razón social o con el RUC completo.",
                accion: (
                  <button type="button" onClick={() => alBuscar("")} className="btn-secundario">
                    Limpiar búsqueda
                  </button>
                ),
              }
            : {
                titulo: "Aún no hay proveedores",
                descripcion: puedeCrear ? "Registre el primer proveedor para poder emitir órdenes de compra." : undefined,
                accion: puedeCrear ? (
                  <button type="button" onClick={alNuevo} className="btn-primario">
                    Nuevo proveedor
                  </button>
                ) : undefined,
              }
        }
      />
      {proveedores.data && <Paginacion page={page} pageSize={PAGE_SIZE} total={proveedores.data.total} alCambiar={alPaginar} />}
    </Tarjeta>
  );
}

const CAMPOS: CampoProveedor[] = ["ruc", "razonSocial", "telefono"];

export function PanelProveedor({ proveedor, alCerrar }: { proveedor: Proveedor | null; alCerrar: () => void }) {
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const idForm = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [valores, setValores] = useState<ValoresProveedor>(() => ({
    ruc: proveedor?.ruc ?? "",
    razonSocial: proveedor?.razonSocial ?? "",
    telefono: proveedor?.telefono ?? "",
  }));
  const [errores, setErrores] = useState<Partial<Record<CampoProveedor, string>>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const enfocarPrimerError = useCallback(() => {
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }, []);

  const guardar = useMutation({
    mutationFn: (cuerpo: Record<string, unknown>) =>
      proveedor ? api.patch<Proveedor>(`/proveedores/${proveedor.id}`, cuerpo) : api.post<Proveedor>("/proveedores", cuerpo),
    onSuccess: async (p) => {
      notificar(proveedor ? `Proveedor ${p.razonSocial} actualizado` : `Proveedor ${p.razonSocial} registrado`);
      await queryClient.invalidateQueries({ queryKey: ["proveedores"] });
      alCerrar();
    },
    onError: (err) => {
      const { campos, general } = repartirError(err, (c) => (CAMPOS as string[]).includes(c));
      setErrores(campos);
      setErrorGeneral(general);
      enfocarPrimerError();
    },
  });

  function cambiar(campo: CampoProveedor, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }));
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    setErrorGeneral(null);
    const locales = validarProveedor(valores);
    setErrores(locales);
    if (Object.keys(locales).length) {
      enfocarPrimerError();
      return;
    }
    const completo = { ruc: valores.ruc.trim(), razonSocial: valores.razonSocial.trim(), telefono: valores.telefono.trim() };
    if (!proveedor) {
      guardar.mutate(completo.telefono ? completo : { ruc: completo.ruc, razonSocial: completo.razonSocial });
      return;
    }
    const cambios: Record<string, unknown> = {};
    if (completo.ruc !== proveedor.ruc) cambios.ruc = completo.ruc;
    if (completo.razonSocial !== proveedor.razonSocial) cambios.razonSocial = completo.razonSocial;
    if (completo.telefono !== (proveedor.telefono ?? "")) cambios.telefono = completo.telefono || null;
    if (Object.keys(cambios).length === 0) {
      setErrorGeneral("No hay cambios para guardar.");
      return;
    }
    guardar.mutate(cambios);
  }

  const guardando = guardar.isPending;

  return (
    <Dialogo
      abierto
      alCerrar={alCerrar}
      variante="panel"
      titulo={proveedor ? "Editar proveedor" : "Nuevo proveedor"}
      descripcion={proveedor ? `RUC ${proveedor.ruc}. Los cambios quedan registrados en la bitácora.` : "Registro en la bitácora con el usuario y la fecha."}
      pie={
        <>
          <button type="button" onClick={alCerrar} className="btn-secundario">
            Cancelar
          </button>
          <button type="submit" form={idForm} disabled={guardando} className="btn-primario">
            {guardando && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {guardando ? "Guardando…" : "Guardar proveedor"}
          </button>
        </>
      }
    >
      <form id={idForm} ref={formRef} onSubmit={enviar} noValidate className="space-y-4">
        {errorGeneral && <Aviso tono="error">{errorGeneral}</Aviso>}
        <Campo etiqueta="RUC" error={errores.ruc} ayuda="11 dígitos; empieza con 10 (persona natural) o 20 (empresa).">
          <input
            value={valores.ruc}
            onChange={(e) => cambiar("ruc", e.target.value.replace(/\D/g, "").slice(0, 11))}
            inputMode="numeric"
            autoComplete="off"
            maxLength={11}
            className="campo-control tabular-nums"
          />
        </Campo>
        <Campo etiqueta="Razón social" error={errores.razonSocial}>
          <input
            value={valores.razonSocial}
            onChange={(e) => cambiar("razonSocial", e.target.value)}
            autoComplete="off"
            maxLength={150}
            className="campo-control"
          />
        </Campo>
        <Campo etiqueta="Teléfono" opcional error={errores.telefono} ayuda="Ej.: 044 481 237">
          <input
            value={valores.telefono}
            onChange={(e) => cambiar("telefono", e.target.value)}
            inputMode="tel"
            autoComplete="off"
            maxLength={20}
            className="campo-control tabular-nums"
          />
        </Campo>
      </form>
    </Dialogo>
  );
}
