import { useMemo } from "react";
import { CATEGORIAS, ESTANTE, PEDIDO_DEMO, PISO, PRODUCTO_ALERTA, TAMANO_CAJA, ZONAS, ubicarProductos } from "./datos";
import { leerPaleta, type Token } from "./paleta";

/**
 * Respaldo sin WebGL: el mismo almacén dibujado como ilustración isométrica en SVG,
 * generado desde los mismos datos que la escena 3D.
 */

interface Prisma {
  c: [number, number, number];
  s: [number, number, number];
  /** Colores de las caras: superior, frontal (+z) y lateral (+x). */
  caras: [Token, Token, Token];
  /** Profundidad común de un objeto compuesto (camión, montacargas): sus piezas se pintan en el orden en que se agregan. */
  grupo?: number;
}

const COS = Math.cos(Math.PI / 6);
const SEN = Math.sin(Math.PI / 6);
const proyectar = (x: number, y: number, z: number): [number, number] => [(x - z) * COS, (x + z) * SEN - y];

function prismas(): Prisma[] {
  // Base (piso, muros y zonas planas) en orden fijo; luego los volúmenes, ordenados por profundidad.
  const base: Prisma[] = [];
  const lista: Prisma[] = [];
  const { x0, x1, z0, z1 } = PISO;
  base.push({ c: [0, -0.25, 0], s: [x1 - x0, 0.5, z1 - z0], caras: ["blanco", "marino-200", "marino-100"] });
  base.push({ c: [0, 1.15, z0 - 0.15], s: [x1 - x0, 2.3, 0.3], caras: ["marino", "marino-600", "marino-500"] });
  base.push({ c: [x0 - 0.15, 1.15, -0.15], s: [0.3, 2.3, z1 - z0 + 0.3], caras: ["marino", "marino-600", "marino-500"] });
  const { anden, recepcion, escritorio } = ZONAS;
  base.push({ c: [(anden.x0 + anden.x1) / 2, 0.11, (anden.z0 + anden.z1) / 2], s: [anden.x1 - anden.x0, 0.22, anden.z1 - anden.z0], caras: ["teal", "teal-700", "teal-800"] });
  base.push({ c: [(recepcion.x0 + recepcion.x1) / 2, 0.08, (recepcion.z0 + recepcion.z1) / 2], s: [recepcion.x1 - recepcion.x0, 0.16, recepcion.z1 - recepcion.z0], caras: ["marino-100", "marino-200", "marino-200"] });
  lista.push({ c: [escritorio.x, 0.5, escritorio.z], s: [2.6, 1, 0.9], caras: ["blanco", "marino-600", "marino"] });
  lista.push({ c: [ZONAS.aprobado.x, 0.45, ZONAS.aprobado.z], s: [1, 0.8, 0.9], caras: ["marino-100", "marino-200", "marino-500"] });
  lista.push({ c: [ZONAS.anulado.x, 0.45, ZONAS.anulado.z], s: [1, 0.8, 0.9], caras: ["coral-100", "coral", "coral-700"] });
  lista.push({ c: [ZONAS.palletRecepcion.x, 0.6, ZONAS.palletRecepcion.z], s: [1, 0.8, 0.9], caras: ["ambar-100", "ambar-100", "ambar-100"] });
  // Marca de piso ámbar bajo el estante en alerta (ACE).
  const ace = CATEGORIAS.find((c) => c.codigo === "ACE")!;
  base.push({ c: [ace.x, 0.02, ace.z], s: [ESTANTE.ancho + 0.8, 0.04, ESTANTE.fondo + 0.8], caras: ["ambar", "ambar", "ambar"] });

  // Montacargas en el andén, con el pedido PED-000123 en las uñas (mirando hacia +x).
  const m = { x: 10.2, z: 4.3 };
  const g = m.x + m.z;
  const pieza = (c: [number, number, number], s: [number, number, number], caras: [Token, Token, Token]) =>
    lista.push({ c: [m.x + c[0], c[1], m.z + c[2]], s, caras, grupo: g });
  pieza([-0.6, 0.55, 0], [0.5, 0.5, 0.86], ["teal-700", "teal-800", "teal-800"]);
  pieza([-0.5, 1.25, -0.38], [0.07, 1.1, 0.07], ["marino-900", "marino-900", "marino-900"]);
  pieza([0.3, 1.25, -0.38], [0.07, 1.1, 0.07], ["marino-900", "marino-900", "marino-900"]);
  pieza([-0.15, 0.45, 0], [1.3, 0.5, 0.9], ["teal", "teal-700", "teal-800"]);
  pieza([-0.2, 0.85, 0], [0.36, 0.3, 0.5], ["marino-900", "marino-900", "marino-900"]);
  pieza([-0.5, 1.25, 0.38], [0.07, 1.1, 0.07], ["marino-900", "marino-900", "marino-900"]);
  pieza([0.3, 1.25, 0.38], [0.07, 1.1, 0.07], ["marino-900", "marino-900", "marino-900"]);
  pieza([-0.1, 1.84, 0], [0.95, 0.07, 0.9], ["teal-700", "teal-800", "teal-800"]);
  pieza([0.25, 0.2, 0.47], [0.36, 0.36, 0.14], ["marino-900", "marino-900", "marino-900"]);
  pieza([-0.6, 0.2, 0.47], [0.36, 0.36, 0.14], ["marino-900", "marino-900", "marino-900"]);
  pieza([0.6, 0.95, -0.3], [0.1, 1.9, 0.1], ["marino", "marino", "marino-800"]);
  pieza([0.6, 0.95, 0.3], [0.1, 1.9, 0.1], ["marino", "marino", "marino-800"]);
  pieza([1.2, 0.18, 0], [1.1, 0.12, 1.0], ["marino-500", "marino-600", "marino-600"]);
  pieza([1.2, 0.55, 0], [1.0, 0.62, 0.9], ["teal-100", "teal-100", "teal"]);
  pieza([1.2, 1.02, 0], [0.5, 0.34, 0.46], ["teal-100", "teal-100", "teal"]);

  // Camiones: furgón con franja, cabina con parabrisas y ruedas.
  for (const [camion, franja] of [
    [ZONAS.camionDespacho, "teal"],
    [ZONAS.camionProveedor, "marino-500"],
  ] as const) {
    const gc = camion.x + camion.z;
    const parte = (c: [number, number, number], s: [number, number, number], caras: [Token, Token, Token]) =>
      lista.push({ c: [camion.x + c[0], c[1], camion.z + c[2]], s, caras, grupo: gc });
    parte([0.6, 0.4, 0], [5.0, 0.2, 1.6], ["marino-900", "marino-900", "marino-900"]);
    parte([0, 1.45, 0], [3.6, 1.9, 1.9], ["blanco", "marino-50", "marino-100"]);
    parte([0, 0.9, 0.96], [3.6, 0.24, 0.02], [franja, franja, franja]);
    parte([2.4, 1.1, 0], [1.2, 1.3, 1.8], ["marino-500", "marino", "marino-800"]);
    parte([2.72, 1.5, 0.02], [0.5, 0.42, 1.8], ["teal-100", "teal-100", "teal-100"]);
    for (const x of [-1.1, 0.2, 2.4]) parte([x, 0.38, 0.95], [0.76, 0.76, 0.12], ["marino-900", "marino-900", "marino-900"]);
  }
  for (const c of CATEGORIAS) {
    const p = 0.12;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const tono: [Token, Token, Token] = c.codigo === "ACE" ? ["ambar", "ambar", "ambar-800"] : ["marino", "marino", "marino-800"];
        lista.push({ c: [c.x + sx * (ESTANTE.ancho / 2 - p / 2), ESTANTE.alto / 2, c.z + sz * (ESTANTE.fondo / 2 - p / 2)], s: [p, ESTANTE.alto, p], caras: tono });
      }
    }
    for (const y of ESTANTE.niveles) {
      lista.push({ c: [c.x, y, c.z], s: [ESTANTE.ancho, 0.08, ESTANTE.fondo], caras: ["marino-500", "marino", "marino-800"] });
    }
    for (const prod of ubicarProductos(c)) {
      const s = TAMANO_CAJA[prod.unidad];
      lista.push({
        c: [prod.x, prod.y, prod.z],
        s,
        caras: prod.alerta ? ["ambar-100", "ambar", "ambar"] : ["marino-100", "marino-200", "marino-500"],
      });
    }
  }
  // Orden del pintor: primero lo más lejano (menor x + z), luego lo más bajo.
  lista.sort((a, b) => {
    const pa = a.grupo ?? a.c[0] + a.c[2];
    const pb = b.grupo ?? b.c[0] + b.c[2];
    if (pa !== pb) return pa - pb;
    return a.grupo !== undefined && a.grupo === b.grupo ? 0 : a.c[1] - b.c[1];
  });
  return [...base, ...lista];
}

export function AlmacenSvg({ className = "" }: { className?: string }) {
  const { poligonos, rotulos, avisos, caja } = useMemo(() => {
    const paleta = leerPaleta();
    const poligonos: { puntos: string; color: string }[] = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const texto = (pts: [number, number, number][]) =>
      pts
        .map(([x, y, z]) => {
          const [px, py] = proyectar(x, y, z);
          minX = Math.min(minX, px);
          maxX = Math.max(maxX, px);
          minY = Math.min(minY, py);
          maxY = Math.max(maxY, py);
          return `${px.toFixed(2)},${py.toFixed(2)}`;
        })
        .join(" ");
    for (const { c, s, caras } of prismas()) {
      const [x0, x1] = [c[0] - s[0] / 2, c[0] + s[0] / 2];
      const [y0, y1] = [c[1] - s[1] / 2, c[1] + s[1] / 2];
      const [z0, z1] = [c[2] - s[2] / 2, c[2] + s[2] / 2];
      poligonos.push({ puntos: texto([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]), color: paleta[caras[0]] });
      poligonos.push({ puntos: texto([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]), color: paleta[caras[1]] });
      poligonos.push({ puntos: texto([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]]), color: paleta[caras[2]] });
    }
    const rotulos = CATEGORIAS.map((c) => {
      const [x, y] = proyectar(c.x, ESTANTE.alto + 0.5, c.z);
      return { codigo: c.codigo, x, y, alerta: c.codigo === "ACE" };
    });
    const ace = CATEGORIAS.find((c) => c.codigo === "ACE")!;
    const [ax, ay] = proyectar(ace.x, ESTANTE.alto + 1.9, ace.z);
    const [px, py] = proyectar(11.4, 2.6, 4.3);
    const avisos = [
      {
        texto: `${PRODUCTO_ALERTA.nombre} · stock ${PRODUCTO_ALERTA.stock} ≤ mínimo ${PRODUCTO_ALERTA.minimo}`,
        x: ax,
        y: ay,
        fondo: "fill-ambar-50 stroke-ambar-100",
        letra: "fill-ambar-800",
      },
      { texto: `${PEDIDO_DEMO} · DESPACHADO`, x: px, y: py, fondo: "fill-teal-700", letra: "fill-white" },
    ];
    minY = Math.min(minY, ay - 1.8);
    const m = 0.6;
    return { poligonos, rotulos, avisos, caja: `${minX - m} ${minY - m - 1} ${maxX - minX + 2 * m} ${maxY - minY + 2 * m + 1}` };
  }, []);

  return (
    <svg viewBox={caja} className={className} aria-hidden preserveAspectRatio="xMidYMid meet">
      {poligonos.map((p, i) => (
        <polygon key={i} points={p.puntos} fill={p.color} strokeLinejoin="round" />
      ))}
      {rotulos.map((r) => (
        <g key={r.codigo} transform={`translate(${r.x.toFixed(2)} ${r.y.toFixed(2)})`}>
          <rect x={-0.9} y={-0.45} width={1.8} height={0.8} rx={0.18} className={r.alerta ? "fill-ambar-100" : "fill-marino"} />
          <text y={0.13} textAnchor="middle" fontSize={0.48} fontWeight={700} className={r.alerta ? "fill-ambar-800" : "fill-white"}>
            {r.codigo}
          </text>
        </g>
      ))}
      {avisos.map((a) => {
        const ancho = a.texto.length * 0.36 + 1.1;
        return (
          <g key={a.texto} transform={`translate(${a.x.toFixed(2)} ${a.y.toFixed(2)})`}>
            <rect x={-ancho / 2} y={-1.45} width={ancho} height={1.25} rx={0.25} strokeWidth={0.06} className={a.fondo} />
            <text y={-0.6} textAnchor="middle" fontSize={0.66} fontWeight={600} className={a.letra}>
              {a.texto}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
