/**
 * Paleta de la landing, derivada de los tokens de `src/index.css`.
 * Three.js no lee clases de Tailwind: se leen las variables CSS del documento y,
 * si Tailwind no las emitió (solo emite las usadas), se usa el mismo valor del token.
 * Es el único archivo de la landing con valores de color literales.
 */
const RESPALDO = {
  "marino-50": "#eef2f7",
  "marino-100": "#d9e2ed",
  "marino-200": "#b3c4d9",
  "marino-500": "#3d5f8a",
  "marino-600": "#2a4a72",
  marino: "#1f3a5f",
  "marino-800": "#172c48",
  "marino-900": "#0f1e33",
  "teal-50": "#e8f6f4",
  "teal-100": "#c9ebe6",
  teal: "#2a9d8f",
  "teal-700": "#1f7469",
  "teal-800": "#185c53",
  "ambar-50": "#fdf4e3",
  "ambar-100": "#fae4bb",
  ambar: "#e9a23b",
  "ambar-800": "#7d5210",
  "coral-100": "#f5d3c7",
  coral: "#d1603d",
  "coral-700": "#a8452a",
  blanco: "#ffffff",
} as const;

export type Token = keyof typeof RESPALDO;
export type Paleta = Record<Token, string>;

/** Lee los tokens actuales del documento (con respaldo idéntico al de index.css). */
export function leerPaleta(): Paleta {
  const estilos = typeof document !== "undefined" ? getComputedStyle(document.documentElement) : null;
  const paleta = {} as Paleta;
  for (const token of Object.keys(RESPALDO) as Token[]) {
    const valor = token === "blanco" ? "" : estilos?.getPropertyValue(`--color-${token}`).trim();
    paleta[token] = valor || RESPALDO[token];
  }
  return paleta;
}
