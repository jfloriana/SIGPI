import { useQuery } from "@tanstack/react-query";
import { FileClock } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";
import { api } from "../../api/cliente";
import { useUsuario } from "../../auth/AuthContext";
import { Aviso } from "../../components/Estados";
import { Encabezado } from "../../components/Encabezado";
import { Tabla, type Columna } from "../../components/Tabla";
import { Tarjeta } from "../../components/Tarjeta";
import { formatoNumero } from "../../utils/formato";
import { BarraStock } from "./componentes";
import type { Alerta } from "./tipos";

export default function AlertasPage() {
  const { rol } = useUsuario();
  // Misma matriz que la API: solo ADMIN y GERENTE crean órdenes de compra.
  const creaOrden = rol === "GERENTE" || rol === "ADMIN";
  const idTodos = useId();

  const alertas = useQuery({
    queryKey: ["inventario", "alertas"],
    queryFn: () => api.get<{ datos: Alerta[]; total: number }>("/inventario/alertas"),
  });

  const [elegidos, setElegidos] = useState<Set<number>>(new Set());
  const filas = alertas.data?.datos;
  // Solo cuentan los elegidos que siguen en alerta (la lista puede cambiar al refrescar).
  const vigentes = filas?.filter((a) => elegidos.has(a.id)) ?? [];
  const todos = !!filas?.length && vigentes.length === filas.length;

  function alternar(id: number) {
    setElegidos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const destinoOc = vigentes.length
    ? `/compras?sugerida=1&productos=${vigentes.map((a) => a.id).join(",")}`
    : "/compras?sugerida=1";

  const columnas: Columna<Alerta>[] = [];
  if (creaOrden) {
    columnas.push({
      titulo: "Incluir",
      celda: (a) => (
        <label className="-my-2 -ml-2 inline-grid size-11 cursor-pointer place-items-center rounded-lg hover:bg-slate-100">
          <input type="checkbox" checked={elegidos.has(a.id)} onChange={() => alternar(a.id)} className="size-4" />
          <span className="sr-only">Incluir {a.codigo} en la orden sugerida</span>
        </label>
      ),
    });
  }
  columnas.push(
    {
      titulo: "Producto",
      celda: (a) => (
        <div className="max-w-[15rem] min-w-[10rem] whitespace-normal md:max-w-xs">
          <span className="block font-medium text-slate-900 tabular-nums">{a.codigo}</span>
          <span className="text-slate-800">{a.nombre}</span>
          <span className="mt-0.5 block text-xs text-slate-600 md:hidden">{a.categoria.nombre}</span>
          {/* En celular, la barra, lo sugerido y el enlace van bajo el producto (sin desplazar la tabla). */}
          <div className="mt-3 space-y-2 md:hidden">
            <BarraStock stock={a.stock} stockMinimo={a.stockMinimo} unidad={a.unidad} />
            <p className="text-sm text-slate-700">
              Sugerido: <strong className="font-semibold text-slate-900 tabular-nums">{formatoNumero(a.cantidadSugerida)}</strong> {a.unidad}
            </p>
            <Link
              to={`/kardex?productoId=${a.id}`}
              className="-ml-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-marino transition-colors duration-150 hover:bg-marino-50 hover:underline"
            >
              Ver kardex<span className="sr-only"> de {a.codigo}</span>
            </Link>
          </div>
        </div>
      ),
    },
    {
      titulo: "Categoría",
      ocultarEnMovil: true,
      celda: (a) => <span className="whitespace-nowrap">{a.categoria.nombre}</span>,
    },
    {
      titulo: "Stock frente al mínimo",
      ocultarEnMovil: true,
      celda: (a) => <BarraStock stock={a.stock} stockMinimo={a.stockMinimo} unidad={a.unidad} />,
    },
    {
      titulo: "Cantidad sugerida",
      alinear: "derecha",
      ocultarEnMovil: true,
      celda: (a) => (
        <span className="whitespace-nowrap">
          <strong className="font-semibold text-slate-900">{formatoNumero(a.cantidadSugerida)}</strong>{" "}
          <span className="text-slate-600">{a.unidad}</span>
        </span>
      ),
    },
    {
      titulo: "Acciones",
      alinear: "derecha",
      ocultarEnMovil: true,
      celda: (a) => (
        <Link
          to={`/kardex?productoId=${a.id}`}
          className="btn-fantasma"
        >
          Ver kardex<span className="sr-only"> de {a.codigo}</span>
        </Link>
      ),
    },
  );

  const total = alertas.data?.total ?? 0;

  return (
    <>
      <Encabezado
        titulo="Alertas de stock"
        descripcion="Productos activos con stock menor o igual a su stock mínimo, del más crítico al menos crítico. La cantidad sugerida repone hasta el doble del mínimo (mínimo × 2 − stock)."
        acciones={
          creaOrden && total > 0 ? (
            <Link to={destinoOc} className="btn-primario">
              <FileClock aria-hidden className="size-4" />
              Generar orden de compra sugerida
              {vigentes.length > 0 && <span className="tabular-nums">({vigentes.length})</span>}
            </Link>
          ) : undefined
        }
      />

      <div className="space-y-4">
        {!creaOrden && total > 0 && (
          <Aviso tono="info">
            La orden de compra sugerida la genera el gerente a partir de estas alertas. El almacén la recepciona cuando
            llega la mercadería.
          </Aviso>
        )}

        <Tarjeta
          sinRelleno
          titulo={alertas.data ? `${total} ${total === 1 ? "producto en alerta" : "productos en alerta"}` : "Productos en alerta"}
          descripcion={
            creaOrden && total > 0
              ? vigentes.length
                ? `${vigentes.length} elegidos para la orden sugerida.`
                : "Sin elegir ninguno, la orden sugerida incluye todos."
              : undefined
          }
          acciones={
            creaOrden && total > 0 ? (
              <label
                htmlFor={idTodos}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                <input
                  id={idTodos}
                  type="checkbox"
                  checked={todos}
                  ref={(el) => {
                    if (el) el.indeterminate = vigentes.length > 0 && !todos;
                  }}
                  onChange={() => setElegidos(todos ? new Set() : new Set(filas?.map((a) => a.id)))}
                  className="size-4"
                />
                Elegir todos
              </label>
            ) : undefined
          }
        >
          <Tabla
            descripcion="Productos en alerta de stock, del más crítico al menos crítico"
            columnas={columnas}
            filas={filas}
            claveFila={(a) => a.id}
            cargando={alertas.isFetching}
            error={alertas.error}
            reintentar={() => alertas.refetch()}
            vacio={{
              titulo: "Ningún producto en alerta",
              descripcion: "Todos los productos activos tienen stock por encima de su mínimo.",
            }}
          />
        </Tarjeta>
      </div>
    </>
  );
}
