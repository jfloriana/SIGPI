import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { api } from "../../api/cliente";
import { aQuery, type Paginado } from "../../api/tipos";
import { Buscador } from "../../components/Buscador";
import { Campo } from "../../components/Campo";
import { ChipStock } from "../../components/Chip";
import { Dialogo } from "../../components/Dialogo";
import { Aviso, Cargando } from "../../components/Estados";
import { useNotificar } from "../../components/Notificaciones";
import { formatoNumero, formatoSoles } from "../../utils/formato";
import {
  cantidadSugerida,
  costoSugerido,
  mensajeError,
  normalizarImporte,
  repartirError,
  subtotalCentimos,
  validarCantidad,
  validarCosto,
  type LineaFormulario,
  type OrdenDetalle,
  type ProductoCatalogo,
  type Proveedor,
  type Sugerida,
} from "./tipos";

const MAX_LINEAS = 60;
let contadorClave = 0;
const nuevaClave = () => `l${++contadorClave}`;

type Errores = Record<string, string | undefined>;

/**
 * Nueva orden de compra (`?nueva=1`) u orden sugerida (`?sugerida=1[&productos=1,2]`).
 * La sugerida se calcula con `POST /ordenes-compra/sugerida`, que NO guarda nada: solo precarga las líneas.
 */
export function FormularioOrden({
  sugerida,
  productoIds,
  proveedores,
  alCerrar,
  alCreada,
}: {
  sugerida: boolean;
  productoIds: number[];
  proveedores: Proveedor[] | undefined;
  alCerrar: () => void;
  alCreada: (orden: OrdenDetalle) => void;
}) {
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const idForm = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [proveedorId, setProveedorId] = useState("");
  const [lineas, setLineas] = useState<LineaFormulario[]>([]);
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [buscar, setBuscar] = useState("");
  const precargada = useRef(false);

  const propuesta = useQuery({
    queryKey: ["ordenes-compra", "sugerida", productoIds.join(",")],
    queryFn: () => api.post<Sugerida>("/ordenes-compra/sugerida", productoIds.length ? { productoIds } : {}),
    enabled: sugerida,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (!propuesta.data || precargada.current) return;
    precargada.current = true;
    setLineas(
      propuesta.data.lineas.map((l) => ({
        clave: nuevaClave(),
        producto: l.producto,
        cantidad: String(l.cantidad),
        costoUnit: l.costoUnit,
      })),
    );
  }, [propuesta.data]);

  const resultados = useQuery({
    queryKey: ["productos", "buscador-oc", buscar],
    queryFn: () => api.get<Paginado<ProductoCatalogo>>(`/productos${aQuery({ activo: "true", buscar, pageSize: 6 })}`),
    enabled: buscar.trim().length > 0,
  });

  const enfocarPrimerError = useCallback(() => {
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }, []);

  const crear = useMutation({
    mutationFn: (cuerpo: unknown) => api.post<OrdenDetalle>("/ordenes-compra", cuerpo),
    onSuccess: async (o) => {
      notificar(`Orden ${o.codigo} creada: queda PENDIENTE de aprobación`);
      await queryClient.invalidateQueries({ queryKey: ["ordenes-compra", "lista"] });
      alCreada(o);
    },
    onError: (err) => {
      // «lineas.<i>.campo» de la API → clave local de la línea i.
      const { campos, general } = repartirError(err, (c) => c === "proveedorId" || c === "lineas" || /^lineas\.\d+\.\w+$/.test(c));
      const locales: Errores = {};
      for (const [clave, msg] of Object.entries(campos)) {
        const m = /^lineas\.(\d+)\.(\w+)$/.exec(clave);
        if (!m) {
          locales[clave] = msg;
          continue;
        }
        const linea = lineas[Number(m[1])];
        if (!linea) continue;
        const campo = m[2] === "productoId" ? "producto" : m[2];
        locales[`${linea.clave}.${campo}`] = msg;
      }
      setErrores(locales);
      setErrorGeneral(general);
      enfocarPrimerError();
    },
  });

  function cambiarLinea(clave: string, campo: "cantidad" | "costoUnit", valor: string) {
    setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, [campo]: valor } : l)));
    const k = `${clave}.${campo}`;
    if (errores[k]) setErrores((e) => ({ ...e, [k]: undefined }));
  }

  function quitarLinea(clave: string) {
    setLineas((ls) => ls.filter((l) => l.clave !== clave));
  }

  function agregar(p: ProductoCatalogo) {
    setLineas((ls) => [
      ...ls,
      { clave: nuevaClave(), producto: p, cantidad: String(cantidadSugerida(p)), costoUnit: costoSugerido(p.precio) },
    ]);
    setBuscar("");
    if (errores.lineas) setErrores((e) => ({ ...e, lineas: undefined }));
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    setErrorGeneral(null);
    const locales: Errores = {};
    if (!proveedorId) locales.proveedorId = "Seleccione un proveedor";
    if (lineas.length === 0) locales.lineas = "La orden debe tener al menos una línea";
    else if (lineas.length > MAX_LINEAS) locales.lineas = `Máximo ${MAX_LINEAS} productos por orden`;
    for (const l of lineas) {
      const c = validarCantidad(l.cantidad);
      if (c) locales[`${l.clave}.cantidad`] = c;
      const k = validarCosto(l.costoUnit);
      if (k) locales[`${l.clave}.costoUnit`] = k;
    }
    const limpios = Object.fromEntries(Object.entries(locales).filter(([, v]) => v));
    setErrores(limpios);
    if (Object.keys(limpios).length) {
      enfocarPrimerError();
      return;
    }
    crear.mutate({
      proveedorId: Number(proveedorId),
      lineas: lineas.map((l) => ({
        productoId: l.producto.id,
        cantidad: Number(l.cantidad),
        costoUnit: normalizarImporte(l.costoUnit),
      })),
    });
  }

  const centimos = lineas.map(subtotalCentimos);
  const total = centimos.reduce<number>((s, c) => s + (c ?? 0), 0) / 100;
  const hayIncompletas = centimos.some((c) => c === null);
  const agregados = new Set(lineas.map((l) => l.producto.id));
  const guardando = crear.isPending;

  return (
    <Dialogo
      abierto
      alCerrar={alCerrar}
      variante="panel"
      ancho="lg"
      titulo={sugerida ? "Orden de compra sugerida" : "Nueva orden de compra"}
      descripcion="La orden nace PENDIENTE; el gerente la aprueba y el almacén la recepciona."
      pie={
        <>
          <button type="button" onClick={alCerrar} className="btn-secundario">
            Cancelar
          </button>
          <button type="submit" form={idForm} disabled={guardando || (sugerida && propuesta.isPending)} className="btn-primario">
            {guardando && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {guardando ? "Creando orden…" : "Crear orden de compra"}
          </button>
        </>
      }
    >
      <form id={idForm} ref={formRef} onSubmit={enviar} noValidate className="space-y-5">
        {sugerida && (
          <Aviso tono="info" titulo="Propuesta sin guardar">
            Propuesta calculada con los productos en alerta: cantidad = mínimo × 2 − stock; costo precargado al 80 % del precio de venta
            (supuesto del demo). Puede editar cantidades y costos.
          </Aviso>
        )}
        {errorGeneral && <Aviso tono="error">{errorGeneral}</Aviso>}

        <Campo etiqueta="Proveedor" error={errores.proveedorId} ayuda={sugerida ? "Elija a quién se le compra." : undefined}>
          <select
            value={proveedorId}
            onChange={(e) => {
              setProveedorId(e.target.value);
              if (errores.proveedorId) setErrores((x) => ({ ...x, proveedorId: undefined }));
            }}
            className="campo-control"
          >
            <option value="">{proveedores ? "Seleccione…" : "Cargando proveedores…"}</option>
            {proveedores?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.razonSocial} · RUC {p.ruc}
              </option>
            ))}
          </select>
        </Campo>

        <section aria-labelledby={`${idForm}-lineas`}>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 id={`${idForm}-lineas`} className="text-sm font-semibold text-slate-900">
              Productos ({lineas.length})
            </h3>
            {!sugerida && lineas.length > 0 && (
              <p className="text-xs text-slate-600">Costo precargado al 80 % del precio de venta (supuesto del demo).</p>
            )}
          </div>

          {sugerida && propuesta.isPending ? (
            <Cargando texto="Calculando la propuesta…" />
          ) : (
            <>
              {propuesta.error && <Aviso tono="error">{mensajeError(propuesta.error, "No se pudo calcular la propuesta.")}</Aviso>}
              {errores.lineas && (
                <p role="alert" className="campo-error mb-2">
                  {errores.lineas}
                </p>
              )}
              {lineas.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-600">
                  {sugerida && propuesta.data
                    ? "No hay productos en alerta en este momento. Agregue productos con el buscador."
                    : "Agregue productos con el buscador de abajo."}
                </p>
              ) : (
                <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                  <li
                    aria-hidden
                    className="hidden grid-cols-[minmax(0,1fr)_6.5rem_8.5rem_7rem_2.75rem] gap-3 bg-slate-50 px-3 py-2 text-xs font-semibold tracking-wide text-slate-600 uppercase sm:grid"
                  >
                    <span>Producto</span>
                    <span>Cantidad</span>
                    <span>Costo unit.</span>
                    <span className="text-right">Subtotal</span>
                    <span />
                  </li>
                  {lineas.map((l, i) => (
                    <FilaLinea
                      key={l.clave}
                      linea={l}
                      subtotal={centimos[i]}
                      errores={errores}
                      alCambiar={cambiarLinea}
                      alQuitar={quitarLinea}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <div className="flex items-baseline justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
          <span className="font-semibold text-slate-900">Total</span>
          <span className="text-right">
            <span className="text-lg font-bold text-slate-900 tabular-nums">{formatoSoles(total)}</span>
            {hayIncompletas && <span className="block text-xs text-slate-600">No incluye líneas con datos incompletos</span>}
          </span>
        </div>

        <section aria-labelledby={`${idForm}-agregar`} className="space-y-2">
          <h3 id={`${idForm}-agregar`} className="text-sm font-semibold text-slate-900">
            Agregar producto
          </h3>
          <Buscador valor={buscar} alCambiar={setBuscar} etiqueta="Buscar producto para agregar" placeholder="Código o nombre" className="sm:max-w-none" />
          {buscar.trim() && (
            <div aria-live="polite">
              {resultados.isPending ? (
                <p className="py-2 text-sm text-slate-600">Buscando…</p>
              ) : resultados.error ? (
                <p className="py-2 text-sm text-coral-700">{mensajeError(resultados.error, "No se pudo buscar.")}</p>
              ) : resultados.data && resultados.data.datos.length === 0 ? (
                <p className="py-2 text-sm text-slate-600">Ningún producto activo coincide con «{buscar}».</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {resultados.data?.datos.map((p) => {
                    const ya = agregados.has(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          disabled={ya}
                          onClick={() => agregar(p)}
                          className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-marino-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="font-medium text-slate-900 tabular-nums">{p.codigo}</span>{" "}
                            <span className="text-slate-700">{p.nombre}</span>
                          </span>
                          <ChipStock stock={p.stock} stockMinimo={p.stockMinimo} />
                          <span className="inline-flex w-20 shrink-0 items-center justify-end gap-1 font-medium text-marino">
                            {ya ? (
                              <span className="text-slate-600">Agregado</span>
                            ) : (
                              <>
                                <Plus aria-hidden className="size-4" />
                                Agregar
                              </>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </section>
      </form>
    </Dialogo>
  );
}

function FilaLinea({
  linea: l,
  subtotal,
  errores,
  alCambiar,
  alQuitar,
}: {
  linea: LineaFormulario;
  subtotal: number | null;
  errores: Errores;
  alCambiar: (clave: string, campo: "cantidad" | "costoUnit", valor: string) => void;
  alQuitar: (clave: string) => void;
}) {
  const id = useId();
  const errCant = errores[`${l.clave}.cantidad`];
  const errCosto = errores[`${l.clave}.costoUnit`];
  const errProd = errores[`${l.clave}.producto`];
  return (
    <li className="grid grid-cols-2 items-start gap-x-3 gap-y-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_6.5rem_8.5rem_7rem_2.75rem]">
      <div className="col-span-2 min-w-0 sm:col-span-1 sm:pt-2.5">
        <p className="text-sm">
          <span className="font-semibold text-slate-900 tabular-nums">{l.producto.codigo}</span>{" "}
          <span className="text-slate-700">{l.producto.nombre}</span>
        </p>
        <p className="mt-0.5 text-xs text-slate-600 tabular-nums">
          Stock {formatoNumero(l.producto.stock)} · mín. {formatoNumero(l.producto.stockMinimo)} {l.producto.unidad}
        </p>
        {errProd && <p className="campo-error">{errProd}</p>}
      </div>
      <div>
        <label htmlFor={`${id}-cant`} className="campo-etiqueta sm:sr-only">
          Cantidad<span className="sr-only"> de {l.producto.codigo}</span>
        </label>
        <input
          id={`${id}-cant`}
          value={l.cantidad}
          onChange={(e) => alCambiar(l.clave, "cantidad", e.target.value.replace(/[^\d]/g, ""))}
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={errCant ? true : undefined}
          aria-describedby={errCant ? `${id}-cant-error` : undefined}
          className="campo-control text-right tabular-nums"
        />
        {errCant && (
          <p id={`${id}-cant-error`} className="campo-error">
            {errCant}
          </p>
        )}
      </div>
      <div>
        <label htmlFor={`${id}-costo`} className="campo-etiqueta sm:sr-only">
          Costo unitario<span className="sr-only"> de {l.producto.codigo}</span>
        </label>
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-600">
            S/
          </span>
          <input
            id={`${id}-costo`}
            value={l.costoUnit}
            onChange={(e) => alCambiar(l.clave, "costoUnit", e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            aria-invalid={errCosto ? true : undefined}
            aria-describedby={errCosto ? `${id}-costo-error` : undefined}
            className="campo-control pl-9 text-right tabular-nums"
          />
        </div>
        {errCosto && (
          <p id={`${id}-costo-error`} className="campo-error">
            {errCosto}
          </p>
        )}
      </div>
      <p className="flex min-h-11 items-center text-sm sm:justify-end">
        <span className="mr-1 text-slate-600 sm:sr-only">Subtotal:</span>
        <span className="font-semibold text-slate-900 tabular-nums">{subtotal === null ? "—" : formatoSoles(subtotal / 100)}</span>
      </p>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => alQuitar(l.clave)}
          className="grid size-11 place-items-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-coral-50 hover:text-coral-700"
          aria-label={`Quitar ${l.producto.codigo} de la orden`}
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
      </div>
    </li>
  );
}
