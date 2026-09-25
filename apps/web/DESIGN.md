---
name: SIGPI
description: Sistema Integrado de Gestión de Pedidos e Inventario de DistriNorte S.A.C. (demo académico)
colors:
  marino-50: "#eef2f7"
  marino-100: "#d9e2ed"
  marino-200: "#b3c4d9"
  marino-500: "#3d5f8a"
  marino-600: "#2a4a72"
  marino: "#1f3a5f"
  marino-800: "#172c48"
  marino-900: "#0f1e33"
  teal-50: "#e8f6f4"
  teal-100: "#c9ebe6"
  teal: "#2a9d8f"
  teal-700: "#1f7469"
  teal-800: "#185c53"
  ambar-50: "#fdf4e3"
  ambar-100: "#fae4bb"
  ambar: "#e9a23b"
  ambar-800: "#7d5210"
  coral-50: "#fbede8"
  coral-100: "#f5d3c7"
  coral: "#d1603d"
  coral-700: "#a8452a"
  coral-800: "#8a3820"
  blanco: "#ffffff"
  slate-50: "oklch(98.4% 0.003 247.858)"
  slate-100: "oklch(96.8% 0.007 247.896)"
  slate-200: "oklch(92.9% 0.013 255.508)"
  slate-300: "oklch(86.9% 0.022 252.894)"
  slate-500: "oklch(55.4% 0.046 257.417)"
  slate-600: "oklch(44.6% 0.043 257.281)"
  slate-700: "oklch(37.2% 0.044 257.287)"
  slate-800: "oklch(27.9% 0.041 260.031)"
  slate-900: "oklch(20.8% 0.042 265.755)"
typography:
  display:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.7rem (móvil) / 3rem (sm) / 3.6rem (lg)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.333
    letterSpacing: "-0.025em"
  title:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.556
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  body-landing:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.333
    letterSpacing: "0.025em"
rounded:
  etiqueta: "6px"
  control: "8px"
  contenedor: "12px"
  pastilla: "9999px"
spacing:
  hueco-sm: "8px"
  hueco-md: "12px"
  tarjeta: "16px"
  tarjeta-ancha: "20px"
  pagina: "24px"
  pagina-ancha: "32px"
  toque: "44px"
components:
  button-primary:
    backgroundColor: "{colors.teal-700}"
    textColor: "{colors.blanco}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "{spacing.toque}"
  button-primary-hover:
    backgroundColor: "{colors.teal-800}"
  button-secondary:
    backgroundColor: "{colors.blanco}"
    textColor: "{colors.slate-800}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "{spacing.toque}"
  button-secondary-hover:
    backgroundColor: "{colors.slate-50}"
  button-danger:
    backgroundColor: "{colors.coral-700}"
    textColor: "{colors.blanco}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "{spacing.toque}"
  button-danger-hover:
    backgroundColor: "{colors.coral-800}"
  input:
    backgroundColor: "{colors.blanco}"
    textColor: "{colors.slate-900}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "{spacing.toque}"
  chip-teal:
    backgroundColor: "{colors.teal-50}"
    textColor: "{colors.teal-800}"
    typography: "{typography.label}"
    rounded: "{rounded.pastilla}"
    padding: "2px 10px"
  chip-ambar:
    backgroundColor: "{colors.ambar-50}"
    textColor: "{colors.ambar-800}"
    rounded: "{rounded.pastilla}"
    padding: "2px 10px"
  chip-coral:
    backgroundColor: "{colors.coral-50}"
    textColor: "{colors.coral-800}"
    rounded: "{rounded.pastilla}"
    padding: "2px 10px"
  chip-marino:
    backgroundColor: "{colors.marino-50}"
    textColor: "{colors.marino}"
    rounded: "{rounded.pastilla}"
    padding: "2px 10px"
  chip-neutro:
    backgroundColor: "{colors.slate-100}"
    textColor: "{colors.slate-700}"
    rounded: "{rounded.pastilla}"
    padding: "2px 10px"
  card:
    backgroundColor: "{colors.blanco}"
    rounded: "{rounded.contenedor}"
    padding: "{spacing.tarjeta}"
  nav-sidebar:
    backgroundColor: "{colors.marino}"
    textColor: "{colors.marino-100}"
    width: "256px"
  nav-item-active:
    textColor: "{colors.blanco}"
    rounded: "{rounded.control}"
    height: "{spacing.toque}"
  rotulo-estante:
    backgroundColor: "{colors.marino}"
    textColor: "{colors.blanco}"
    rounded: "{rounded.etiqueta}"
    padding: "2px 6px"
  rotulo-pedido:
    backgroundColor: "{colors.teal-700}"
    textColor: "{colors.blanco}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
  panel-estacion:
    backgroundColor: "{colors.blanco}"
    textColor: "{colors.slate-700}"
    rounded: "{rounded.contenedor}"
    padding: "24px"
---

# Design System: SIGPI

## Overview

**Creative North Star: "El almacén a la vista"**

SIGPI es un solo mundo con dos intensidades. La landing pública (superficie Persuade) *es* el almacén de DistriNorte: un almacén isométrico low-poly de volúmenes planos, construido por código, donde la estructura es marino, las cajas marino claro, el andén y las rutas verde azulado, el producto en alerta pulsa en ámbar y el pedido anulado es coral. El sistema de gestión (superficie Operate) toma exactamente la misma paleta y la misma tipografía, pero la baja a una herramienta densa y tranquila: superficies blancas con borde sobre fondo pizarra claro, una barra lateral marino y color reservado para estados.

El color nunca decora: cada tono de la especificación carga un significado de negocio (estructura, acción/éxito, alerta, anulación) y lo mantiene en ambas superficies. La profundidad en Operate viene de bordes y tono, no de sombras; en la landing, los paneles y rótulos flotan sobre la escena con sombras teñidas de marino. La expresión (3D, scroll, pulso) vive solo en la landing; el sistema de gestión responde en 150–250 ms y nada más.

Rechazos confirmados por el contrato de dirección: el hero SaaS genérico (titular centrado, mockup inclinado, grilla de tres beneficios).

**Key Characteristics:**
- Paleta fija de cuatro tonos (marino, verde azulado, ámbar, coral) sobre blanco, con rampas propias y pizarra (slate) como neutro.
- Tipografía del sistema, sin fuentes externas; jerarquía por peso (700/600) y tamaño, con tracking apretado en titulares.
- Texto blanco solo sobre marino, teal-700, coral-700 o marino-900; nunca sobre los tonos base teal, ámbar o coral.
- Operate plano con bordes; landing con volúmenes 3D y paneles flotantes.
- Controles de 44 px mínimo, pensados para proyector y celular.

## Colors

Una paleta institucional sobria: marino profundo como estructura, un verde azulado que actúa, ámbar que advierte y coral que anula, todo sobre blanco.

### Primary
- **Marino DistriNorte** (marino): la estructura. Barra lateral del sistema, panel de marca del login, estructura y estantes del almacén 3D, rótulos de estante (ARR, ACE, AZU…), estación activa del recorrido, chip «Aprobado». Sus claros (marino-50, marino-100) son el fondo del escenario de la landing, el aviso informativo, el hover de fila y el color de selección; marino-500 es el anillo de foco; marino-900 es el texto de titulares de la landing, el globo de puntero y el pie.

### Secondary
- **Verde Azulado de Andén** (teal): acción y éxito. El tono base solo aparece como relleno sin texto (andén y rutas del 3D, punto del chip, borde del isotipo). Con texto blanco se usa teal-700 (botón primario, rótulo «PED-000123 · DESPACHADO») y teal-800 en hover; teal-50/teal-800 para chips y avisos de éxito («Entregado», «Activo», «Recibida»).

### Tertiary
- **Ámbar de Alerta** (ambar): stock ≤ mínimo. Caja y estante en alerta que pulsan en el 3D, fila marcada en ámbar-50, chip «En alerta · n», aviso de alerta. El texto sobre fondos ámbar es siempre ámbar-800.
- **Coral de Anulación** (coral): errores y anulaciones. Pedido anulado en el 3D, chip «Anulado», mensaje de error de campo (coral-700), botón de peligro (coral-700, hover coral-800), borde de campo inválido.

### Neutral
- **Blanco** (blanco): fondo de la aplicación, tarjetas, diálogos, campos.
- **Pizarra** (slate-50 a slate-900, escala de Tailwind): slate-50 es el lienzo detrás del contenido en Operate y la cabecera de tablas; slate-200 es el borde de tarjetas y separadores; slate-300 el borde de campos y botón secundario; slate-600 el texto secundario; slate-700 el cuerpo de la landing; slate-900 el texto principal.

### Named Rules
**The White-on-700 Rule.** El texto blanco va solo sobre marino, marino-900, teal-700 o coral-700 (y sus -800 en hover). Nunca sobre teal, ámbar o coral base: no alcanzan 4.5:1 y el sistema se proyecta.

**The One Meaning per Hue Rule.** Marino es estructura e información, verde azulado es acción y éxito, ámbar es alerta de stock, coral es error y anulación. Un tono no se usa por gusto fuera de su significado.

**The Token-Only Rule.** Los colores se aplican solo mediante los tokens de `src/index.css` (clases de Tailwind o `var(--color-…)`). La escena 3D, que no lee clases, toma los tokens del documento en `paleta.ts`, el único archivo con respaldos literales, idénticos a los tokens.

## Typography

**Display Font:** system-ui (con -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif)
**Body Font:** la misma pila del sistema
**Label/Mono Font:** la misma pila, con cifras tabulares (`tabular-nums`) en tablas, montos y códigos

**Character:** Una sola familia del sistema, sin fuentes remotas (requisito de funcionamiento sin conexión). La voz sale del peso y del tracking apretado en titulares, no de la familia.

### Hierarchy
- **Display** (700, 1.7rem → 3rem → 3.6rem, 1.1): solo el titular de la portada de la landing, en marino-900, con `text-wrap: balance`.
- **Headline** (700, 1.5rem, tracking -0.025em): título de cada página de Operate (slate-900) y de los paneles de estación de la landing (marino-900). Los títulos de sección de la landing suben a 1.875–2.25rem; el panel de marca del login usa 1.875rem.
- **Title** (600, 1.125rem): título de diálogos y paneles laterales; los títulos de tarjeta usan 600 a 1rem.
- **Body** (400, 0.875rem, 1.43): la densidad de Operate (tablas, ayudas, avisos). Los campos suben a 1rem en celular para evitar el zoom. En la landing el cuerpo es 1rem–1.125rem con interlineado 1.625 y ancho máximo de ~28rem.
- **Label** (600, 0.75rem, 0.025em, MAYÚSCULAS): solo cabeceras de columna de tabla y títulos de grupo del menú lateral. Los chips usan 600 a 0.75rem sin mayúsculas forzadas.

### Named Rules
**The Weight-Not-Face Rule.** La jerarquía se construye con peso (700 titulares, 600 títulos y etiquetas, 500 enlaces y navegación) y tamaño; nunca con una segunda familia.

**The Tabular Figures Rule.** Toda cifra que se compara (tablas, soles, stock, códigos de pedido) usa cifras tabulares.

## Layout

Operate es un armazón de dos columnas desde 1024 px: barra lateral marino fija de 16rem y contenido sobre slate-50 con cabecera blanca pegajosa de 64 px. Por debajo de 1024 px la barra se convierte en un menú deslizable (diálogo modal de 18rem, máx. 85vw). El contenido usa márgenes de 16 / 24 / 32 px (móvil / sm / lg) y un encabezado de página con título a la izquierda y acciones a la derecha, separado 24 px de lo que sigue. Las tarjetas rellenan 16 px (20 px desde sm); las tablas llegan al borde de la tarjeta y ocultan columnas secundarias en móvil. En celular, la acción principal de «Nuevo pedido» vive en una barra fija inferior que respeta el área segura.

La landing es un escenario pegajoso de altura completa (el almacén) con una capa de contenido que se desliza encima: portada alineada arriba a la izquierda, un velo marino-50 que protege la lectura del texto, y tres estaciones de 170dvh cada una con un panel blanco pegajoso a la izquierda. Tras el recorrido, un cierre sobre blanco en rejilla 5/7 (máx. 72rem) y un pie marino-900.

Ritmo: la escala de 4 px de Tailwind; huecos de 8 y 12 px entre controles, 16–24 px entre bloques. Objetivos táctiles de 44 px como mínimo (48 px en los botones de la landing).

## Elevation & Depth

Operate es plano: la profundidad se expresa con bordes slate-200, el contraste blanco sobre slate-50 y la barra marino. Las sombras aparecen solo en lo que flota sobre el resto: diálogos, avisos emergentes y la barra fija inferior del móvil. La landing es la excepción natural de su mundo: volúmenes 3D con sombras proyectadas por la escena, y paneles y rótulos flotantes con sombras suaves teñidas de marino-900 (10–15 %).

### Shadow Vocabulary
- **Diálogo** (`0 12px 40px -8px` marino-900 al 35 %): diálogos centrados y paneles laterales, con fondo marino-900 al 40 %.
- **Barra inferior** (`0 -4px 16px -6px` marino-900 al 15 %): barra de acción fija del móvil.
- **Flotante de landing** (sombra `lg` o `md` de Tailwind teñida marino-900 al 10–15 %): paneles de estación, rótulos del almacén, navegación de estaciones.
- **Aviso emergente** (sombra `lg` de Tailwind): notificaciones de 4 s en la esquina inferior.

### Named Rules
**The Flat Operate Rule.** En el sistema de gestión, lo que está en la página no tiene sombra; solo lo que se superpone a la página la tiene.

## Shapes

Esquinas suavemente redondeadas y consistentes: 8 px para todo control (botones, campos, ítems de navegación, avisos), 12 px para contenedores (tarjetas, diálogos, paneles de estación, tabla de usuarios), 6 px para rótulos pequeños (códigos de estante, estados en la landing, `code`), y pastilla completa para chips, puntos de estado, avatares y numerales de paso. El panel lateral es un rectángulo de altura completa sin esquinas. El isotipo es una caja isométrica en trazo sobre un cuadrado marino-600 de esquina 7/32. Los bordes son de 1 px; en la landing, las líneas guía de los rótulos son de 1.5 px en marino-900 al 55 % con un punto de 6 px en el ancla.

## Components

### Buttons
Firmes y sobrios: color plano, sin sombra, cambio de tono en hover.
- **Shape:** esquina de control (8 px), altura mínima de 44 px (48 px en la landing), 600 a 0.875rem, icono de 16 px con hueco de 8 px.
- **Primary:** teal-700 con texto blanco; es la única acción principal de cada vista («Ingresar al demo», «Guardar», «Despachar»).
- **Hover / Focus:** hover a teal-800 en 150 ms; foco con contorno de 2 px marino-500 desplazado 2 px (3 px en la landing). Deshabilitado al 60 % de opacidad.
- **Secondary:** blanco con borde slate-300 y texto slate-800; hover slate-50.
- **Danger:** coral-700 con texto blanco, hover coral-800; solo para anular o desactivar.
- **Ghost (landing):** sin fondo, texto marino-900, hover marino-100 al 70 % («Recorrer el almacén»).

### Chips
- **Style:** pastilla con fondo -50, texto -800 (marino base en el tono marino), anillo interior -100 y un punto de 6 px en el tono base; 600 a 0.75rem.
- **State:** mapeo fijo de estados. Pedido: Registrado neutro, Aprobado marino, Despachado ámbar, Entregado teal, Anulado coral. Orden de compra: Pendiente neutro, Aprobada marino, Recibida teal, Anulada coral. Stock: teal, o ámbar «En alerta · n» cuando stock ≤ mínimo. El texto siempre acompaña al color.

### Cards / Containers
- **Corner Style:** 12 px.
- **Background:** blanco sobre slate-50.
- **Shadow Strategy:** ninguna (ver The Flat Operate Rule).
- **Border:** 1 px slate-200; cabecera de tarjeta separada con el mismo borde.
- **Internal Padding:** 16 px, 20 px desde sm; las tablas no llevan relleno.

### Inputs / Fields
- **Style:** blanco, borde 1 px slate-300, esquina de 8 px, altura 44 px, relleno horizontal de 12 px; etiqueta visible encima (500, 0.875rem, slate-800).
- **Focus:** borde marino-500 con anillo de 2 px marino-100; hover de borde slate-400.
- **Error / Disabled:** borde coral-700 con anillo coral-100 y mensaje coral-700 debajo, enlazado por `aria-describedby`. Casillas y controles nativos usan teal-700 como color de acento.

### Tables
- **Style:** cabecera slate-50 con etiquetas en mayúsculas (Label), filas separadas por slate-100, celdas de 16 × 12 px, cifras tabulares.
- **State:** filas seleccionables con hover marino-50 al 60 %; filas marcadas en ámbar-50 o coral-50 al 60 % para alerta o anulación. Carga con esqueleto pulsante slate-100; vacío y error con icono en círculo de 44 px.

### Navigation
- **Style:** barra lateral marino de 16rem con la marca arriba (isotipo + «SIGPI» / «DistriNorte S.A.C.»), grupos con título Label en marino-200.
- **States:** ítems de 44 px en marino-100; hover blanco al 6 %; activo blanco al 12 % con texto blanco e icono teal-100.
- **Mobile:** el mismo panel como diálogo modal que entra desde la izquierda (200 ms) con fondo marino-900 al 50 %.

### Almacén isométrico (componente firma de la landing)
Escena low-poly generada por código (Three.js, materiales Lambert en colores planos de la paleta, sombras de escena) con cámara isométrica que recorre tres estaciones al hacer scroll. Rótulos anclados a la escena: códigos de estante en marino con texto blanco, alerta en ámbar-50/ámbar-800, información en blanco con borde marino-100, pedido en teal-700 con texto blanco, anulado en coral-50/coral-800; cuando se abren en abanico, una línea guía marino-900 une el rótulo con su ancla. El estante en alerta pulsa en ámbar. Sin WebGL o con `prefers-reduced-motion`, la misma escena se muestra como SVG estático y la cámara salta sin animar.

### Panel de estación
Tarjeta blanca pegajosa de 12 px con borde marino-100 y sombra flotante, titular Headline en marino-900 y cuerpo slate-700; dentro, pares resultado teal-50 / coral-50, listas con check teal-700 y pasos numerados en círculos ámbar-100, marino-100 y teal-100.

## Do's and Don'ts

### Do:
- **Do** aplicar color solo mediante los tokens de `src/index.css`; en código que no lee clases, leer las variables del documento como hace `paleta.ts`.
- **Do** poner texto blanco solo sobre marino, marino-900, teal-700 o coral-700 (hover -800).
- **Do** usar cada tono en su significado: marino estructura, verde azulado acción/éxito, ámbar alerta de stock, coral error/anulación.
- **Do** mantener en el sistema de gestión transiciones de 150–250 ms con la curva de salida (`cubic-bezier(0.22, 1, 0.36, 1)`), anuladas por `prefers-reduced-motion`.
- **Do** dar a todo control una altura mínima de 44 px y un contorno de foco marino-500 visible.
- **Do** acompañar cada color de estado con texto (chip con punto y palabra, nunca solo color).
- **Do** usar cifras tabulares en tablas, montos, stock y códigos.

### Don't:
- **Don't** usar Three.js, 3D ni animación ligada al scroll fuera de la landing pública.
- **Don't** poner texto blanco sobre teal, ámbar o coral base.
- **Don't** cargar fuentes externas ni recursos remotos (CDN, texturas, modelos): todo debe funcionar sin conexión.
- **Don't** escribir valores de color literales (hex, `rgb()`) en componentes o pantallas.
- **Don't** dar sombra a elementos que viven en la página en el sistema de gestión; la sombra es para lo que se superpone.
- **Don't** usar mayúsculas con tracking como antetítulo sobre un titular; las mayúsculas quedan para cabeceras de columna, títulos de grupo del menú y valores de estado.
- **Don't** volver al hero SaaS genérico (titular centrado, mockup inclinado, grilla de tres beneficios) en la landing.
