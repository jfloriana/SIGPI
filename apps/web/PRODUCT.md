# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Evaluadores (jurado y docentes)** del curso *Sistemas de Información Empresarial* (Universidad Nacional de Trujillo). Ven el sistema proyectado durante una exposición de ~5 minutos y juzgan si instancia el diseño del informe: control de acceso por roles, controles de entrada y procesamiento, transacciones ACID, alertas, tablero gerencial y trazabilidad.
- **Usuarios simulados de DistriNorte S.A.C.** (empresa ficticia, distribuidora de abarrotes en Trujillo que atiende ~400 bodegas y minimercados), representados por los 5 usuarios demo:
  - **Vendedor de campo:** registra pedidos desde el celular en la bodega del cliente. Meta: un pedido de 5 líneas en menos de 2 minutos.
  - **Gerente:** aprueba pedidos a crédito o mayores de S/ 2 000, aprueba órdenes de compra y lee el tablero.
  - **Almacenero:** despacha pedidos aprobados, marca entregas, recepciona compras y registra ajustes de inventario.
  - **Administradora (asistente):** mantiene maestros y usuarios; consulta todo, pero no aprueba (segregación de funciones).

## Product Purpose

SIGPI (Sistema Integrado de Gestión de Pedidos e Inventario) es un demo académico funcional: la instanciación del diseño descrito en el informe «Planificación y diseño del sistema de información». El éxito es que el guion de demostración (vendedor → gerente → almacén → alertas y compras → bitácora del admin) corra sin tropiezos frente al jurado, y que cada regla de negocio sea visible y verificable.

## Positioning

No es un producto comercial. Su valor diferencial es didáctico y verificable: cada módulo demuestra un concepto del curso, y las reglas se aplican en el servidor (la interfaz solo oculta opciones), con pruebas automatizadas que lo respaldan.

## Operating Context

- La exposición se proyecta **sin conexión a internet**, desde una laptop de gama media. Todo debe funcionar en local: nada de CDN, fuentes remotas, texturas ni modelos descargados.
- Una **landing pública** presenta el proyecto al jurado (problema de DistriNorte, módulos, conceptos del curso que demuestra) y lleva a «Ingresar al demo».
- El vendedor usa el celular (proyecto E2E «Pixel 7»); el resto de roles, escritorio.
- Idioma español (Perú); moneda en soles con formato `S/ 1 234.50`; zona horaria America/Lima.

## Capabilities and Constraints

- Roles ADMIN, GERENTE, VENDEDOR y ALMACENERO, con la matriz de permisos del informe aplicada en el servidor.
- Módulos: pedidos (máquina de estados REGISTRADO → APROBADO → DESPACHADO → ENTREGADO, y ANULADO), inventario (kardex, ajustes, alertas), compras (proveedores, OC sugerida, recepción), maestros, tablero, reportes CSV, bitácora de solo lectura y página «Acerca del sistema».
- Stack fijado: React 19, React Router 7, Vite, Tailwind 4, TanStack Query, Recharts (API Express + Prisma).
- Dentro del sistema de gestión: solo transiciones cortas (150–250 ms), con `prefers-reduced-motion` respetado; sin Three.js ni animaciones ligadas al scroll. La **landing pública** es la excepción aprobada por el usuario: allí se permiten 3D y animación con scroll.

## Brand Commitments

- Paleta fijada por la especificación: azul marino `#1F3A5F` (principal), verde azulado `#2A9D8F` (acciones/éxito), ámbar `#E9A23B` (alertas), coral `#D1603D` (errores/anulaciones), fondo blanco.
- Tipografía del sistema (sin fuentes externas).
- Nombres: «SIGPI» y «DistriNorte S.A.C.» (ficticia). Sin marcas, logotipos ni datos de personas o empresas reales.

## Evidence on Hand

- Solo datos reales del demo sembrado: 5 roles/usuarios, 8 categorías, ~60 productos, ~80 clientes, 3 proveedores, ~300 pedidos en 90 días, 18 reglas de negocio, 10 pruebas automatizadas y 8 casos E2E.
- Los «~400 bodegas y minimercados» son un dato del caso ficticio.
- **No hay** testimonios, métricas de impacto, clientes reales ni capturas de terceros: no se deben inventar.

## Product Principles

1. La regla vive en el servidor; la interfaz la hace visible (mensajes claros, estados, trazabilidad).
2. Cada pantalla debe sostener el guion de demostración de 5 minutos sin explicación adicional.
3. Rapidez y claridad antes que ornamento en las pantallas operativas; la expresión se concentra en la landing.
4. Todo funciona sin conexión.

## Accessibility & Inclusion

- Sin violaciones *serious* ni *critical* de axe en login, nuevo pedido y tablero (prueba E2E obligatoria).
- Pantalla «Nuevo pedido» sin desplazamiento horizontal en celular, con botones principales visibles.
- Legible en proyector: contraste ≥ 4.5:1 y controles táctiles de 44 px como mínimo.
