# CLAUDE.md

Guía para asistentes de IA (y personas) que trabajen en este repositorio.
Leé este archivo antes de hacer cambios. Está en español porque el equipo y el
dominio (una ferretería) lo son; el **código y los identificadores van en inglés**.

---

## 1. Qué es este proyecto

**FerreStock** es un sistema de gestión para una ferretería mediana. Cubre:

- **Ventas** (punto de venta / POS): crear ventas, congelar precios, descontar stock.
- **Control de stock**: inventario por depósito, punto de reposición, libro de movimientos auditable.
- **Precios de productos**: precio de costo/venta, IVA, historial de precios.
- **Consultas por WhatsApp**: un cliente le escribe al WhatsApp del negocio el
  nombre o código de un producto y un **bot responde automáticamente** si hay
  stock y a qué precio, para decidir si se acerca a comprar.

Se entrega como **app web** (panel de administración) y **app móvil**
(Android/iOS), ambas contra la misma API.

> Estado actual: **andamiaje (scaffold) en progreso**. La arquitectura, el modelo
> de datos, la **autenticación (JWT + roles)** y los flujos centrales están
> definidos y son coherentes. Falta UI completa, tests y deploy. Ver §9.

---

## 2. Arquitectura y stack

Monorepo **TypeScript** gestionado con **pnpm workspaces + Turborepo**.

```
apps/
  api/       API REST — NestJS 10 (backend, webhooks de WhatsApp)
  web/       Panel de administración — Next.js 14 (App Router)
  mobile/    App móvil — Expo / React Native (expo-router)
packages/
  db/        Prisma schema + cliente Prisma (PostgreSQL). Fuente de verdad del modelo de datos.
  shared/    Tipos y esquemas Zod compartidos entre api/web/mobile (DTOs, validaciones)
```

**Flujo de dependencias** (respetarlo — nunca invertirlo):

```
web  ─┐
mobile┤─→ shared ──→ (solo tipos/zod, sin acceso a DB)
api  ─┴─→ shared + db
```

- Solo **`api`** habla con la base de datos (vía `@ferrestock/db`).
- **`web`** y **`mobile`** nunca importan `@ferrestock/db` ni tocan Prisma; consumen la API por HTTP.
- **`shared`** no depende de nada del proyecto: son tipos y validaciones puras.

**Decisiones ya tomadas** (no reabrir sin pedirlo al usuario):
Stack TypeScript full-stack · PostgreSQL + Prisma · **WhatsApp Cloud API oficial de Meta**.

---

## 3. Puesta en marcha (desarrollo)

```bash
# 1. Requisitos: Node ≥20, pnpm ≥9, Docker (para Postgres)
pnpm install

# 2. Variables de entorno
cp .env.example .env        # completar credenciales de WhatsApp si se prueban webhooks

# 3. Base de datos
docker compose up -d db     # levanta PostgreSQL en localhost:5432
pnpm db:generate            # genera el cliente Prisma
pnpm db:migrate             # aplica migraciones
pnpm db:seed                # datos de ejemplo (usuario admin + productos)

# 4. Levantar todo (Turborepo corre api + web + mobile en paralelo)
pnpm dev
```

URLs por defecto: API `http://localhost:3001/api` · Web `http://localhost:3000`
· Mobile por Expo (QR / emulador).

Usuario seed: `admin@ferreteria.local` / `admin1234` (solo dev).

**Base de datos:** Prisma usa `DATABASE_URL` (conexión *pooled*, para la app) y
`DIRECT_URL` (conexión directa, para migraciones) — ver `datasource db` en el
schema. En local con Docker, ambas apuntan a la misma URL. El `.env` vive en la
**raíz**; la API (`apps/api/src/load-env.ts`) y el seed lo cargan solos con
`dotenv`, así que no hace falta copiarlo a cada paquete.

**Paquetes internos:** `@ferrestock/shared` y `@ferrestock/db` se **compilan a
JS** (`dist/`, `main` apunta ahí) porque la API los consume en runtime. Por eso
las tasks `dev`/`typecheck`/`test` dependen de `^build` en `turbo.json`: Turbo
los compila antes. Si corrés un workspace suelto con `pnpm --filter`, buildeá
`shared`/`db` primero.

**Postgres en la nube (Neon):** alternativa gratis a Docker, sin depender de una
PC. En Neon: crear proyecto → copiar las dos cadenas ("Pooled connection" →
`DATABASE_URL`; conexión directa → `DIRECT_URL`) al `.env`, y correr
`pnpm db:migrate && pnpm db:seed`. No hace falta `docker compose up`. La base en
la nube guarda los datos; la API/web se pueden correr localmente o también
hospedarse (deploy: §9).

---

## 4. Comandos clave

Todos desde la raíz (Turborepo orquesta los workspaces):

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Levanta api + web + mobile en modo watch |
| `pnpm dev:app` | Levanta solo api + web (compila `shared`/`db` antes). Ideal para el panel |
| `pnpm build` | Compila todos los paquetes respetando el orden de dependencias |
| `pnpm typecheck` | Chequeo de tipos en todo el monorepo |
| `pnpm lint` | Linting |
| `pnpm test` | Tests |
| `pnpm format` | Prettier sobre todo el repo |
| `pnpm db:generate` | Regenera el cliente Prisma (correr tras editar el schema) |
| `pnpm db:migrate` | Crea/aplica migración en dev |
| `pnpm db:seed` | Carga datos de ejemplo |
| `pnpm db:studio` | Abre Prisma Studio (inspeccionar la DB) |

Para un solo workspace: `pnpm --filter @ferrestock/api dev`.

**Antes de commitear**, corré `pnpm typecheck` y `pnpm lint`.

---

## 5. Modelo de datos (`packages/db/prisma/schema.prisma`)

Es la **fuente de verdad**. Entidades principales:

- **User** — staff del panel. Roles: `ADMIN`, `MANAGER`, `CASHIER`.
- **Category** — árbol de rubros (auto-relación `parentId`).
- **Product** — SKU, código de barras, unidad (`UNIT/KG/METER/LITER/BOX`),
  `costPrice`, `salePrice`, `taxRate` (IVA). **`salePrice` es precio final con IVA
  incluido** (lo que paga el cliente): en la venta el IVA no se suma, se desglosa
  como la parte contenida (`sale.subtotal` = neto, `sale.tax` = IVA incluido,
  `sale.total` = suma de precios finales − descuento). Ver `sales.service.create`.
- **PriceHistory** — cada cambio de precio queda registrado.
- **Warehouse** / **StockItem** — stock actual por depósito (snapshot) + `minQuantity` (reposición).
- **StockMovement** — libro mayor append-only de movimientos
  (`PURCHASE/SALE/ADJUSTMENT/RETURN/TRANSFER`). **El stock real es la suma de
  los movimientos**; `StockItem.quantity` es un caché para lectura rápida.
- **Customer** — clientes; `phone` en **E.164** es la clave para vincular WhatsApp.
- **CustomerPayment** — pagos a la **cuenta corriente** de un cliente. El saldo se
  calcula: ventas con `paymentMethod ACCOUNT` (cargos) − pagos. No se guarda un
  campo de saldo; se computa (como el stock).
- **Sale** / **SaleItem** — ventas con precio **congelado** al momento de la venta.
  Las ventas a **cuenta corriente** pueden financiarse en cuotas:
  `installmentsCount` (N) y `financingSurcharge` (recargo, ya incluido en `total`).
- **Installment** — cuota de una venta financiada (número, monto, `dueDate`). El
  estado (pagada/parcial/vencida) **no se guarda**: se deriva imputando los pagos
  del cliente a las obligaciones por vencimiento (más vieja primero) y la **mora**
  se calcula al leer (`lateFeeDailyPercent` × días de atraso). Ver `customers.service.findOne`.
- **FinanceConfig** (fila única id=1) + **InstallmentOption** — configuración
  editable por ADMIN: escala de recargo por cuotas (ej. 3→10%, 6→25%) y tasa de
  mora (%/día). Se crean con valores por defecto de forma perezosa (`FinanceService.getConfig`),
  así funciona en prod sin seed. Endpoints en `apps/api/src/finance/` (`GET /api/finance/config`
  abierto; `PATCH` solo ADMIN). Helpers de cálculo puros en `packages/shared/src/finance.ts`.
- **WhatsAppQuery** — registro de cada consulta entrante por WhatsApp (auditoría y métricas de demanda).

**Invariante crítico:** todo cambio de stock se hace en una **transacción** que
crea un `StockMovement` **y** actualiza el `StockItem` juntos. Nunca modifiques
`StockItem.quantity` sin su movimiento (ver `products.service.ts:adjustStock` y
`sales.service.ts:create`).

---

## 6. Integración con WhatsApp (Cloud API de Meta)

Código en `apps/api/src/whatsapp/`.

- **`whatsapp.controller.ts`**
  - `GET /api/whatsapp/webhook` → handshake de verificación (compara `hub.verify_token` con `WHATSAPP_VERIFY_TOKEN`).
  - `POST /api/whatsapp/webhook` → mensajes entrantes. Responde `200` de inmediato y procesa en background.
- **`whatsapp.service.ts`**
  - Valida la firma `X-Hub-Signature-256` con `WHATSAPP_APP_SECRET` (HMAC + `timingSafeEqual`). **No aflojar esta validación en producción.**
  - `handleIncomingText` → registra la consulta, matchea producto (SKU/barcode/nombre) y responde disponibilidad + precio.
- **`whatsapp.client.ts`** — envía respuestas vía Graph API. Sin credenciales (dev), solo loguea.

Requiere capturar el **raw body** para validar la firma → configurado en `main.ts`.
Para probar webhooks localmente hace falta exponer la API con un túnel (ngrok/cloudflared) y cargar la URL en el panel de Meta.

Los secretos de WhatsApp van **solo en `.env`** (nunca commiteados). Ver `.env.example`.

---

## 7. Autenticación y roles (`apps/api/src/auth/`)

- **Login**: `POST /api/auth/login` (email + password) → devuelve `{ token, user }`.
  El password se verifica con **argon2**.
- **JWT**: firmado con `JWT_SECRET`, expira según `JWT_EXPIRES_IN` (7 días por
  defecto). El payload es `{ sub, email, role }`.
- **Guards**: `JwtAuthGuard` valida el `Authorization: Bearer <token>` y adjunta
  el usuario a `request.user`. `RolesGuard` + el decorador `@Roles(...)` restringen
  por rol. El decorador `@CurrentUser()` inyecta el usuario en el handler.
- **Roles**: `ADMIN` (todo), `MANAGER` (catálogo, precios, stock, reportes),
  `CASHIER` (solo vende). Ej: crear/editar productos requiere `ADMIN`/`MANAGER`;
  registrar staff (`POST /api/auth/register`) requiere `ADMIN`.
- **El vendedor (`CASHIER`) no ve facturación del negocio.** Enforced en la API,
  no solo en la UI: `GET /api/sales` (historial) es `@Roles("ADMIN","MANAGER")`,
  y `GET /api/reports/summary` omite el dinero del día (`today.revenue = null`) y
  las últimas ventas cuando el rol es `CASHIER`. `POST /api/sales` (crear venta)
  y `GET /api/sales/:id` (comprobante) siguen abiertos para que pueda vender e
  imprimir. En la web: `TopTabs` oculta la pestaña "Ventas", el dashboard esconde
  el KPI de dinero y "Últimas ventas", y `/ventas` redirige al vendedor a `/`.
- El endpoint de webhook de WhatsApp **no** usa estos guards: se protege con la
  firma de Meta (ver §6).

Para consumir la API protegida desde web/mobile: guardar el `token` del login y
mandarlo en `Authorization: Bearer <token>` en cada request.

## 8. Convenciones

- **Idioma:** código, identificadores, tablas y tipos en **inglés**; comentarios,
  mensajes de UI y textos de cara al cliente en **español (es-AR)**.
- **Validación:** todo input externo se valida con **Zod** desde `@ferrestock/shared`.
  En la API se usa `ZodValidationPipe`. No dupliques esquemas: definilos una vez en `shared`.
- **Tipos compartidos:** si un tipo lo usan front y back, vive en `packages/shared`. No lo redefinas.
- **Dinero/cantidades:** `Decimal` de Prisma en la DB y en cálculos del backend
  (nunca `float` para plata). En la UI se formatea con `toLocaleString("es-AR")`.
- **Teléfonos:** siempre **E.164** (`+549...`). Hay un `phoneE164` en `shared/common.ts`.
- **Transacciones:** operaciones que tocan stock o ventas van en `prisma.$transaction`.
- **Estilo:** Prettier (2 espacios, comillas dobles). No pelear con el formateo manual.
- **Nombres de tabla:** `snake_case` vía `@@map`/`@map`; modelos Prisma en `PascalCase`.

---

## 9. Estado y próximos pasos (TODO)

Ya hecho: modelo de datos, **auth JWT + roles**, migración inicial
(`packages/db/prisma/migrations/`), flujos de ventas y stock, bot de WhatsApp,
**deploy en producción** (§12), y en la **web**: login, **dashboard** con
indicadores (ventas del día, dinero, stock bajo, últimas ventas), catálogo con
**stock tipo semáforo**, **POS** (punto de venta), **ABM de productos**,
**ajustes de stock**, **branding** (logo + paleta amarillo/negro/blanco) y
**modo oscuro**.

**UI web** (`apps/web/src/`): `lib/auth.ts` guarda el token JWT en `localStorage`
y expone `canManage()` (gate de ADMIN/MANAGER); `lib/api.ts` es el cliente HTTP
que adjunta `Authorization: Bearer`. `app/globals.css` es el sistema de diseño
(variables de tema claro/oscuro). Componentes: `AppHeader` (logo + nav + toggle),
`ThemeToggle`, `ProductForm`. Rutas: `/login`, `/` (dashboard + catálogo), `/pos`
(carrito + venta + selección de cliente), `/ventas` (historial con filtros) +
`/ventas/[id]` (detalle + imprimir), `/clientes` (+ `/new`, `/[id]` con saldo y
pagos + **cuotas/mora**, `/[id]/edit`), `/products/new`, `/products/[id]/edit`,
`/products/[id]/stock` y `/configuracion` (solo ADMIN: escala de recargo por cuotas
+ tasa de mora). El POS ofrece **financiar en cuotas** con recargo opcional cuando el
pago es cuenta corriente.
El dashboard consume `GET /api/reports/summary`; el historial `GET /api/sales`
(filtros: `from`/`to`/`paymentMethod`/`product`); clientes `GET /api/customers`
(con saldo) y `POST /api/customers/:id/payments`. Todas las páginas son client
components y redirigen a `/login` ante un `401`. El logo va en
`apps/web/public/logo.png`.

Lo que **falta**, en orden sugerido:

1. **Más reportes** (ventas por período, más vendidos) y la app **mobile**
   completa (hoy solo lista el catálogo). El dashboard base ya está. **Margen/ganancia**
   ya está: cálculo neto vs neto (costo y venta con IVA incluido) en
   `packages/shared/src/margin.ts` (`computeMargin`, `priceFromMargin`), ganancia y
   margen en vivo en `ProductForm` (+ "sugerir precio por margen"), y reporte
   `/margenes` (solo ADMIN/MANAGER) vía `GET /api/reports/margins`.
2. **Tests**: hay tests unitarios (Jest) de `sales.service` (totales/IVA,
   congelado de precio, descuento de stock) y `products.service` (ajuste de
   stock, historial de precios). Falta cubrir el **matching de WhatsApp** y sumar
   tests de integración/e2e. Los tests mockean Prisma (no requieren base). Se
   corren con `pnpm test`.
3. **Matching de productos en WhatsApp**: hoy es `contains` simple; mejorar con
   full-text search de Postgres o similar.
4. **Guía de uso** in-app ya está: pantalla `/ayuda` (`app/ayuda/page.tsx`),
   didáctica y para público no técnico, con temas desplegables (`<details>`)
   filtrados por rol (el vendedor no ve stock/equipo/config). Pestaña "Ayuda"
   visible para todos. **Roles y usuarios** también: pantalla `/usuarios` (solo
   ADMIN) para crear staff y asignar rol; nombres/descripciones en
   `roleLabels`/`roleDescriptions` (shared). **Clientes y cuentas corrientes** también.
5. **Comprobante por WhatsApp** (imprimir ya está en `/ventas/[id]`). El
   **historial de ventas** con filtros ya está hecho. **Compartir producto por
   WhatsApp** a un grupo/comunidad ya está: ícono en el catálogo (`app/page.tsx`)
   y botón en editar producto; helpers `whatsappShareUrl`/`whatsappProductMessage`
   en `shared/common.ts` (link `wa.me/?text=` sin destinatario → abre el selector).
6. **CI**: sin pipeline de tests automáticos aún (el deploy sí está, §12).

Cuando completes un punto, actualizá esta sección y las partes relevantes del archivo.

**Estado de verificación:** `pnpm typecheck` pasa en los 5 paquetes,
`pnpm test` corre 19 tests unitarios en verde (incluye cálculo de cuotas/mora) y
`pnpm --filter @ferrestock/web build` compila la web. Corriendo en producción
(§12) contra Postgres en Neon.

---

## 12. Deploy (producción)

La app está **publicada** y en uso:

- 🖥️ **Web:** https://elalmacendelferretero.vercel.app (Vercel)
- ⚙️ **API:** https://ferrestock-api.onrender.com (Render)

Tres piezas:

- **Base de datos:** **Neon** (Postgres serverless). Dos cadenas: `DATABASE_URL`
  (pooled) y `DIRECT_URL` (directa). Ver §3.
- **API:** **Render** (`render.yaml` en la raíz, Blueprint). Build:
  `npm i -g pnpm && pnpm install && pnpm turbo run build --filter=@ferrestock/api`;
  start: `node apps/api/dist/main.js`; health: `GET /api/health`. Variables en el
  panel de Render (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `WEB_ORIGIN`
  opcional). Escucha en `process.env.PORT`.
- **Web:** **Vercel** (`apps/web/vercel.json`, Root Directory `apps/web`). Compila
  `shared` antes que `web`. Variable `API_PUBLIC_URL` = URL pública de la API en
  Render (la inyecta como `NEXT_PUBLIC_API_URL` vía `next.config.mjs`).

Ambos (Render y Vercel) auto-deployan al pushear a la rama por defecto
(`claude/claude-md-docs-pn5uln`). `.node-version` fija Node 20 para builds
deterministas.

**Migraciones en producción:** el `startCommand` de Render corre
`prisma migrate deploy` antes de arrancar la API, así las migraciones nuevas se
aplican solas en Neon en cada deploy (el plan free no soporta pre-deploy).

---

## 10. Flujo de trabajo con Git

- Rama de desarrollo designada: **`claude/claude-md-docs-pn5uln`**. Desarrollá y pusheá ahí.
- Commits descriptivos. No pushear a otra rama sin permiso explícito.
- No crear Pull Request salvo que el usuario lo pida.
- No commitear `.env` ni secretos (WhatsApp/JWT).

---

## 11. Mantener este archivo

Si cambiás la arquitectura, agregás un workspace, cambiás comandos, o modificás
el modelo de datos o convenciones: **actualizá `CLAUDE.md` en el mismo cambio**.
Un `CLAUDE.md` desactualizado es peor que no tenerlo.
