import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, Check, CircleX } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { Logo } from "../../components/Logo";
import { AlmacenSvg } from "./AlmacenSvg";
import { CATEGORIAS, CIFRAS, CONCEPTOS, PEDIDO_DEMO, PRODUCTO_ALERTA, TOTAL_ALERTAS, TOTAL_PRODUCTOS, USUARIOS_DEMO } from "./datos";
import { Almacen, hayWebGL } from "./escena/Almacen";
import { leerPaleta } from "./paleta";
import "./landing.css";

gsap.registerPlugin(ScrollTrigger);

type Tono = "codigo" | "alerta" | "info" | "pedido" | "anulado";

interface DefEtiqueta {
  ancla: string;
  estaciones: number[];
  tono: Tono;
  texto: ReactNode;
  /** Rótulos de estante: en celular se omiten para no saturar la escena. */
  soloAncho?: boolean;
  /** Desplazamiento en píxeles (abanico) para que las etiquetas vecinas no se tapen. */
  desfase?: [number, number];
  desfaseMovil?: [number, number];
}

const ESTILO_TONO: Record<Tono, string> = {
  codigo: "rounded-md bg-marino px-1.5 py-0.5 text-xs font-bold tracking-wide text-white lg:text-sm",
  alerta: "rounded-lg border border-ambar-100 bg-ambar-50 px-2.5 py-1.5 text-xs font-semibold text-ambar-800 shadow-md lg:text-sm shadow-marino-900/10",
  info: "rounded-lg border border-marino-100 bg-white px-2.5 py-1.5 text-xs font-medium text-marino-900 shadow-md lg:text-sm shadow-marino-900/10",
  pedido: "rounded-lg bg-teal-700 px-2.5 py-1.5 text-xs font-semibold text-white shadow-md lg:text-sm shadow-marino-900/15",
  anulado: "rounded-lg border border-coral-100 bg-coral-50 px-2.5 py-1.5 text-xs font-semibold text-coral-800 shadow-md lg:text-sm shadow-marino-900/10",
};

const ETIQUETAS: DefEtiqueta[] = [
  ...CATEGORIAS.map<DefEtiqueta>((c) => ({
    ancla: `estante:${c.codigo}`,
    estaciones: [0, 1, 2, 3],
    tono: c.codigo === "ACE" ? "alerta" : "codigo",
    texto: c.codigo,
    soloAncho: true,
  })),
  {
    ancla: "alerta",
    estaciones: [0, 3],
    tono: "alerta",
    texto: `${PRODUCTO_ALERTA.nombre} · stock ${PRODUCTO_ALERTA.stock} ≤ mínimo ${PRODUCTO_ALERTA.minimo}`,
    // A la derecha y arriba de la caja en alerta, para no tapar los rótulos LAC y ACE.
    desfase: [180, -80],
    desfaseMovil: [0, -40],
  },
  { ancla: "pedido", estaciones: [0, 2], tono: "pedido", texto: `${PEDIDO_DEMO} · DESPACHADO` },
  {
    ancla: "escritorio",
    estaciones: [1],
    tono: "info",
    texto: "REGISTRADO · a crédito, espera al gerente",
    desfaseMovil: [-24, -8],
  },
  { ancla: "aprobado", estaciones: [1], tono: "info", texto: "APROBADO por el gerente", desfaseMovil: [-60, 40] },
  { ancla: "anulado", estaciones: [1], tono: "anulado", texto: "ANULADO · con motivo", desfase: [70, 0], desfaseMovil: [60, 44] },
  { ancla: "salida", estaciones: [2], tono: "info", texto: "Una SALIDA en el kardex por cada línea" },
  {
    ancla: "recepcion",
    estaciones: [3],
    tono: "info",
    texto: `OC sugerida: ${PRODUCTO_ALERTA.sugerida} unid. (2 × ${PRODUCTO_ALERTA.minimo} − ${PRODUCTO_ALERTA.stock})`,
  },
  {
    ancla: "proveedor",
    estaciones: [3],
    tono: "info",
    texto: "Recepción · ENTRADA en el kardex",
    desfaseMovil: [0, -58],
  },
];

const ESTACIONES = [
  { id: "estacion-pedidos", nombre: "Pedidos" },
  { id: "estacion-despacho", nombre: "Despacho" },
  { id: "estacion-reposicion", nombre: "Reposición" },
];

function reducirMovimiento() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function LandingPage() {
  const { usuario } = useAuth();
  const [webgl] = useState(hayWebGL);
  const [activa, setActiva] = useState(0);

  const raiz = useRef<HTMLDivElement>(null);
  const escenario = useRef<HTMLDivElement>(null);
  const velo = useRef<HTMLDivElement>(null);
  const globo = useRef<HTMLDivElement>(null);
  const etiquetas = useRef<(HTMLDivElement | null)[]>([]);
  const secciones = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const contenedor = escenario.current;
    if (!raiz.current || !contenedor) return;

    const mm = gsap.matchMedia(raiz.current);
    mm.add(
      { reducido: "(prefers-reduced-motion: reduce)", completo: "(prefers-reduced-motion: no-preference)" },
      (ctx) => {
        const reducido = Boolean(ctx.conditions?.reducido);
        const almacen = webgl
          ? new Almacen({ contenedor, paleta: leerPaleta(), movimientoReducido: reducido, globo: globo.current })
          : null;
        almacen?.registrarEtiquetas(
          ETIQUETAS.map((d, i) => ({
            el: etiquetas.current[i]!,
            ancla: d.ancla,
            estaciones: d.estaciones,
            desfase: d.desfase,
            desfaseMovil: d.desfaseMovil,
          })),
        );

        // El scroll recorre las tres estaciones: cada sección aporta un tramo de 0 a 1.
        const avance = [0, 0, 0];
        const aplicar = () => {
          const total = avance[0] + avance[1] + avance[2];
          almacen?.irA(total);
          setActiva(Math.round(total));
          if (velo.current) velo.current.style.opacity = String(Math.max(0, 1 - total * 1.6));
        };
        secciones.current.forEach((seccion, i) => {
          if (!seccion) return;
          ScrollTrigger.create({
            trigger: seccion,
            start: "top 85%",
            end: "top 20%",
            onUpdate: (st) => {
              avance[i] = st.progress;
              aplicar();
            },
            onRefresh: (st) => {
              avance[i] = st.progress;
              aplicar();
            },
          });
        });

        if (!reducido) {
          // Única entrada coreografiada: el texto de la portada ya es visible y solo se asienta.
          gsap.from("[data-entrada]", { y: 14, opacity: 0.25, duration: 0.9, ease: "expo.out", stagger: 0.07 });
        }

        return () => almacen?.destruir();
      },
    );
    return () => mm.revert();
  }, [webgl]);

  function irAEstacion(e: MouseEvent<HTMLAnchorElement>, id: string) {
    const destino = document.getElementById(id);
    if (!destino) return;
    e.preventDefault();
    destino.scrollIntoView({ behavior: reducirMovimiento() ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  }

  const destino = usuario ? { to: "/inicio", texto: "Ir a mi panel" } : { to: "/login", texto: "Ingresar al demo" };

  return (
    <div ref={raiz} className="landing bg-white text-slate-900">
      <div className="relative">
        {/* Escenario: el almacén queda fijo mientras el texto recorre las estaciones. */}
        <div className="sticky top-0 h-dvh overflow-hidden bg-linear-to-b from-marino-50 via-marino-50 to-white">
          <div ref={escenario} className="absolute inset-0">
            {!webgl && (
              <AlmacenSvg className="absolute inset-x-0 bottom-[6%] mx-auto h-[52%] w-full max-w-5xl md:bottom-auto md:left-auto md:right-[2%] md:top-[14%] md:h-[72%] md:w-[62%]" />
            )}
          </div>
          <div
            ref={velo}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[58%] bg-linear-to-b from-marino-50 via-marino-50/85 to-transparent md:inset-y-0 md:right-auto md:h-auto md:w-[48rem] md:bg-linear-to-r"
          />
          {webgl && (
            <div aria-hidden className="pointer-events-none absolute inset-0">
              {ETIQUETAS.map((d, i) => (
                <div
                  key={d.ancla}
                  ref={(el) => {
                    etiquetas.current[i] = el;
                  }}
                  className="landing-etiqueta"
                >
                  <span data-guia className={`landing-guia ${d.soloAncho ? "max-md:hidden" : ""}`} />
                  <div data-chip className={`relative whitespace-nowrap ${ESTILO_TONO[d.tono]} ${d.soloAncho ? "max-md:hidden" : ""}`}>
                    {d.texto}
                  </div>
                </div>
              ))}
              <div ref={globo} className="landing-etiqueta">
                <div data-chip className="relative rounded-lg bg-marino-900 px-3 py-2 text-white shadow-lg shadow-marino-900/25">
                  <p data-nombre className="text-sm font-semibold whitespace-nowrap" />
                  <p data-detalle className="text-xs whitespace-nowrap text-marino-100" />
                </div>
              </div>
            </div>
          )}

          <nav aria-label="Estaciones del recorrido" className="absolute right-4 bottom-4 hidden lg:block">
            <ol className="flex gap-1 rounded-xl border border-marino-100 bg-white/90 p-1 shadow-md shadow-marino-900/10">
              {ESTACIONES.map((e, i) => (
                <li key={e.id}>
                  <a
                    href={`#${e.id}`}
                    onClick={(ev) => irAEstacion(ev, e.id)}
                    aria-current={activa === i + 1 ? "step" : undefined}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors duration-200 ${
                      activa === i + 1 ? "bg-marino text-white" : "text-marino-900 hover:bg-marino-50"
                    }`}
                  >
                    <span className="tabular-nums">{i + 1}</span>
                    {e.nombre}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>

        {/* Capa de contenido: deja pasar el puntero al almacén salvo en los paneles. */}
        <div className="pointer-events-none relative -mt-[100dvh]">
          <header className="flex min-h-dvh flex-col px-4 pt-5 pb-8 sm:px-8 lg:px-12 lg:pt-8">
            <div data-entrada className="pointer-events-auto flex items-center gap-3 self-start">
              <Logo className="size-10" />
              <div className="leading-tight">
                <p className="text-lg font-bold text-marino">SIGPI</p>
                <p className="text-sm text-slate-600">DistriNorte S.A.C. · Trujillo</p>
              </div>
            </div>

            <div className="pointer-events-auto mt-8 max-w-2xl lg:mt-[12dvh]">
              <h1
                data-entrada
                className="text-[1.7rem] leading-[1.1] font-bold tracking-tight text-balance text-marino-900 sm:text-5xl lg:text-[3.6rem]"
              >
                Del pedido en la bodega
                <br />
                al camión del andén.
              </h1>
              <p data-entrada className="mt-4 max-w-md text-base lg:max-w-[24rem] leading-relaxed text-slate-700 sm:mt-5 sm:text-lg">
                SIGPI gestiona pedidos, inventario y compras de DistriNorte S.A.C., distribuidora de abarrotes de
                Trujillo. Cada regla se aplica en el servidor y queda en la bitácora.
              </p>
              <div data-entrada className="mt-5 flex flex-wrap items-center gap-3 sm:mt-7">
                <Link to={destino.to} className="btn-primario min-h-12 px-5 text-base">
                  {destino.texto}
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
                <a
                  href={`#${ESTACIONES[0].id}`}
                  onClick={(ev) => irAEstacion(ev, ESTACIONES[0].id)}
                  className="btn min-h-12 px-4 text-base text-marino-900 hover:bg-marino-100/70"
                >
                  Recorrer el almacén
                </a>
              </div>
              <p data-entrada className="mt-4 text-sm text-slate-700 sm:mt-6">
                <span className="font-semibold text-marino-900">4 roles:</span> Vendedor · Gerente · Almacenero ·
                Administrador
              </p>
            </div>
          </header>

          <Estacion
            id={ESTACIONES[0].id}
            ref={(el) => {
              secciones.current[0] = el;
            }}
            titulo="Registro y aprobación de pedidos"
          >
            <p>
              El vendedor registra el pedido en la bodega del cliente. El servidor valida cada línea contra el stock
              disponible y calcula el total con el precio vigente.
            </p>
            <ol aria-label="Estados de un pedido" className="mt-4 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
              {["REGISTRADO", "APROBADO", "DESPACHADO", "ENTREGADO"].map((e, i) => (
                <li key={e} className="flex items-center gap-1.5">
                  {i > 0 && <ArrowRight aria-hidden className="size-3 text-slate-500" />}
                  <span className="rounded-md bg-marino-50 px-2 py-1 text-marino-900">{e}</span>
                </li>
              ))}
              <li className="flex items-center gap-1.5">
                <span className="text-slate-600">o</span>
                <span className="rounded-md bg-coral-50 px-2 py-1 text-coral-800">ANULADO</span>
              </li>
            </ol>
            <ul className="mt-4 space-y-2.5">
              <Punto>Al contado y hasta S/ 2 000, se aprueba solo y la bitácora lo anota como aprobación automática.</Punto>
              <Punto>A crédito o por más de S/ 2 000, espera al gerente, que lo aprueba o lo anula con motivo.</Punto>
              <Punto>
                Segregación de funciones: quien vende no aprueba ni despacha; la administradora consulta, pero no aprueba.
              </Punto>
            </ul>
          </Estacion>

          <Estacion
            id={ESTACIONES[1].id}
            ref={(el) => {
              secciones.current[1] = el;
            }}
            titulo="Despacho atómico"
          >
            <p>
              El almacenero despacha el pedido aprobado en una sola transacción: vuelve a verificar el stock de todas las
              líneas, lo descuenta y registra una salida por línea.
            </p>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-teal-50 p-3 text-teal-800">
                <p className="flex items-center gap-1.5 font-semibold">
                  <Check aria-hidden className="size-4" /> Todas con stock
                </p>
                <p className="mt-1">Se confirma todo: DESPACHADO.</p>
              </div>
              <div className="rounded-lg bg-coral-50 p-3 text-coral-800">
                <p className="flex items-center gap-1.5 font-semibold">
                  <CircleX aria-hidden className="size-4" /> Falta en una línea
                </p>
                <p className="mt-1">Se revierte todo: no cambia nada.</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2.5">
              <Punto>El descuento solo ocurre si el stock alcanza: nunca queda negativo, ni con dos despachos a la vez.</Punto>
              <Punto>Estado, stock, kardex y bitácora se guardan juntos o no se guardan.</Punto>
            </ul>
          </Estacion>

          <Estacion
            id={ESTACIONES[2].id}
            ref={(el) => {
              secciones.current[2] = el;
            }}
            titulo="Alertas y reposición"
          >
            <p>
              Un producto entra en alerta cuando su stock es menor o igual a su mínimo. El demo arranca con {TOTAL_ALERTAS}{" "}
              productos en alerta.
            </p>
            <ol className="mt-4 space-y-2 text-sm">
              <Paso n={1} tono="ambar">
                {PRODUCTO_ALERTA.nombre}: stock {PRODUCTO_ALERTA.stock} ≤ mínimo {PRODUCTO_ALERTA.minimo}
              </Paso>
              <Paso n={2} tono="marino">
                Orden de compra sugerida: {PRODUCTO_ALERTA.sugerida} unidades (mínimo × 2 − stock)
              </Paso>
              <Paso n={3} tono="teal">
                Recepción: suma stock y registra la entrada en el kardex
              </Paso>
            </ol>
            <p className="mt-4 text-sm text-slate-600">
              El gerente elige el proveedor; el costo se precarga al 80 % del precio de venta, un supuesto del demo.
            </p>
            <p className="mt-2 hidden text-sm text-slate-600 [@media(hover:hover)]:block">
              Pase el puntero por un estante para ver su categoría: {CATEGORIAS.length} categorías, {TOTAL_PRODUCTOS}{" "}
              productos.
            </p>
          </Estacion>
        </div>
      </div>

      <Cierre destino={destino} />
    </div>
  );
}

function Estacion({
  id,
  titulo,
  children,
  ref,
}: {
  id: string;
  titulo: string;
  children: ReactNode;
  ref: (el: HTMLElement | null) => void;
}) {
  return (
    <section id={id} ref={ref} aria-labelledby={`${id}-titulo`} className="relative min-h-[170dvh] px-4 pb-[55dvh] sm:px-8 lg:px-12">
      <div className="pointer-events-auto sticky top-[46dvh] max-w-md rounded-xl border border-marino-100 bg-white p-4 text-sm leading-relaxed sm:text-[0.95rem] text-slate-700 shadow-lg shadow-marino-900/10 sm:p-6 md:top-[16dvh] lg:max-w-[28rem]">
        <h2 id={`${id}-titulo`} className="text-xl leading-tight font-bold tracking-tight text-balance text-marino-900 sm:text-2xl">
          {titulo}
        </h2>
        <div className="mt-2.5">{children}</div>
      </div>
    </section>
  );
}

function Punto({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <Check aria-hidden className="mt-1 size-4 shrink-0 text-teal-700" />
      <span>{children}</span>
    </li>
  );
}

function Paso({ n, tono, children }: { n: number; tono: "ambar" | "marino" | "teal"; children: ReactNode }) {
  const color = {
    ambar: "bg-ambar-100 text-ambar-800",
    marino: "bg-marino-100 text-marino-900",
    teal: "bg-teal-100 text-teal-800",
  }[tono];
  return (
    <li className="flex items-start gap-2.5">
      <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums ${color}`}>{n}</span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

function Cierre({ destino }: { destino: { to: string; texto: string } }) {
  return (
    <>
      <section aria-labelledby="cierre-titulo" className="relative bg-white px-4 pt-20 pb-16 sm:px-8 lg:px-12 lg:pt-28">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div>
            <h2 id="cierre-titulo" className="text-3xl leading-tight font-bold tracking-tight text-balance text-marino-900 sm:text-4xl">
              Entre con cualquiera de los cuatro roles
            </h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-slate-700">
              Cada usuario ve solo su menú. Pruebe a aprobar un pedido como vendedor: el servidor lo rechaza.
            </p>
            <p className="mt-6 text-slate-700">
              Contraseña de todos:{" "}
              <code className="rounded-md bg-marino-50 px-2 py-1 text-base font-semibold text-marino-900">Demo2026!</code>
            </p>
            <Link to={destino.to} className="btn-primario mt-8 min-h-12 px-5 text-base">
              {destino.texto}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>

          <div className="overflow-hidden rounded-xl border border-marino-100">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Usuarios de demostración</caption>
              <thead className="hidden bg-marino-50 text-marino-900 sm:table-header-group">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Usuario
                  </th>
                  <th scope="col" className="hidden px-4 py-3 font-semibold sm:table-cell">
                    Qué hace en el demo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-marino-100">
                {USUARIOS_DEMO.map((u) => (
                  <tr key={u.email} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-marino-900">{u.rol}</p>
                      <p className="break-all text-slate-700">{u.email}</p>
                      <p className="mt-1 text-slate-600 sm:hidden">{u.tarea}</p>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-700 sm:table-cell">{u.tarea}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mx-auto mt-20 max-w-6xl border-t border-marino-100 pt-12 lg:mt-24">
          <h2 className="text-2xl leading-tight font-bold tracking-tight text-marino-900 sm:text-3xl">
            Lo que demuestra del curso
          </h2>
          <dl className="mt-8 grid gap-x-12 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {CONCEPTOS.map((c) => (
              <div key={c.titulo}>
                <dt className="font-semibold text-marino-900">{c.titulo}</dt>
                <dd className="mt-1.5 leading-relaxed text-slate-700">{c.donde}</dd>
              </div>
            ))}
          </dl>

          <ul aria-label="El demo en cifras" className="mt-12 flex flex-wrap gap-x-6 gap-y-3 border-t border-marino-100 pt-8 text-sm text-slate-700">
            {CIFRAS.map(([n, texto]) => (
              <li key={texto}>
                <span className="text-base font-bold text-marino-900 tabular-nums">{n}</span> {texto}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="bg-marino-900 px-4 py-8 text-sm text-marino-100 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>Sistema demo académico · Sistemas de Información Empresarial · Universidad Nacional de Trujillo</p>
          <p className="text-marino-200">DistriNorte S.A.C. es una empresa ficticia creada para este demo.</p>
        </div>
      </footer>
    </>
  );
}
