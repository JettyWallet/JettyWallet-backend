# JettyWallet · Backend

API de JettyWallet, una billetera virtual simulada: depósitos, intercambio entre monedas (ARS, COP, EUR y USD), transferencias entre usuarios de Jetty y metas de ahorro.

El frontend está en [JettyWallet/Jetty-Wallet](https://github.com/JettyWallet/Jetty-Wallet). El contrato entre ambos está en [docs/api.md](docs/api.md).

## Stack

Node.js 22 · TypeScript · Express 5 · PostgreSQL · node-pg-migrate · Vitest + Supertest · Swagger

## Cómo correrlo

Requisitos: Node.js 22 o superior y PostgreSQL (13 o superior).

```bash
npm install
cp .env.example .env          # completar los valores
npm run migrate:up            # crea las tablas
npm run dev                   # http://localhost:3000
```

- Documentación interactiva: http://localhost:3000/api-docs
- Estado de la API: http://localhost:3000/api/health

### Variables de entorno

| Variable | Para qué |
|---|---|
| `PORT` | Puerto del servidor (por defecto 3000) |
| `DATABASE_URL` | Base de datos de desarrollo |
| `DATABASE_URL_TEST` | Base para los tests. Su nombre **debe terminar en `_test`** porque los tests la vacían |
| `FRONTEND_URL` | Orígenes permitidos por CORS, separados por coma |
| `JWT_SECRET` | Clave para firmar los tokens de sesión |
| `CURRENCY_FREAKS_API_KEY` | API principal de cotizaciones |
| `FIXER_API_KEY` | API de respaldo de cotizaciones |

`DATABASE_URL` y `JWT_SECRET` son obligatorias: sin ellas el servidor no arranca.

### Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga automática |
| `npm run build` | Compila a `dist/` |
| `npm start` | Corre la versión compilada |
| `npm run typecheck` | Revisa tipos (código y tests) |
| `npm test` | Corre los tests una vez |
| `npm run test:watch` | Tests en modo observador |
| `npm run migrate:up` | Aplica las migraciones pendientes |
| `npm run migrate:down` | Revierte la última migración |
| `npm run migrate:create -- nombre` | Crea una migración nueva |

## Estructura

```
migrations/            Migraciones SQL (000_..., 001_..., ...)
src/
├── app.ts             Arma la app de Express (sin escuchar)
├── server.ts          Punto de entrada: valida entorno y base, y escucha
├── auth/              Módulo de autenticación (rutas, controlador, servicio)
├── wallet/            Módulo de billetera: saldos y operaciones
├── config/            env.ts (entorno), database.ts (pool de PostgreSQL) y reglas de negocio (wallet.ts)
├── docs/              Configuración de Swagger
├── middlewares/       errorHandler y otros middlewares
├── routes/            index.ts (router principal en /api) y rutas de cada módulo
└── utils/             AppError y utilidades compartidas
tests/
├── setup/             Preparación de la base y del entorno de test
├── helpers/           db.ts (reset de la base) y factories.ts (datos de prueba)
└── **/*.test.ts       Tests
```

## Convenciones

### Módulos

Cada dominio tiene su carpeta en `src/` (`auth/`, `wallet/`, ...) con sus archivos `*.routes.ts`, `*.controller.ts` y `*.service.ts`. El router del módulo se registra en `src/routes/index.ts`.

### Capas de un endpoint

```
routes  ->  controller  ->  service  ->  PostgreSQL
```

- **Route:** declara la URL, el middleware y la anotación `@swagger`.
- **Controller:** lee y valida la petición, llama al servicio y responde. Sin SQL.
- **Service:** reglas de negocio y consultas a la base. No conoce `req` ni `res`.

### Errores

Todas las respuestas de error tienen la forma `{ "message": "..." }`.

- Para un error esperado, lanzá `new AppError("mensaje para el usuario", status)`.
- **No hace falta try/catch en los controladores:** Express 5 envía los errores de las funciones `async` al `errorHandler`.
- Cualquier error que no sea `AppError` responde 500 sin mostrar detalles y se registra en la consola.

### Dinero

- En la base, siempre `NUMERIC`, nunca `REAL` ni `FLOAT`.
- Los débitos se hacen con un `UPDATE` condicionado (`... AND amount >= $monto`) dentro de una transacción. Si no actualiza ninguna fila, el saldo es insuficiente.
- Las operaciones que tocan más de una fila (intercambio, transferencia) van en una única transacción (`BEGIN` / `COMMIT` / `ROLLBACK`).

### Migraciones

- **Nunca se edita una migración que ya está en `dev`.** Para cambiar el esquema, se crea una nueva.
- Se numeran con 3 dígitos (`008_...`). Si dos ramas crean la misma numeración, la que mergea segunda renumera la suya antes del merge.
- Cada migración incluye su `-- Down Migration`.

### Ramas y PRs

- Ramas desde `dev`: `feat/...`, `fix/...`, `chore/...`, `refactor/...`, `docs/...`.
- PRs chicos, hacia `dev`, con revisión del otro integrante antes de mergear.
- El CI corre chequeo de tipos, tests y build en cada PR.
- Todo endpoint nuevo llega con su test, su anotación `@swagger` y su fila en [docs/api.md](docs/api.md).

## Deploy (Railway)

- **API en producción:** https://jettywallet-backend-production.up.railway.app/api
- **Documentación:** https://jettywallet-backend-production.up.railway.app/api-docs

La API y la base PostgreSQL viven en un mismo proyecto de Railway. Cada push a `dev` se deploya solo.

Cómo está configurado el servicio de la API (en el panel de Railway, **Settings → Deploy**):

1. **Build:** `npm run build`. Railway lo detecta solo a partir del `package.json`.
2. **Pre-deploy command:** `npm run migrate:up`. Corre las migraciones pendientes antes de cada deploy. Si una falla, el deploy se cancela y sigue funcionando la versión anterior.
3. **Arranque:** `npm start`, también detectado solo.
4. **Healthcheck path:** `/api/health`. Railway no manda tráfico a la versión nueva hasta que responda.

No se usa `railway.json`: Railway dejó de soportar la configuración en archivo para servicios nuevos.

Variables del servicio de la API en Railway:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referencia a la base del proyecto, por la red interna) |
| `JWT_SECRET` | Cadena larga y aleatoria, **distinta** de la de desarrollo |
| `FRONTEND_URL` | URL del front en Vercel (y `http://localhost:5173` si se quiere probar el front local contra producción) |
| `NODE_ENV` | `production` |

`PORT` no se carga: la asigna Railway.

## Tests

```bash
npm test
```

- Los tests de integración usan la base de `DATABASE_URL_TEST`. Antes de correr, se borra su schema y se aplican todas las migraciones desde cero.
- **Nunca** tocan la base de desarrollo, y se niegan a correr si el nombre de la base no termina en `_test`.
- Sin `DATABASE_URL_TEST`, los tests que necesitan base se saltean (con un aviso) y el resto corre igual.

Para crear la base de test local, una sola vez:

```sql
CREATE DATABASE jettywallet_test;
```
