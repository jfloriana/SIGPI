---
version: 1
slug: "src-pages-landing"
primary_target: "src/pages/landing"
related_targets: []
---

## Scope
Landing pública de SIGPI (ruta `/`), modo **Persuade**. Audiencia: jurado y docentes del curso durante la exposición proyectada, sin internet. Acción: «Ingresar al demo» (→ `/login`). Prueba: solo datos reales del demo sembrado (8 categorías, ~60 productos, ~80 clientes, 5 roles, 18 reglas, 10 pruebas, 8 E2E). Restricciones: todo local (sin CDN ni texturas descargadas), 3D generado por código, respaldo estático para `prefers-reduced-motion` o sin WebGL, rendimiento aceptable en una laptop de gama media.

## Direction contract
THESIS: La landing ES el almacén de DistriNorte: un almacén isométrico en 3D donde se ve el ciclo pedido → despacho → reposición. Rechaza el hero SaaS genérico (titular centrado, mockup inclinado y grilla de tres beneficios).
OWN-WORLD: Low-poly isométrico de volúmenes planos: estructura en marino, cajas en marino claro, andén y rutas en verde azulado, productos en alerta pulsando en ámbar y un pedido anulado en coral. Etiquetas técnicas con tipografía del sistema, rótulos de estante con códigos reales de categoría (ARR, ACE, AZU…). Fondo marino-50 que funde con el blanco.
STORY: El jurado entiende en un vistazo qué hace SIGPI (pedidos, inventario y compras de una distribuidora), ve que las reglas se aplican (alerta de stock, despacho atómico, trazabilidad) y entra al demo con el usuario sugerido.
FIRST VIEWPORT: El almacén 3D ocupa todo el ancho, con la cámara isométrica levemente elevada. Arriba a la izquierda: isotipo + «SIGPI», titular de dos líneas y el botón primario «Ingresar al demo»; debajo, una línea con los roles. Un estante brilla en ámbar con la etiqueta flotante «Aceite vegetal 1 L · stock 4 ≤ mínimo 12» y un montacargas/caja sale por el andén rotulado «PED-000123 · DESPACHADO».
FORM: Almacén isométrico en 3D (tercera de mi lista ordenada; el usuario la eligió entre tres opciones sorteadas). Seed key: b4dfb805. Interacción característica: el scroll recorre tres estaciones del almacén (Recepción de pedidos → Despacho atómico → Reposición/OC sugerida) moviendo la cámara con GSAP; al pasar el puntero por un estante se muestra su categoría y su conteo de productos.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
