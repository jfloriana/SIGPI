import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/cliente";
import { Campo } from "../../components/Campo";
import { ChipActivo, ChipStock } from "../../components/Chip";
import { Dialogo, DialogoConfirmacion } from "../../components/Dialogo";
import { Aviso } from "../../components/Estados";
import { useNotificar } from "../../components/Notificaciones";
import { formatoNumero } from "../../utils/formato";
import {
  NOMBRE_UNIDAD,
  normalizarImporte,
  UNIDADES,
  validarProducto,
  type CampoProducto,
  type Categoria,
  type Producto,
  type Unidad,
  type ValoresProducto,
} from "./tipos";

const CAMPOS: CampoProducto[] = ["codigo", "nombre", "categoriaId", "unidad", "precio", "stockMinimo"];

function valoresIniciales(p: Producto | null): ValoresProducto {
  if (!p)
    return {
      codigo: "",
      nombre: "",
      categoriaId: "",
      unidad: "",
      precio: "",
      stockMinimo: "",
    };
  return {
    codigo: p.codigo,
    nombre: p.nombre,
    categoriaId: String(p.categoria.id),
    unidad: p.unidad,
    precio: p.precio,
    stockMinimo: String(p.stockMinimo),
  };
}

/** Separa los errores de la API: los de campos conocidos van junto al campo, el resto al aviso general. */
function repartirError(err: unknown, conocidos: readonly string[]) {
  if (!(err instanceof ApiError)) return { campos: {}, general: "No se pudo guardar. Intente de nuevo." };
  const campos: Record<string, string> = {};
  const otros: string[] = [];
  for (const [clave, mensaje] of Object.entries(err.campos ?? {})) {
    if (conocidos.includes(clave)) campos[clave] = mensaje;
    else otros.push(mensaje);
  }
  const general = otros.length ? otros.join(" · ") : Object.keys(campos).length ? null : err.message;
  return { campos, general };
}

export function PanelProducto({
  abierto,
  producto,
  categorias,
  alCerrar,
}: {
  abierto: boolean;
  /** `null` = alta de un producto nuevo. */
  producto: Producto | null;
  categorias: Categoria[];
  alCerrar: () => void;
}) {
  const queryClient = useQueryClient();
  const notificar = useNotificar();
  const idForm = useId();
  const idPrecio = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [valores, setValores] = useState<ValoresProducto>(() => valoresIniciales(producto));
  const [errores, setErrores] = useState<Partial<Record<CampoProducto, string>>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [confirmarEstado, setConfirmarEstado] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setValores(valoresIniciales(producto));
    setErrores({});
    setErrorGeneral(null);
  }, [abierto, producto]);

  function enfocarPrimerError() {
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }

  const refrescar = () =>
    Promise.all([queryClient.invalidateQueries({ queryKey: ["productos"] }), queryClient.invalidateQueries({ queryKey: ["categorias"] })]);

  const guardar = useMutation({
    mutationFn: (cuerpo: Record<string, unknown>) =>
      producto ? api.patch<Producto>(`/productos/${producto.id}`, cuerpo) : api.post<Producto>("/productos", cuerpo),
    onSuccess: async (p) => {
      notificar(producto ? `Producto ${p.codigo} actualizado` : `Producto ${p.codigo} creado`);
      await refrescar();
      alCerrar();
    },
    onError: (err) => {
      const { campos, general } = repartirError(err, CAMPOS);
      setErrores(campos);
      setErrorGeneral(general);
      enfocarPrimerError();
    },
  });

  const cambiarEstado = useMutation({
    mutationFn: (activo: boolean) => api.patch<Producto>(`/productos/${producto!.id}`, { activo }),
    onSuccess: async (p) => {
      notificar(p.activo ? `Producto ${p.codigo} reactivado` : `Producto ${p.codigo} desactivado`);
      setConfirmarEstado(false);
      await refrescar();
      alCerrar();
    },
  });

  function cambiar(campo: CampoProducto, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }));
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    setErrorGeneral(null);
    const locales = validarProducto(valores);
    setErrores(locales);
    if (Object.keys(locales).length) {
      enfocarPrimerError();
      return;
    }
    const completo = {
      codigo: valores.codigo.trim().toUpperCase(),
      nombre: valores.nombre.trim(),
      categoriaId: Number(valores.categoriaId),
      unidad: valores.unidad,
      precio: normalizarImporte(valores.precio),
      stockMinimo: Number(valores.stockMinimo),
    };
    if (!producto) {
      guardar.mutate(completo);
      return;
    }
    // Edición: solo los campos que cambiaron (PATCH parcial).
    const cambios: Record<string, unknown> = {};
    if (completo.codigo !== producto.codigo) cambios.codigo = completo.codigo;
    if (completo.nombre !== producto.nombre) cambios.nombre = completo.nombre;
    if (completo.categoriaId !== producto.categoria.id) cambios.categoriaId = completo.categoriaId;
    if (completo.unidad !== producto.unidad) cambios.unidad = completo.unidad;
    if (Number(completo.precio) !== Number(producto.precio)) cambios.precio = completo.precio;
    if (completo.stockMinimo !== producto.stockMinimo) cambios.stockMinimo = completo.stockMinimo;
    if (Object.keys(cambios).length === 0) {
      setErrorGeneral("No hay cambios para guardar.");
      return;
    }
    guardar.mutate(cambios);
  }

  const guardando = guardar.isPending;
  const errorEstado =
    cambiarEstado.error instanceof ApiError ? cambiarEstado.error.message : cambiarEstado.error ? "No se pudo cambiar el estado." : null;

  return (
    <>
      <Dialogo
        abierto={abierto}
        alCerrar={alCerrar}
        variante="panel"
        titulo={producto ? `Editar producto ${producto.codigo}` : "Nuevo producto"}
        descripcion={
          producto
            ? "Los cambios quedan registrados en la bitácora."
            : "El producto se crea con stock 0; el stock se carga con una recepción de compra o un ajuste."
        }
        pie={
          <>
            <button type="button" onClick={alCerrar} className="btn-secundario">
              Cancelar
            </button>
            <button type="submit" form={idForm} disabled={guardando} className="btn-primario">
              {guardando && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
              {guardando ? "Guardando…" : "Guardar producto"}
            </button>
          </>
        }
      >
        <form id={idForm} ref={formRef} onSubmit={enviar} noValidate className="space-y-4">
          {errorGeneral && <Aviso tono="error">{errorGeneral}</Aviso>}

          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <Campo etiqueta="Código" error={errores.codigo} ayuda="Ej.: BEB-012">
              <input
                value={valores.codigo}
                onChange={(e) => cambiar("codigo", e.target.value.toUpperCase())}
                className="campo-control uppercase"
                autoComplete="off"
                maxLength={20}
                spellCheck={false}
              />
            </Campo>
            <Campo etiqueta="Nombre" error={errores.nombre}>
              <input
                value={valores.nombre}
                onChange={(e) => cambiar("nombre", e.target.value)}
                className="campo-control"
                autoComplete="off"
                maxLength={120}
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Categoría" error={errores.categoriaId}>
              <select value={valores.categoriaId} onChange={(e) => cambiar("categoriaId", e.target.value)} className="campo-control">
                <option value="">Seleccione…</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Unidad" error={errores.unidad}>
              <select value={valores.unidad} onChange={(e) => cambiar("unidad", e.target.value as Unidad)} className="campo-control">
                <option value="">Seleccione…</option>
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {u} · {NOMBRE_UNIDAD[u]}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Campo con prefijo «S/»: el componente Campo no admite adornos, se replica su estructura. */}
            <div>
              <label htmlFor={idPrecio} className="campo-etiqueta">
                Precio de venta
              </label>
              <div className="relative">
                <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-600">
                  S/
                </span>
                <input
                  id={idPrecio}
                  value={valores.precio}
                  onChange={(e) => cambiar("precio", e.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  aria-invalid={errores.precio ? true : undefined}
                  aria-describedby={`${idPrecio}-${errores.precio ? "error" : "ayuda"}`}
                  className="campo-control pl-9 tabular-nums"
                />
              </div>
              {errores.precio ? (
                <p id={`${idPrecio}-error`} className="campo-error">
                  {errores.precio}
                </p>
              ) : (
                <p id={`${idPrecio}-ayuda`} className="mt-1.5 text-sm text-slate-600">
                  Mayor que 0, hasta 2 decimales.
                </p>
              )}
            </div>
            <Campo
              etiqueta="Stock mínimo"
              error={errores.stockMinimo}
              ayuda="Por debajo o igual a este valor, el producto entra en alerta."
            >
              <input
                value={valores.stockMinimo}
                onChange={(e) => cambiar("stockMinimo", e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                className="campo-control tabular-nums"
              />
            </Campo>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            {producto ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-slate-800">Stock actual</span>
                <span className="flex items-center gap-2">
                  <span className="text-slate-600 tabular-nums">
                    {formatoNumero(producto.stock)} {producto.unidad}
                  </span>
                  <ChipStock stock={producto.stock} stockMinimo={producto.stockMinimo} />
                </span>
              </div>
            ) : (
              <p className="font-medium text-slate-800">Stock inicial: 0</p>
            )}
            <p className="mt-1 text-slate-600">El stock cambia solo con movimientos de inventario: despachos, recepciones y ajustes.</p>
          </div>
        </form>

        {producto && (
          <section aria-labelledby={`${idForm}-estado`} className="mt-6 border-t border-slate-200 pt-4">
            <h3 id={`${idForm}-estado`} className="text-sm font-semibold text-slate-900">
              Estado del producto
            </h3>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                <ChipActivo activo={producto.activo} />{" "}
                <span className="ml-1">
                  {producto.activo ? "Un producto inactivo no aparece al registrar pedidos." : "Reactívelo para volver a venderlo."}
                </span>
              </p>
              <button
                type="button"
                onClick={() => {
                  cambiarEstado.reset();
                  setConfirmarEstado(true);
                }}
                className={producto.activo ? "btn-secundario text-coral-700" : "btn-secundario"}
              >
                {producto.activo ? "Desactivar producto" : "Reactivar producto"}
              </button>
            </div>
          </section>
        )}
      </Dialogo>

      {producto && (
        <DialogoConfirmacion
          abierto={confirmarEstado}
          alCerrar={() => setConfirmarEstado(false)}
          titulo={producto.activo ? `¿Desactivar ${producto.codigo}?` : `¿Reactivar ${producto.codigo}?`}
          descripcion={
            producto.activo
              ? `«${producto.nombre}» dejará de ofrecerse en los pedidos nuevos. Su historial y su kardex se conservan.`
              : `«${producto.nombre}» volverá a ofrecerse en los pedidos nuevos.`
          }
          textoConfirmar={producto.activo ? "Sí, desactivar" : "Sí, reactivar"}
          tono={producto.activo ? "peligro" : "primario"}
          procesando={cambiarEstado.isPending}
          error={errorEstado}
          alConfirmar={() => cambiarEstado.mutate(!producto.activo)}
        />
      )}
    </>
  );
}
