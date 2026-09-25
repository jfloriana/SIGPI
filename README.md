# SIGPI – Sistema Integrado de Gestión de Pedidos e Inventario

Sistema demo académico para el curso *Sistemas de Información Empresarial* (Universidad Nacional de Trujillo).
Empresa ficticia: **DistriNorte S.A.C.**, distribuidora de abarrotes en Trujillo.

> Estado: **Fase 1 (base) terminada.** Este README se completa en la Fase 8 con el guion de demostración,
> el cambio a Supabase y las pruebas E2E.

## Requisitos

- Node.js **22.18 o superior** (probado con Node 26.2). Prisma 7 y Vite 8 ya no admiten Node 20.
- npm 11 o superior.

## Instalación y arranque

```bash
npm install        # instala los tres workspaces (api, web, e2e)
npm run setup      # crea apps/api/.env si no existe, sincroniza el esquema y carga los datos de demostración
npm run dev        # API en http://localhost:3000/api y web en http://localhost:5173
npm test           # pruebas unitarias e integración (Vitest + Supertest, usan una base aparte: prisma/test.db)
```

`npm run setup` se puede ejecutar varias veces: el seed vacía las tablas y vuelve a cargar todo.

### Usuarios de demostración (contraseña: `Demo2026!`)

| Correo | Rol |
|---|---|
| admin@distrinorte.pe | Administrador |
| gerente@distrinorte.pe | Gerente |
| vendedor1@distrinorte.pe | Vendedor |
| vendedor2@distrinorte.pe | Vendedor |
| almacen@distrinorte.pe | Almacenero |

## Estructura

```
apps/api   Express 5 + Prisma 7 + Zod 4 (capa de lógica y datos)
apps/web   React 19 + Vite 8 + Tailwind 4 + TanStack Query (capa de presentación)
apps/e2e   Playwright (Fase 7)
```

## Notas técnicas

- **Prisma 7:** la URL de la base ya no va en `schema.prisma` sino en `apps/api/prisma.config.ts`, y el cliente se
  conecta con un *driver adapter* (`better-sqlite3` para SQLite, `pg` para PostgreSQL) que se elige según
  `DATABASE_URL` (`src/db.ts`). El código es el mismo en ambos modos.
- **npm 11+ bloquea los scripts de instalación** por defecto. `package.json` autoriza (campo `allowScripts`) solo los
  que el proyecto necesita: `bcrypt` y `better-sqlite3` (módulos nativos), `prisma`, `@prisma/engines` y `esbuild`.
- `npm audit` informa dos avisos (`deepmerge-ts`, `mysql2`) que llegan como dependencias internas de la CLI de Prisma
  (herramienta de desarrollo); no forman parte de la API en ejecución.

## Versiones instaladas

| Paquete | Versión |
|---|---|
| Node.js (probado) | 26.2.0 |
| TypeScript | 7.0.2 |
| express | 5.2.1 |
| prisma / @prisma/client / adapters | 7.10.0 (la etiqueta `latest` de npm apunta a 8.0.0-rc, versión preliminar: no se usa) |
| zod | 4.6.5 |
| jsonwebtoken | 9.0.3 |
| bcrypt | 6.0.0 |
| helmet | 8.3.0 |
| express-rate-limit | 8.7.0 |
| vitest | 5.0.1 |
| supertest | 7.3.0 |
| tsx | 4.23.15 |
| react / react-dom | 19.3.0 |
| react-router | 7.18.4 |
| @tanstack/react-query | 5.103.2 |
| recharts | 3.10.1 |
| tailwindcss / @tailwindcss/vite | 4.3.3 |
| vite | 8.3.1 |
| lucide-react | 1.48.0 |
| @playwright/test | 1.63.0 |
| concurrently | 10.0.5 |
