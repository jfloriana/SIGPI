# SIGPI – Sistema Integrado de Gestión de Pedidos e Inventario

Sistema demo académico para el curso *Sistemas de Información Empresarial* (Universidad Nacional de Trujillo).
Es la instanciación del diseño descrito en el informe «Planificación y diseño del sistema de información» para
**DistriNorte S.A.C.**, una distribuidora de abarrotes **ficticia** de Trujillo que atiende ~400 bodegas y minimercados.

Demuestra: control de acceso por roles, controles de entrada y procesamiento, transacciones ACID, alertas de stock,
tablero gerencial y bitácora de auditoría (trazabilidad). Todos los nombres, documentos y datos son inventados.

---

## Requisitos

- **Node.js 22.18 o superior** (probado con Node 26.2). Prisma 7 y Vite 8 ya no admiten Node 20.
- **npm 11 o superior** (npm 12 incluido).
- No se necesita internet para usar el demo una vez instaladas las dependencias (ideal para la exposición).

## Instalación y arranque (un comando para instalar, uno para arrancar)

```bash
npm install        # instala los tres workspaces (api, web, e2e)
npm run setup      # crea apps/api/.env con un JWT_SECRET aleatorio, sincroniza el esquema y carga los datos de demostración
npm run dev        # API en http://localhost:3000/api y web en http://localhost:5173
```

Abra **http://localhost:5173**: verá la landing pública; «Ingresar al demo» lleva al inicio de sesión.

`npm run setup` se puede ejecutar todas las veces que quiera: vacía la base y la vuelve a cargar con los mismos datos
(tarda unos segundos). Úselo antes de la exposición para empezar desde un estado conocido.

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas unitarias y de integración del backend (Vitest + Supertest) sobre una base aparte (`prisma/test.db`). |
| `npm run test:e2e` | Pruebas de extremo a extremo con Playwright (ver más abajo). |
| `npm run build` | Verificación de tipos de la API y compilación de producción de la web. |

> **Nota sobre npm 11+:** npm bloquea por defecto los scripts de instalación de las dependencias. El `package.json`
> raíz autoriza (campo `allowScripts`) solo los que el proyecto necesita: `bcrypt` y `better-sqlite3` (módulos
> nativos), `prisma`, `@prisma/engines` y `esbuild`. Si al arrancar aparece un error de un binario nativo,
> ejecute `npm rebuild bcrypt better-sqlite3`.

## Usuarios de demostración

Contraseña de todos: **`Demo2026!`**

| Correo | Rol | Qué puede hacer |
|---|---|---|
| admin@distrinorte.pe | Administrador | Mantiene usuarios, clientes, productos y proveedores; consulta todo. **No aprueba** (segregación de funciones). |
| gerente@distrinorte.pe | Gerente | Aprueba o anula pedidos y órdenes de compra, genera la OC sugerida y lee el tablero. |
| vendedor1@distrinorte.pe | Vendedor | Registra pedidos desde el celular; ve solo sus pedidos y sus ventas. |
| vendedor2@distrinorte.pe | Vendedor | Otra cartera; mismas reglas. |
| almacen@distrinorte.pe | Almacenero | Despacha y entrega pedidos, recepciona compras, registra ajustes; ve stock y alertas. |

## Guion de demostración (5 minutos)

Ejecute `npm run setup` antes de empezar. El seed deja pedidos pendientes, en cola y por entregar, una OC aprobada por
recepcionar y 7 productos en alerta.

1. **vendedor1** (idealmente en el celular o con la vista de celular del navegador) → *Nuevo pedido*: elija un cliente,
   agregue **5 productos**, condición **Crédito** → *Registrar pedido*. Queda **Registrado** (requiere aprobación del
   gerente). Luego intente pedir más unidades que el stock disponible de un producto: el servidor responde con el
   error y el stock real, y el pedido no se crea.
2. **gerente** → *Pedidos* → abra el pedido → *Aprobar*. Revise el *Tablero* (ventas del período, pedidos por estado,
   top 10 de productos, ventas por vendedor y zona, alertas).
3. **almacen** → *Cola de despacho* → *Despachar* (confirmación con los productos que se descuentan). Abra el *Kardex*
   de uno de los productos: aparece la SALIDA con el stock resultante. Vuelva a la cola → *Marcar entregado*.
4. **Alertas y compras:** como **gerente**, *Alertas de stock* → *Generar orden de compra sugerida* → elija el
   proveedor → cree la OC → *Aprobar*. Como **almacen**, *Proveedores y compras* → abra la OC → *Recepcionar*: el
   stock sube y el producto sale de la alerta.
5. **admin** → *Bitácora*: filtre por la entidad Pedido, abra un cambio de estado para ver el **antes/después** campo
   por campo y use «Ver toda la historia de este registro» para reconstruir la vida completa del pedido.

## Qué demuestra cada módulo

La página **Acerca del sistema** (menú «Control») explica, para cada concepto del curso, en qué pantalla se ve, qué
reglas lo implementan y qué prueba automatizada lo respalda. Resumen:

| Concepto | Dónde se ve | Reglas |
|---|---|---|
| Control de acceso por roles | Menú por rol, «Acceso denegado», API `requireRol` | Matriz de permisos, 13 |
| Controles de entrada | Formularios de clientes, productos, pedidos | 1–3 (RUC/DNI, cantidades, líneas) |
| Controles de procesamiento | Pedidos: total en servidor, máquina de estados, aprobación | 4–7, 11 |
| Transacciones ACID | Despacho de pedidos y recepción de OC | 8–10 |
| Alertas y reposición | Alertas de stock, OC sugerida, tablero | 18 |
| Tablero gerencial | Tablero (según rol) y exportación CSV | — |
| Trazabilidad | Bitácora de solo lectura con antes/después | 16–17 |
| Independencia de datos | SQLite ↔ PostgreSQL cambiando solo `provider` y variables | — |

**Supuesto del demo:** en la **orden de compra sugerida**, el costo unitario se precarga al **80 % del precio de venta**
del producto. Es un supuesto para la demostración (no hay listas de precios de proveedores); el gerente lo puede editar.
La cantidad sugerida es `stock mínimo × 2 − stock`.

## Arquitectura

```
apps/web   Capa de presentación: React 19 + React Router 7 + Vite 8 + Tailwind 4 + TanStack Query + Recharts
           (landing pública con Three.js + GSAP, cargada por separado)
apps/api   Capa de lógica: Express 5 + Zod 4 + JWT (8 h) + bcrypt (10 rondas); reglas de negocio en services/
           Capa de datos: Prisma 7 (SQLite por defecto; PostgreSQL/Supabase opcional)
apps/e2e   Pruebas de extremo a extremo con Playwright (Escritorio y Celular)
```

- Todas las reglas y permisos se aplican **en el servidor**; la interfaz solo oculta opciones.
- La bitácora se escribe con `auditar(tx, …)` **dentro de la misma transacción** que la operación.
- El contrato de la API está en [`apps/api/API.md`](apps/api/API.md); el sistema visual en
  [`apps/web/DESIGN.md`](apps/web/DESIGN.md).
- Seguridad: helmet, CORS limitado a `CORS_ORIGEN` (por defecto `http://localhost:5173`), límite de tasa en el login,
  bloqueo de 15 minutos tras 5 intentos fallidos, JWT solo HS256, `hashClave` nunca sale en las respuestas.

## Cambiar a Supabase (PostgreSQL gratuito)

El mismo código funciona con PostgreSQL: solo cambian `provider` y las variables de entorno (independencia de datos).
Supabase se usa **solo como base de datos**: la autenticación, los permisos y la bitácora siguen en la API propia.

1. Cree un proyecto gratuito en [supabase.com](https://supabase.com) y copie las cadenas de conexión desde
   *Project Settings → Database* (o el botón *Connect*).
2. En `apps/api/prisma/schema.prisma` cambie `provider = "sqlite"` por `provider = "postgresql"`.
3. En `apps/api/.env`:
   ```env
   # La aplicación usa el pooler (puerto 6543)
   DATABASE_URL="postgresql://postgres.<ref>:<CLAVE>@aws-0-<región>.pooler.supabase.com:6543/postgres?pgbouncer=true"
   # Las operaciones de esquema usan la conexión directa (puerto 5432)
   DIRECT_URL="postgresql://postgres.<ref>:<CLAVE>@aws-0-<región>.pooler.supabase.com:5432/postgres"
   ```
   > En Prisma 7 la URL ya no va en `schema.prisma`: `apps/api/prisma.config.ts` usa `DIRECT_URL` (o, si no existe,
   > `DATABASE_URL`) para los comandos de la CLI, y la aplicación se conecta con `DATABASE_URL` mediante el adaptador
   > `@prisma/adapter-pg`, que `src/db.ts` elige automáticamente cuando la URL no empieza con `file:`.
4. Cree el esquema y cargue los datos:
   ```bash
   cd apps/api
   npx prisma generate
   npx prisma db push      # crea las tablas en Supabase
   npm run seed            # carga los datos de demostración
   ```
   El proyecto usa `prisma db push` (sincronización del esquema) en lugar de migraciones versionadas porque el mismo
   esquema se aplica a dos motores distintos; para un despliegue real conviene generar migraciones con
   `npx prisma migrate dev` sobre PostgreSQL y aplicarlas con `npx prisma migrate deploy`.
5. `npm run dev` desde la raíz.

**Límites del plan gratuito (verifique los vigentes en supabase.com/pricing antes de la exposición):** base de datos
pequeña (del orden de 500 MB), y **el proyecto se pausa tras un periodo de inactividad** (alrededor de una semana).
Para reactivarlo, entre al panel de Supabase y pulse *Restore project*; puede tardar unos minutos. Hágalo el día
anterior a la exposición y ejecute `npm run seed -w apps/api` para dejar los datos en su estado inicial. Para exponer
sin conexión, use el modo SQLite (por defecto).

## Pruebas

### Unitarias e integración (`npm test`)

162 pruebas en `apps/api/tests/` sobre una base de pruebas aparte. Cubren las 10 pruebas mínimas de la
especificación:

| # | Prueba | Archivo |
|---|---|---|
| 1 | Validación de RUC/DNI (válidos e inválidos) | `validadores.test.ts`, `maestros.test.ts` |
| 2 | Total calculado en el servidor aunque el cliente envíe otro | `pedidos.test.ts` |
| 3 | Cantidad > stock → 409 | `pedidos.test.ts` |
| 4 | Transiciones inválidas → 422 | `pedidos.test.ts`, `compras.test.ts` |
| 5 | Despacho atómico: si una línea no tiene stock, nada cambia | `pedidos.test.ts` |
| 6 | Dos despachos concurrentes: solo uno tiene éxito, stock nunca negativo | `pedidos.test.ts` |
| 7 | Vendedor no aprueba ni despacha (403) y no ve pedidos ajenos | `pedidos.test.ts` |
| 8 | Bloqueo tras 5 intentos fallidos | `auth.test.ts` |
| 9 | Cada operación crítica genera exactamente un registro de bitácora | todos los módulos |
| 10 | Recepción de OC suma stock y crea movimientos ENTRADA | `compras.test.ts` |

Además: kardex cuadrado (stock = suma de movimientos), tablero y CSV por rol, bitácora de solo lectura, seed
determinista y coherente, y una revisión de seguridad automatizada (todas las rutas exigen token, nunca se filtra
`hashClave`).

### Extremo a extremo (`npm run test:e2e`)

Playwright en `apps/e2e`, con dos proyectos: **Escritorio** (Desktop Chrome) y **Celular** (Pixel 7, porque el
vendedor usa el celular). Antes de las pruebas se reinicia la base con el seed.

```bash
npx playwright install chromium   # solo la primera vez
npm run test:e2e                  # levanta API y web si no están corriendo
npm run report -w apps/e2e       # abre el reporte HTML (apps/e2e/playwright-report)
```

Casos: `login`, `permisos`, `pedido-flujo` (guion completo), `stock-insuficiente`, `alertas-compras`, `tablero`,
`responsive` y `accesibilidad` (axe: sin violaciones *serious* ni *critical*).

## Versiones instaladas

Versiones exactas (fijadas en los `package.json`):

| Paquete | Versión | Paquete | Versión |
|---|---|---|---|
| Node.js (probado) | 26.2.0 | react / react-dom | 19.3.0 |
| TypeScript | 7.0.2 | react-router | 7.18.4 |
| express | 5.2.1 | @tanstack/react-query | 5.103.2 |
| zod | 4.6.5 | recharts | 3.10.1 |
| prisma / @prisma/client | 7.10.0 | tailwindcss / @tailwindcss/vite | 4.3.3 |
| @prisma/adapter-better-sqlite3 / adapter-pg | 7.10.0 | vite | 8.3.1 |
| jsonwebtoken | 9.0.3 | @vitejs/plugin-react | 6.1.1 |
| bcrypt | 6.0.0 | lucide-react | 1.48.0 |
| helmet | 8.3.0 | three | 0.186.1 |
| express-rate-limit | 8.7.0 | gsap | 3.15.0 |
| cors | 2.8.6 | @playwright/test | 1.63.0 |
| dotenv | 18.0.3 | vitest | 5.0.1 |
| tsx | 4.23.15 | supertest | 7.3.0 |
| concurrently | 10.0.5 | | |

Prisma se fijó en 7.10.0 porque la etiqueta `latest` de npm apunta a una versión preliminar (8.0.0-rc) y la
especificación pide no usar paquetes en beta.

`npm audit` informa dos avisos (`deepmerge-ts`, `mysql2`) que llegan como dependencias internas de la CLI de Prisma,
una herramienta de desarrollo; no forman parte de la API en ejecución.

## Decisiones del proyecto

- Solo el **gerente** aprueba y anula pedidos y aprueba órdenes de compra; el administrador consulta (segregación de
  funciones). Quien registra un pedido no puede aprobarlo ni despacharlo aunque se le cambie el rol.
- El tablero completo es para gerente y administrador; el vendedor ve solo sus ventas y el almacenero solo stock y
  alertas.
- Solo los pedidos **despachados o entregados** cuentan como venta, con la fecha de despacho.
- La landing pública usa Three.js y GSAP; dentro del sistema de gestión solo hay transiciones cortas (150–250 ms) que
  respetan «reducir movimiento».
