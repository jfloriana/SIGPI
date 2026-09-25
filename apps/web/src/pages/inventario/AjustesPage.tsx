import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { api, ApiError } from "../../api/cliente";
import { useUsuario } from "../../auth/AuthContext";
import { Chip, ChipStock } from "../../components/Chip";
import { Campo } from "../../components/Campo";
import { Encabezado } from "../../components/Encabezado";
import { Aviso, EstadoVacio } from "../../components/Estados";
import { useNotificar } from "../../components/Notificaciones";
import { Tarjeta } from "../../components/Tarjeta";
import { formatoFechaHora, formatoNumero } from "../../utils/formato";
import { ChipTipoMovimiento, SelectorProducto, type ProductoBuscado } from "./componentes";
import {
  cantidadConSigno,
  MOTIVO_MAX,
  REFERENCIA_MAX,
  stockPrevisto,
  validarAjuste,
  type CampoAjuste,
  type ProductoInventario,
  type RespuestaAjuste,
  type TipoAjuste,
  type ValoresAjuste,
} from "./tipos";

const OPCIONES: { tipo: TipoAjuste; titulo: string; ayuda: string }[] = [
  { tipo: "ENTRADA", titulo: "Entrada", ayuda: "Llega mercadería sin orden de compra (las compras se recepcionan en su orden)." },
  { tipo: "AJUSTE_POSITIVO", titulo: "Ajuste positivo", ayuda: "El conteo físico encontró más unidades de las registradas." },
  { tipo: "AJUSTE_NEGATIVO", titulo: "Ajuste negativo", ayuda: "Merma, rotura, vencimiento o faltante en el conteo físico." },
];

const SUGERENCIAS = ["Merma", "Producto vencido", "Conteo físico", "Devolución de cliente", "Rotura en almacén"];

const VACIO: ValoresAjuste = { tipo: "", cantidad: "", motivo: "", referencia: "" };
const MAX_RECIENTES = 8;

type Producto = Pick<ProductoInventario, "id" | "codigo" | "nombre" | "unidad" | "stock" | "stockMinimo">;

/** Ajustes registrados en esta sesión del navegador (se conservan al cambiar de pantalla). */
function useRecientes(usuarioId: number) {
  const clave = `sigpi.ajustes.${usuarioId}`;
  const [lista, setLista] = useState<RespuestaAjuste[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(clave) ?? "[]") as RespuestaAjuste[];
    } catch {
      return [];
    }
  });
  function agregar(r: RespuestaAjuste) {
    setLista((l) => {
      const n = [r, ...l].slice(0, MAX_RECIENTES);
      try {
        sessionStorage.setItem(clave, JSON.stringify(n));
      } catch {
        /* sin almacenamiento: la lista vive solo en memoria */
      }
      return n;
    });
  }
  return { lista, agregar };
}

export default function AjustesPage() {
  const usuario = useUsuario();
  const notificar = useNotificar();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const idTipo = useId();
  const refBuscador = useRef<HTMLInputElement>(null);
  const refCantidad = useRef<HTMLInputElement>(null);

  const [producto, setProducto] = useState<Producto | null>(null);
  const [valores, setValores] = useState<ValoresAjuste>(VACIO);
  const [errores, setErrores] = useState<Partial<Record<CampoAjuste, string>>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const recientes = useRecientes(usuario.id);

  // Llegada desde el kardex: /ajustes?productoId=9 precarga el producto (solo al abrir la pantalla;
  // después, la URL solo refleja lo que el usuario elige).
  const [idInicial] = useState(() => (/^\d+$/.test(params.get("productoId") ?? "") ? Number(params.get("productoId")) : null));
  const precarga = useQuery({
    queryKey: ["productos", "detalle", idInicial],
    queryFn: () => api.get<ProductoBuscado>(`/productos/${idInicial}`),
    enabled: idInicial !== null,
    staleTime: Infinity,
  });
  const precargado = useRef(false);
  useEffect(() => {
    if (precarga.data && !precargado.current) {
      precargado.current = true;
      setProducto(precarga.data);
    }
  }, [precarga.data]);

  function elegirProducto(p: Producto | null) {
    setProducto(p);
    setErrores((e) => ({ ...e, productoId: undefined, cantidad: undefined }));
    setErrorGeneral(null);
    // La URL refleja el producto elegido (se puede compartir o recargar).
    const n = new URLSearchParams(window.location.search);
    if (p) n.set("productoId", String(p.id));
    else n.delete("productoId");
    setParams(n, { replace: true });
    if (p) setTimeout(() => document.getElementById(`${idTipo}-${valores.tipo || "ENTRADA"}`)?.focus(), 0);
    else setTimeout(() => refBuscador.current?.focus(), 0);
  }

  function cambiar<K extends keyof ValoresAjuste>(campo: K, valor: ValoresAjuste[K]) {
    const nuevos = { ...valores, [campo]: valor };
    setValores(nuevos);
    setErrorGeneral(null);
    // Tras el primer intento, los errores se recalculan al escribir.
    if (enviado) setErrores(validarAjuste(nuevos, producto));
    else if (errores[campo] || (campo === "tipo" && errores.cantidad)) setErrores((e) => ({ ...e, [campo]: undefined, cantidad: campo === "tipo" ? undefined : e.cantidad }));
  }

  const registrar = useMutation({
    mutationFn: () =>
      api.post<RespuestaAjuste>("/inventario/ajustes", {
        productoId: producto!.id,
        tipo: valores.tipo,
        cantidad: Number(valores.cantidad),
        motivo: valores.motivo.trim(),
        referencia: valores.referencia.trim() || null,
      }),
    onSuccess: (r) => {
      notificar(`Ajuste registrado: ${r.producto.codigo} quedó con ${formatoNumero(r.producto.stock)} ${r.producto.unidad}`);
      recientes.agregar(r);
      queryClient.invalidateQueries({ queryKey: ["inventario"] });
      queryClient.invalidateQueries({ queryKey: ["productos"] });
      setValores(VACIO);
      setErrores({});
      setEnviado(false);
      elegirProducto(null);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.codigo === "STOCK_INSUFICIENTE") {
          // El stock pudo cambiar desde que se eligió el producto: se actualiza con el del servidor.
          const info = (err.datos.productos as { stockDisponible: number }[] | undefined)?.[0];
          if (info && producto) setProducto({ ...producto, stock: info.stockDisponible });
        }
        const { _: general, ...campos } = err.campos ?? {};
        setErrores(campos);
        if (general || Object.keys(campos).length === 0) setErrorGeneral(general ?? err.message);
        if (campos.cantidad) refCantidad.current?.focus();
      } else {
        setErrorGeneral("No se pudo registrar el ajuste. Intente de nuevo.");
      }
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviado(true);
    const errs = validarAjuste(valores, producto);
    setErrores(errs);
    setErrorGeneral(null);
    if (Object.keys(errs).length) {
      if (errs.productoId) refBuscador.current?.focus();
      else if (errs.tipo) document.getElementById(`${idTipo}-ENTRADA`)?.focus();
      else if (errs.cantidad) refCantidad.current?.focus();
      else document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    registrar.mutate();
  }

  const cantidadNum = /^\d+$/.test(valores.cantidad.trim()) ? Number(valores.cantidad) : null;
  const previsto = producto && valores.tipo && cantidadNum ? stockPrevisto(producto.stock, valores.tipo, cantidadNum) : null;

  return (
    <>
      <Encabezado
        titulo="Ajustes de inventario"
        descripcion="Registre entradas manuales y ajustes por conteo físico, merma o vencimiento. Cada ajuste queda en el kardex del producto y en la bitácora con su motivo."
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Tarjeta titulo="Nuevo ajuste">
          <form onSubmit={enviar} noValidate className="space-y-6">
            {/* 1. Producto */}
            {producto ? (
              <div>
                <p className="campo-etiqueta">Producto</p>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="mr-2 font-semibold text-slate-900 tabular-nums">{producto.codigo}</span>
                      <span className="text-slate-800">{producto.nombre}</span>
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                      <span>
                        Stock actual <strong className="text-slate-900 tabular-nums">{formatoNumero(producto.stock)}</strong>{" "}
                        {producto.unidad} · mínimo <span className="tabular-nums">{formatoNumero(producto.stockMinimo)}</span>
                      </span>
                      {producto.stock <= producto.stockMinimo && <ChipStock stock={producto.stock} stockMinimo={producto.stockMinimo} />}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => elegirProducto(null)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-marino hover:bg-marino-50"
                  >
                    <X aria-hidden className="size-4" />
                    Cambiar producto
                  </button>
                </div>
              </div>
            ) : idInicial !== null && !precargado.current && precarga.isLoading ? (
              <div role="status" className="h-20 animate-pulse rounded-lg bg-slate-100" aria-label="Cargando producto" />
            ) : (
              <SelectorProducto
                etiqueta="Producto"
                ayuda="Escriba el código o parte del nombre y elija un producto de la lista."
                error={errores.productoId}
                alElegir={elegirProducto}
                inputRef={refBuscador}
              />
            )}

            {/* 2. Tipo */}
            <fieldset aria-describedby={errores.tipo ? `${idTipo}-error` : undefined}>
              <legend className="campo-etiqueta">Tipo de movimiento</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {OPCIONES.map((o) => {
                  const marcado = valores.tipo === o.tipo;
                  return (
                    <label
                      key={o.tipo}
                      htmlFor={`${idTipo}-${o.tipo}`}
                      className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marino-500 ${
                        marcado ? "border-marino-500 bg-marino-50" : errores.tipo ? "border-coral-700" : "border-slate-300 hover:border-slate-400"
                      }`}
                    >
                      <input
                        id={`${idTipo}-${o.tipo}`}
                        type="radio"
                        name="tipo"
                        value={o.tipo}
                        checked={marcado}
                        onChange={() => cambiar("tipo", o.tipo)}
                        className="mt-0.5 size-4 shrink-0 focus-visible:outline-none"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">{o.titulo}</span>
                        <span className="mt-0.5 block text-sm text-slate-600">{o.ayuda}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {errores.tipo && (
                <p id={`${idTipo}-error`} className="campo-error">
                  {errores.tipo}
                </p>
              )}
            </fieldset>

            {/* 3. Cantidad y vista previa */}
            <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-start">
              <Campo etiqueta={producto ? `Cantidad (${producto.unidad})` : "Cantidad"} error={errores.cantidad} ayuda="Entero mayor que 0">
                <input
                  ref={refCantidad}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={valores.cantidad}
                  onChange={(e) => cambiar("cantidad", e.target.value)}
                  className="campo-control tabular-nums"
                />
              </Campo>
              <VistaPrevia producto={producto} tipo={valores.tipo || null} cantidad={cantidadNum} previsto={previsto} />
            </div>

            {/* 4. Motivo */}
            <div>
              <Campo etiqueta="Motivo" error={errores.motivo} ayuda={`Obligatorio, de 5 a ${MOTIVO_MAX} caracteres. Queda en el kardex y en la bitácora.`}>
                <input
                  type="text"
                  value={valores.motivo}
                  maxLength={MOTIVO_MAX}
                  onChange={(e) => cambiar("motivo", e.target.value)}
                  className="campo-control"
                />
              </Campo>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-600" id={`${idTipo}-sug`}>
                  Sugerencias:
                </span>
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-describedby={`${idTipo}-sug`}
                    aria-pressed={valores.motivo === s}
                    onClick={() => cambiar("motivo", s)}
                    className={`inline-flex min-h-11 items-center rounded-full border px-3 text-sm transition-colors duration-150 sm:min-h-9 ${
                      valores.motivo === s
                        ? "border-marino-500 bg-marino-50 font-medium text-marino-800"
                        : "border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Referencia */}
            <Campo etiqueta="Referencia" opcional error={errores.referencia} ayuda="Número de acta, guía o documento de sustento.">
              <input
                type="text"
                value={valores.referencia}
                maxLength={REFERENCIA_MAX}
                onChange={(e) => cambiar("referencia", e.target.value)}
                placeholder="p. ej., ACTA-12"
                className="campo-control sm:max-w-xs"
              />
            </Campo>

            {errorGeneral && <Aviso tono="error">{errorGeneral}</Aviso>}

            <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
              <button type="submit" disabled={registrar.isPending} className="btn-primario">
                {registrar.isPending ? "Registrando ajuste…" : "Registrar ajuste"}
              </button>
              <button
                type="button"
                disabled={registrar.isPending}
                onClick={() => {
                  setValores(VACIO);
                  setErrores({});
                  setErrorGeneral(null);
                  setEnviado(false);
                  elegirProducto(null);
                }}
                className="btn-secundario"
              >
                Limpiar
              </button>
            </div>
          </form>
        </Tarjeta>

        <Tarjeta titulo="Ajustes de esta sesión" sinRelleno>
          {recientes.lista.length === 0 ? (
            <EstadoVacio titulo="Aún no registró ajustes" descripcion="Los ajustes que registre aparecerán aquí con un enlace a su kardex." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recientes.lista.map(({ movimiento: m, producto: p }) => (
                <li key={m.id} className="px-4 py-3 sm:px-5">
                  <div className="flex items-center justify-between gap-2">
                    <ChipTipoMovimiento tipo={m.tipo} />
                    <span className="text-sm font-semibold text-slate-900 tabular-nums">
                      {cantidadConSigno(m.tipo, m.cantidad)} {p.unidad}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm">
                    <span className="mr-1.5 font-semibold text-slate-900 tabular-nums">{p.codigo}</span>
                    <span className="text-slate-800">{p.nombre}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {m.motivo} · stock {formatoNumero(m.stockResultante)} · {formatoFechaHora(m.fecha)}
                  </p>
                  <Link
                    to={`/kardex?productoId=${p.id}`}
                    className="-ml-2 mt-1 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-marino hover:bg-marino-50 hover:underline"
                  >
                    Ver kardex<span className="sr-only"> de {p.codigo}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </>
  );
}

function VistaPrevia({
  producto,
  tipo,
  cantidad,
  previsto,
}: {
  producto: Producto | null;
  tipo: TipoAjuste | null;
  cantidad: number | null;
  previsto: number | null;
}) {
  if (!producto) return <p className="text-sm text-slate-600 sm:pt-8">Elija un producto para ver el stock resultante.</p>;
  const negativo = previsto !== null && previsto < 0;
  const enAlerta = previsto !== null && !negativo && previsto <= producto.stockMinimo;
  return (
    <div aria-live="polite" className="rounded-lg bg-slate-50 px-4 py-3 sm:mt-6">
      <p className="text-sm text-slate-600">Stock previsto</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-lg font-semibold text-slate-700 tabular-nums">{formatoNumero(producto.stock)}</span>
        <ArrowRight aria-hidden className="size-4 text-slate-500" />
        <span className="sr-only">pasa a</span>
        {previsto === null ? (
          <span className="text-sm text-slate-600">{!tipo ? "elija el tipo" : !cantidad ? "ingrese la cantidad" : "—"}</span>
        ) : (
          <>
            <span className={`text-lg font-bold tabular-nums ${negativo ? "text-coral-700" : "text-slate-900"}`}>{formatoNumero(previsto)}</span>
            <span className="text-sm text-slate-600">{producto.unidad}</span>
            {negativo ? (
              <Chip tono="coral">Quedaría negativo</Chip>
            ) : enAlerta ? (
              <Chip tono="ambar">Quedará en alerta</Chip>
            ) : producto.stock <= producto.stockMinimo ? (
              <Chip tono="teal">Sale de alerta</Chip>
            ) : null}
          </>
        )}
      </p>
    </div>
  );
}
