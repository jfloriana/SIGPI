import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle, Minus, Plus, Send, Store, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from "react";
import { useNavigate } from "react-router";
import { api, ApiError } from "../../api/cliente";
import { aQuery, type Paginado } from "../../api/tipos";
import { Encabezado } from "../../components/Encabezado";
import { Aviso } from "../../components/Estados";
import { useNotificar } from "../../components/Notificaciones";
import { OpcionesSegmentadas } from "../../components/Segmentado";
import { Tarjeta } from "../../components/Tarjeta";
import { formatoNumero, formatoSoles } from "../../utils/formato";
import { BuscadorLista, useRetardado } from "./componentes/BuscadorLista";
import {
  LIMITE_APROBACION_AUTOMATICA,
  TEXTO_CONDICION,
  type ClienteVenta,
  type CondicionPago,
  type FaltaStock,
  type PedidoDetalle,
  type ProductoVenta,
} from "./tipos";

const RESULTADOS = 8;

const OPCIONES_CONDICION = (["CONTADO", "CREDITO"] as const).map((c) => ({ valor: c, texto: TEXTO_CONDICION[c] }));

interface Linea {
  producto: ProductoVenta;
  /** Texto del input (puede estar vacío mientras se escribe). */
  cantidad: string;
}

interface CuerpoPedido {
  clienteId: number;
  condicionPago: CondicionPago;
  lineas: { productoId: number; cantidad: number }[];
}

const centimos = (precio: string) => Math.round(Number(precio) * 100);
const cantidadDe = (l: Linea) => (/^\d+$/.test(l.cantidad) ? Number(l.cantidad) : 0);

function sin<T>(obj: Record<number, T>, clave: number): Record<number, T> {
  const copia = { ...obj };
  delete copia[clave];
  return copia;
}

/* ───────────────────────── Selector de cliente ───────────────────────── */

function PasoCliente({
  cliente,
  alElegir,
  error,
  inputRef,
}: {
  cliente: ClienteVenta | null;
  alElegir: (c: ClienteVenta | null) => void;
  error?: string;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const [texto, setTexto] = useState("");
  const buscar = useRetardado(texto.trim());
  const consulta = useQuery({
    queryKey: ["clientes", "venta", buscar],
    queryFn: () => api.get<Paginado<ClienteVenta>>(`/clientes${aQuery({ activo: true, buscar, pageSize: RESULTADOS })}`),
    enabled: buscar.length > 0,
    placeholderData: keepPreviousData,
  });

  if (cliente) {
    return (
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-marino-50 text-marino">
          <Store className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{cliente.razonSocial}</p>
          <p className="text-sm text-slate-600">
            {cliente.tipoDoc} <span className="tabular-nums">{cliente.numDoc}</span> · {cliente.zona}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setTexto("");
            alElegir(null);
          }}
          className="btn-secundario shrink-0 px-3"
          aria-label={`Cambiar cliente (${cliente.razonSocial})`}
        >
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <BuscadorLista
      inputRef={inputRef}
      etiqueta="Buscar cliente"
      placeholder="Razón social, RUC o DNI"
      ayuda="Solo aparecen clientes activos."
      texto={texto}
      alCambiarTexto={setTexto}
      resultados={buscar ? consulta.data?.datos : undefined}
      total={consulta.data?.total}
      cargando={consulta.isFetching}
      errorCarga={consulta.error ? consulta.error.message : null}
      error={error}
      claveDe={(c) => c.id}
      textoDe={(c) => `${c.razonSocial}, ${c.tipoDoc} ${c.numDoc}, zona ${c.zona}`}
      alElegir={(c) => alElegir(c)}
      sinResultados={(t) => `No hay clientes activos que coincidan con «${t}».`}
      pintar={(c) => (
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900">{c.razonSocial}</p>
          <p className="text-sm text-slate-600">
            {c.tipoDoc} <span className="tabular-nums">{c.numDoc}</span> · {c.zona}
          </p>
        </div>
      )}
    />
  );
}

/* ───────────────────────── Buscador de productos ───────────────────────── */

function BuscadorProducto({
  enPedido,
  alElegir,
  error,
  inputRef,
}: {
  enPedido: Set<number>;
  alElegir: (p: ProductoVenta) => void;
  error?: string;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const [texto, setTexto] = useState("");
  const buscar = useRetardado(texto.trim());
  const consulta = useQuery({
    queryKey: ["productos", "venta", buscar],
    queryFn: () => api.get<Paginado<ProductoVenta>>(`/productos${aQuery({ activo: true, buscar, pageSize: RESULTADOS })}`),
    enabled: buscar.length > 0,
    placeholderData: keepPreviousData,
  });

  return (
    <BuscadorLista
      inputRef={inputRef}
      etiqueta="Agregar producto"
      placeholder="Nombre o código"
      ayuda="Por ejemplo: arroz, leche o ACE-001. Cada resultado muestra el stock disponible y el precio vigente."
      texto={texto}
      alCambiarTexto={setTexto}
      resultados={buscar ? consulta.data?.datos : undefined}
      total={consulta.data?.total}
      cargando={consulta.isFetching}
      errorCarga={consulta.error ? consulta.error.message : null}
      error={error}
      claveDe={(p) => p.id}
      textoDe={(p) =>
        `${p.nombre} (${p.codigo}), ${formatoSoles(p.precio)}, stock ${p.stock}${enPedido.has(p.id) ? ", ya está en el pedido" : ""}`
      }
      deshabilitado={(p) => p.stock <= 0 && !enPedido.has(p.id)}
      alElegir={(p) => {
        setTexto("");
        alElegir(p);
      }}
      sinResultados={(t) => `No hay productos activos que coincidan con «${t}».`}
      pintar={(p) => (
        <>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900">{p.nombre}</p>
            <p className="text-xs text-slate-500">
              <span className="font-semibold tabular-nums">{p.codigo}</span>
              {enPedido.has(p.id) && <span className="ml-2 font-medium text-marino">Ya está en el pedido</span>}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-slate-900 tabular-nums">{formatoSoles(p.precio)}</p>
            <p className={`text-xs tabular-nums ${p.stock <= 0 ? "font-semibold text-coral-700" : "text-slate-600"}`}>
              {p.stock <= 0 ? "Sin stock" : `Stock ${formatoNumero(p.stock)} ${p.unidad}`}
            </p>
          </div>
        </>
      )}
    />
  );
}

/* ───────────────────────── Línea editable ───────────────────────── */

function FilaLinea({
  linea,
  errorServidor,
  errorLocal,
  alCambiar,
  alQuitar,
  inputRef,
}: {
  linea: Linea;
  errorServidor?: string;
  errorLocal?: string;
  alCambiar: (cantidad: string) => void;
  alQuitar: () => void;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  const id = useId();
  const p = linea.producto;
  const n = cantidadDe(linea);
  const supera = n > p.stock;
  const subtotal = (centimos(p.precio) * n) / 100;
  const mensaje = errorServidor ?? errorLocal;
  const idMensaje = `${id}-msg`;

  const boton =
    "grid size-11 shrink-0 place-items-center border border-slate-300 bg-white text-slate-700 transition-colors duration-150 hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-white";

  return (
    <li
      className={`-mx-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors duration-200 sm:-mx-5 sm:grid-cols-[minmax(0,1fr)_auto_6.5rem_auto] sm:px-5 ${
        errorServidor ? "bg-coral-50" : ""
      }`}
    >
      <div className="col-start-1 row-start-1 min-w-0">
        <p className="font-medium text-slate-900">{p.nombre}</p>
        <p className="text-xs text-slate-600 tabular-nums">
          <span className="font-semibold text-slate-500">{p.codigo}</span> · {formatoSoles(p.precio)} / {p.unidad} · Stock{" "}
          {formatoNumero(p.stock)}
        </p>
      </div>

      <div className="col-start-1 row-start-2 flex items-center sm:col-start-2 sm:row-start-1">
        <button
          type="button"
          onClick={() => alCambiar(String(Math.max(1, n - 1)))}
          disabled={n <= 1}
          className={`${boton} rounded-l-[var(--radius-control)]`}
          aria-label={`Quitar una unidad de ${p.nombre}`}
        >
          <Minus aria-hidden className="size-4" />
        </button>
        <label htmlFor={id} className="sr-only">
          Cantidad de {p.nombre}
        </label>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          enterKeyHint="done"
          value={linea.cantidad}
          onChange={(e) => alCambiar(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onFocus={(e) => e.currentTarget.select()}
          aria-invalid={errorServidor || errorLocal ? true : undefined}
          aria-describedby={mensaje || supera ? idMensaje : undefined}
          className={`h-11 w-16 border-y bg-white text-center text-base font-semibold text-slate-900 tabular-nums focus:relative focus:z-10 focus:outline-2 focus:outline-offset-0 focus:outline-marino-500 ${
            errorServidor || errorLocal ? "border-coral-700" : "border-slate-300"
          }`}
        />
        <button
          type="button"
          onClick={() => alCambiar(String(n + 1))}
          className={`${boton} rounded-r-[var(--radius-control)]`}
          aria-label={`Agregar una unidad de ${p.nombre}`}
        >
          <Plus aria-hidden className="size-4" />
        </button>
      </div>

      <p className="col-start-2 row-start-2 text-right font-semibold text-slate-900 tabular-nums sm:col-start-3 sm:row-start-1">
        <span className="sr-only">Subtotal: </span>
        {formatoSoles(subtotal)}
      </p>

      <button
        type="button"
        onClick={alQuitar}
        className="col-start-2 row-start-1 -mr-2 grid size-11 place-items-center justify-self-end rounded-lg text-slate-500 transition-colors duration-150 hover:bg-coral-50 hover:text-coral-700 sm:col-start-4"
        aria-label={`Quitar ${p.nombre} del pedido`}
      >
        <Trash2 aria-hidden className="size-4" />
      </button>

      {(mensaje || supera) && (
        <p
          id={idMensaje}
          className={`col-span-full flex items-start gap-1.5 text-sm ${mensaje ? "font-medium text-coral-700" : "text-ambar-800"}`}
        >
          {mensaje ? (
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          ) : (
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          )}
          {mensaje ?? `Supera el stock disponible (${formatoNumero(p.stock)} ${p.unidad}). El servidor lo rechazará.`}
        </p>
      )}
    </li>
  );
}

/* ───────────────────────── Condición de pago ───────────────────────── */

function SelectorCondicion({ valor, alCambiar, error }: { valor: CondicionPago; alCambiar: (c: CondicionPago) => void; error?: string }) {
  return (
    <fieldset>
      <legend className="sr-only">Condición de pago</legend>
      <OpcionesSegmentadas opciones={OPCIONES_CONDICION} valor={valor} alCambiar={alCambiar} />
      {error && <p className="campo-error">{error}</p>}
    </fieldset>
  );
}

/* ───────────────────────── Página ───────────────────────── */

export default function NuevoPedidoPage() {
  const navigate = useNavigate();
  const notificar = useNotificar();
  const qc = useQueryClient();

  const [cliente, setCliente] = useState<ClienteVenta | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [condicion, setCondicion] = useState<CondicionPago>("CONTADO");

  const [errCliente, setErrCliente] = useState<string>();
  const [errLineas, setErrLineas] = useState<string>();
  const [errCondicion, setErrCondicion] = useState<string>();
  const [errPorProducto, setErrPorProducto] = useState<Record<number, string>>({});
  const [errLocalPorProducto, setErrLocalPorProducto] = useState<Record<number, string>>({});
  const [errGeneral, setErrGeneral] = useState<string | null>(null);

  const refCliente = useRef<HTMLInputElement>(null);
  const refProducto = useRef<HTMLInputElement>(null);
  const refAviso = useRef<HTMLDivElement>(null);
  const refsCantidad = useRef(new Map<number, HTMLInputElement>());
  const [enfocar, setEnfocar] = useState<{ destino: "cliente" | "producto" | number } | null>(null);

  // El foco se mueve después de que React pinta el cambio (el input puede no existir antes).
  useEffect(() => {
    if (!enfocar) return;
    const { destino } = enfocar;
    const el = destino === "cliente" ? refCliente.current : destino === "producto" ? refProducto.current : refsCantidad.current.get(destino);
    el?.focus();
    if (typeof destino === "number") el?.scrollIntoView({ block: "center", behavior: "smooth" });
    setEnfocar(null);
  }, [enfocar]);

  const enPedido = new Set(lineas.map((l) => l.producto.id));
  const totalCentimos = lineas.reduce((s, l) => s + centimos(l.producto.precio) * cantidadDe(l), 0);
  const total = totalCentimos / 100;
  const unidades = lineas.reduce((s, l) => s + cantidadDe(l), 0);
  const automatica = condicion === "CONTADO" && total <= LIMITE_APROBACION_AUTOMATICA;

  function elegirCliente(c: ClienteVenta | null) {
    setCliente(c);
    setErrCliente(undefined);
    setEnfocar({ destino: c ? "producto" : "cliente" });
  }

  function agregar(p: ProductoVenta) {
    setErrLineas(undefined);
    if (!enPedido.has(p.id)) setLineas((ls) => [...ls, { producto: p, cantidad: "1" }]);
    else setLineas((ls) => ls.map((l) => (l.producto.id === p.id ? { ...l, producto: { ...l.producto, stock: p.stock } } : l)));
    setEnfocar({ destino: p.id });
  }

  function limpiarErrorDe(pid: number) {
    if (pid in errLocalPorProducto) setErrLocalPorProducto(sin(errLocalPorProducto, pid));
    if (pid in errPorProducto) {
      const resto = sin(errPorProducto, pid);
      setErrPorProducto(resto);
      // Corregidas todas las líneas señaladas, el aviso del servidor ya no aplica.
      if (Object.keys(resto).length === 0) setErrGeneral(null);
    }
  }

  function cambiarCantidad(pid: number, cantidad: string) {
    setLineas((ls) => ls.map((l) => (l.producto.id === pid ? { ...l, cantidad } : l)));
    limpiarErrorDe(pid);
  }

  function quitar(pid: number) {
    setLineas((ls) => ls.filter((l) => l.producto.id !== pid));
    refsCantidad.current.delete(pid);
    limpiarErrorDe(pid);
    setEnfocar({ destino: "producto" });
  }

  const registrar = useMutation({
    mutationFn: (cuerpo: CuerpoPedido) => api.post<PedidoDetalle>("/pedidos", cuerpo),
    onSuccess: (d) => {
      qc.setQueryData(["pedido", d.id], d);
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      const estado = d.estado === "APROBADO" && d.aprobacionAutomatica ? "Aprobado automáticamente" : "Pendiente de aprobación";
      notificar(`Pedido ${d.codigo} registrado (${estado})`);
      navigate(`/pedidos/${d.id}`);
    },
    onError: (err, cuerpo) => {
      if (!(err instanceof ApiError)) {
        setErrGeneral("No se pudo registrar el pedido. Intente de nuevo.");
        return;
      }
      const porProducto: Record<number, string> = {};
      for (const [clave, msg] of Object.entries(err.campos ?? {})) {
        const m = /^lineas\.(\d+)\.(cantidad|productoId)$/.exec(clave);
        const pid = m ? cuerpo.lineas[Number(m[1])]?.productoId : undefined;
        if (pid !== undefined) porProducto[pid] = msg;
      }
      // 409 STOCK_INSUFICIENTE: además del mensaje, se actualiza el stock mostrado de cada producto.
      const faltas = (err.datos.productos as FaltaStock[] | undefined) ?? [];
      for (const f of faltas) porProducto[f.productoId] ??= `Stock disponible: ${formatoNumero(f.stockDisponible)}`;
      if (faltas.length) {
        const stock = new Map(faltas.map((f) => [f.productoId, f.stockDisponible]));
        setLineas((ls) =>
          ls.map((l) => (stock.has(l.producto.id) ? { ...l, producto: { ...l.producto, stock: stock.get(l.producto.id)! } } : l)),
        );
      }
      setErrPorProducto(porProducto);
      setErrCliente(err.campos?.clienteId);
      setErrLineas(err.campos?.lineas);
      setErrCondicion(err.campos?.condicionPago);
      setErrGeneral(err.message);
      requestAnimationFrame(() => refAviso.current?.scrollIntoView({ block: "center", behavior: "smooth" }));
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (registrar.isPending) return;
    setErrGeneral(null);
    setErrPorProducto({});

    const locales: Record<number, string> = {};
    for (const l of lineas) if (cantidadDe(l) < 1) locales[l.producto.id] = "Ingrese una cantidad mayor que 0";
    setErrLocalPorProducto(locales);
    const faltaCliente = !cliente;
    const faltanLineas = lineas.length === 0;
    setErrCliente(faltaCliente ? "Elija el cliente del pedido" : undefined);
    setErrLineas(faltanLineas ? "Agregue al menos un producto" : undefined);

    if (faltaCliente) return setEnfocar({ destino: "cliente" });
    if (faltanLineas) return setEnfocar({ destino: "producto" });
    const primera = lineas.find((l) => locales[l.producto.id]);
    if (primera) return setEnfocar({ destino: primera.producto.id });

    registrar.mutate({
      clienteId: cliente!.id,
      condicionPago: condicion,
      lineas: lineas.map((l) => ({ productoId: l.producto.id, cantidad: cantidadDe(l) })),
    });
  }

  const textoLineas = `${lineas.length} ${lineas.length === 1 ? "línea" : "líneas"}`;
  const botonRegistrar = (
    <button type="submit" disabled={registrar.isPending} className="btn-primario w-full">
      {registrar.isPending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}
      {registrar.isPending ? "Registrando…" : "Registrar pedido"}
    </button>
  );

  return (
    <form onSubmit={enviar} noValidate className="pb-28 lg:pb-0">
      <Encabezado
        titulo="Nuevo pedido"
        descripcion="Elija el cliente, agregue los productos y registre. El stock se descuenta recién al despachar."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
        <div className="min-w-0 space-y-5">
          <Tarjeta titulo="Cliente">
            <PasoCliente cliente={cliente} alElegir={elegirCliente} error={errCliente} inputRef={refCliente} />
          </Tarjeta>

          <Tarjeta titulo="Productos" descripcion={lineas.length ? `${textoLineas} · ${formatoNumero(unidades)} unidades` : undefined}>
            <BuscadorProducto enPedido={enPedido} alElegir={agregar} error={errLineas} inputRef={refProducto} />

            {errGeneral && (
              <div ref={refAviso} className="mt-4 scroll-mt-24">
                <Aviso tono="error" titulo="No se registró el pedido">
                  {errGeneral}
                </Aviso>
              </div>
            )}

            {lineas.length > 0 && (
              <>
                <ul aria-label="Líneas del pedido" className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
                  {lineas.map((l) => (
                    <FilaLinea
                      key={l.producto.id}
                      linea={l}
                      errorServidor={errPorProducto[l.producto.id]}
                      errorLocal={errLocalPorProducto[l.producto.id]}
                      alCambiar={(c) => cambiarCantidad(l.producto.id, c)}
                      alQuitar={() => quitar(l.producto.id)}
                      inputRef={(el) => {
                        if (el) refsCantidad.current.set(l.producto.id, el);
                      }}
                    />
                  ))}
                </ul>
                <div className="flex items-baseline justify-between gap-4 pt-3">
                  <p className="text-sm text-slate-600">
                    Total referencial
                    <span className="block text-xs text-slate-500">El total definitivo lo calcula el servidor con el precio vigente.</span>
                  </p>
                  <p className="shrink-0 text-lg font-bold whitespace-nowrap text-slate-900 tabular-nums">{formatoSoles(total)}</p>
                </div>
              </>
            )}
          </Tarjeta>

          <Tarjeta titulo="Condición de pago">
            <div className="space-y-3">
              <SelectorCondicion
                valor={condicion}
                alCambiar={(c) => {
                  setCondicion(c);
                  setErrCondicion(undefined);
                }}
                error={errCondicion}
              />
              <Aviso tono={lineas.length && !automatica ? "alerta" : "info"}>
                Los pedidos a crédito o mayores de S/ 2 000 requieren aprobación del gerente; al contado hasta S/ 2 000 se aprueban
                automáticamente.
                {lineas.length > 0 && (
                  <strong className="mt-1 block font-semibold">
                    {automatica
                      ? "Este pedido se aprobará automáticamente al registrarlo."
                      : "Este pedido quedará pendiente de aprobación del gerente."}
                  </strong>
                )}
              </Aviso>
            </div>
          </Tarjeta>
        </div>

        {/* Resumen en escritorio */}
        <aside aria-label="Resumen del pedido" className="hidden lg:sticky lg:top-20 lg:block">
          <Tarjeta titulo="Resumen">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-600">Cliente</dt>
                <dd className="min-w-0 truncate text-right font-medium text-slate-900">{cliente?.razonSocial ?? "Sin elegir"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-600">Líneas</dt>
                <dd className="font-medium text-slate-900 tabular-nums">{lineas.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-600">Condición</dt>
                <dd className="font-medium text-slate-900">{TEXTO_CONDICION[condicion]}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-slate-200 pt-3">
                <dt className="text-slate-600">Total referencial</dt>
                <dd className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{formatoSoles(total)}</dd>
              </div>
            </dl>
            <p className="mt-1 text-xs text-slate-500">El total definitivo lo calcula el servidor con el precio vigente.</p>
            <div className="mt-4">{botonRegistrar}</div>
          </Tarjeta>
        </aside>
      </div>

      {/* Barra fija en celular y tableta: total y botón siempre visibles */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-barra lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-xs text-slate-600">
              Total referencial · {textoLineas}
            </p>
            <p className="text-lg font-bold whitespace-nowrap text-slate-900 tabular-nums">{formatoSoles(total)}</p>
          </div>
          <div className="shrink-0">{botonRegistrar}</div>
        </div>
      </div>
    </form>
  );
}
