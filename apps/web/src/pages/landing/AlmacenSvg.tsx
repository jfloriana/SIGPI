import { useMemo } from "react";
import { CATEGORIAS, ESTANTE, PISO, TAMANO_CAJA, ZONAS, ubicarProductos } from "./datos";
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
  lista.push({ c: [ZONAS.palletRecepcion.x, 0.6, ZONAS.palletRecepcion.z], s: [1, 0.8, 0.9], caras: ["ambar-100", "ambar-100", "ambar"] });
  lista.push({ c: [11.2, 0.6, 4.3], s: [1, 0.8, 0.9], caras: ["teal-100", "teal-100", "teal"] });
  for (const camion of [ZONAS.camionDespacho, ZONAS.camionProveedor]) {
    lista.push({ c: [camion.x, 1.45, camion.z], s: [3.6, 1.9, 1.9], caras: ["blanco", "marino-100", "marino-200"] });
    lista.push({ c: [camion.x + 2.4, 1.1, camion.z], s: [1.2, 1.3, 1.8], caras: ["marino-500", "marino", "marino-800"] });
  }
  for (const c of CATEGORIAS) {
    const p = 0.12;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        lista.push({ c: [c.x + sx * (ESTANTE.ancho / 2 - p / 2), ESTANTE.alto / 2, c.z + sz * (ESTANTE.fondo / 2 - p / 2)], s: [p, ESTANTE.alto, p], caras: ["marino", "marino", "marino-800"] });
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
  lista.sort((a, b) => a.c[0] + a.c[2] - (b.c[0] + b.c[2]) || a.c[1] - b.c[1]);
  return [...base, ...lista];
}

export function AlmacenSvg({ className = "" }: { className?: string }) {
  const { poligonos, rotulos, caja } = useMemo(() => {
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
    const m = 0.6;
    return { poligonos, rotulos, caja: `${minX - m} ${minY - m - 1} ${maxX - minX + 2 * m} ${maxY - minY + 2 * m + 1}` };
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
    </svg>
  );
}
