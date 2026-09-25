# SIGPI – guía para agentes

Especificación completa (fuente de verdad del alcance): `C:\Users\Joel Florian\Downloads\Prompt-Sistema-Demo-SIGPI.md`.
Producto y audiencia: `apps/web/PRODUCT.md`. Léelos antes de trabajar.

## Decisiones ya confirmadas por el usuario (no volver a preguntar)

1. React 19 + React Router 7 (no 8). TypeScript 7.0.2 (funciona; si da problemas, bajar a 6).
2. Tablero: completo solo para GERENTE y ADMIN; el ALMACENERO ve alertas de stock; el VENDEDOR ve solo sus ventas. La API filtra según el rol.
3. OC sugerida: el gerente elige el proveedor; el costo unitario se precarga al **80 % del precio de venta** y es editable. Es un **supuesto del demo** y debe decirse así en el README.
4. Solo el **GERENTE** aprueba y anula pedidos. El ADMIN solo consulta (segregación de funciones).
5. Despliegue: fuera de alcance por ahora.
6. Landing pública para **jurado y docentes**; la exposición se hace **sin internet** (nada de CDN, fuentes remotas ni texturas descargadas); solo **datos reales del demo** (sin testimonios ni métricas inventadas). Three.js/GSAP se permiten **solo en la landing**; dentro del sistema, transiciones de 150–250 ms y `prefers-reduced-motion`.

## Stack y comandos

- Node ≥ 22.18, npm 12 (bloquea scripts de instalación: los permitidos están en `allowScripts` del `package.json` raíz).
- `npm run setup` (crea .env, `prisma generate`, `prisma db push`, seed) · `npm run dev` · `npm test` · `npm run build`.
- API: Express 5, Prisma 7 (adaptadores better-sqlite3/pg; URL en `prisma.config.ts`; cliente generado en `apps/api/src/generated/prisma`, se importa como `../generated/prisma/client.ts`), Zod 4, Vitest 5 + Supertest.
- Web: Vite 8, Tailwind 4 (tokens en `apps/web/src/index.css`), TanStack Query 5, Recharts 3, lucide-react.
- **Prisma rechaza `--force-reset`/`migrate reset` cuando detecta un agente.** No lo fuerces ni rellenes la variable de consentimiento: la base se reinicia con el seed (vacía tablas y recarga).
- Windows: `concurrently -k` deja procesos huérfanos. Si levantas `npm run dev`, al terminar libera los puertos 3000 y 5173 (verifica con `Get-NetTCPConnection -LocalPort 3000,5173`) y detén solo esos procesos.

## Convenciones de la API (`apps/api`)

- Estructura: `src/modules/<modulo>/{routes,service,schemas}.ts`. La lógica de negocio va en `service` (probada); las rutas solo validan con Zod y llaman al servicio.
- Cada ruta: `autenticar` + `requireRol(...)` según la matriz de la especificación. Nunca devolver `hashClave`.
- Errores: lanzar `AppError(status, codigo, mensaje, campos?)` (`src/utils/errores.ts`); Zod → 400 `VALIDACION` con `campos`. Formato: `{ error: { codigo, mensaje, campos? } }`. Mensajes en español.
- Bitácora: `auditar(tx, {...})` de `src/services/auditoria.ts`, **dentro de la misma `prisma.$transaction`** que la operación, con `antes` y `despues`. Exactamente un registro por operación crítica.
- Dinero: `Prisma.Decimal` (de `src/generated/prisma/client.ts`), redondeo a 2 decimales; nunca `number` para totales. En JSON, los Decimal salen como **string** (`"12.50"`).
- Listas paginadas: `GET ?page=&pageSize=` (por defecto 20, máximo 100) → `{ datos: T[], total: number, page: number, pageSize: number }`. Detalle `GET /:id` → el objeto. `POST` → 201 con el objeto. `PATCH` → el objeto actualizado.
- Desactivar = `PATCH { activo: false }` → bitácora `DESACTIVAR` (no hay DELETE de maestros).
- Pruebas en `apps/api/tests/*.test.ts`; usan `prisma/test.db` y `sembrar()`; helpers en `tests/helpers.ts`.

## Convenciones del frontend (`apps/web`)

- Español (Perú). Moneda con `formatoSoles()` → `S/ 1 234.50`; fechas en `America/Lima` (`src/utils/formato.ts`).
- Llamadas: `api.get/post/patch` (`src/api/cliente.ts`) dentro de hooks de TanStack Query. Errores de la API → `ApiError` con `codigo`, `campos` (mostrar junto a cada campo).
- Colores **solo con tokens** (`marino`, `teal`, `ambar`, `coral` y neutros `slate`); nada de hex sueltos en componentes. Texto blanco sobre `teal-700`/`coral-700`, nunca sobre los tonos base.
- Usa los componentes compartidos de `src/components/` (tabla, campos, diálogos, chips de estado, estados de carga/vacío/error, paginación). Si falta uno, pídelo al orquestador en lugar de crear una variante paralela.
- Accesibilidad: etiquetas visibles, `aria-invalid` + mensaje junto al campo, foco visible, objetivos táctiles ≥ 44 px, íconos con `aria-hidden` y botones solo-ícono con `aria-label`. `data-testid` solo donde no haya texto accesible.
- Confirmación (diálogo) antes de anular o despachar. Estados de carga, vacío y error en todas las tablas.

## Trabajo en paralelo (varios agentes)

- Cada agente edita **solo las rutas que se le asignan**. Archivos compartidos (`router.tsx`, `layout/menu.ts`, `src/components/**`, `index.css`, `package.json`, `prisma/schema.prisma`, `prisma/seed.ts`) los integra el orquestador salvo asignación explícita.
- Si `tsc`/`build` falla en archivos que no son tuyos, puede ser trabajo en curso de otro agente: repórtalo, no lo "arregles".
- Los agentes **no hacen commits**; el orquestador hace un commit por fase tras verificar pruebas y build.
