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

> Estado actual: **andamiaje (scaffold) inicial**. La arquitectura, el modelo de
> datos y los flujos centrales están definidos y son coherentes entre sí, pero
> faltan piezas marcadas con `TODO` (auth real, UI completa, tests). Ver §8.

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

---

## 4. Comandos clave

Todos desde la raíz (Turborepo orquesta los workspaces):

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Levanta api + web + mobile en modo watch |
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
  `costPrice`, `salePrice`, `taxRate` (IVA).
- **PriceHistory** — cada cambio de precio queda registrado.
- **Warehouse** / **StockItem** — stock actual por depósito (snapshot) + `minQuantity` (reposición).
- **StockMovement** — libro mayor append-only de movimientos
  (`PURCHASE/SALE/ADJUSTMENT/RETURN/TRANSFER`). **El stock real es la suma de
  los movimientos**; `StockItem.quantity` es un caché para lectura rápida.
- **Customer** — clientes; `phone` en **E.164** es la clave para vincular WhatsApp.
- **Sale** / **SaleItem** — ventas con precio **congelado** al momento de la venta.
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

## 7. Convenciones

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

## 8. Estado y próximos pasos (TODO)

Lo que **falta** y conviene abordar en este orden:

1. **Auth real**: módulo de autenticación con JWT (`@nestjs/jwt`) + `argon2` para
   hashear (el seed usa un hash de dev). Guards por rol. Reemplazar el
   `userId = "dev-user"` en `sales.controller.ts`.
2. **Migraciones**: no hay migración inicial commiteada aún → correr `pnpm db:migrate` para generarla.
3. **UI web/mobile**: hoy solo hay listado de catálogo. Falta POS, alta/edición de
   productos, ajustes de stock, reportes.
4. **Tests**: no hay tests todavía. Priorizar la lógica de `sales.service` (cálculo
   de totales, descuento de stock) y el matching de WhatsApp.
5. **Matching de productos en WhatsApp**: hoy es `contains` simple; mejorar con
   full-text search de Postgres o similar.
6. **Deploy/CI**: sin pipeline aún.

Cuando completes un punto, actualizá esta sección y las partes relevantes del archivo.

---

## 9. Flujo de trabajo con Git

- Rama de desarrollo designada: **`claude/claude-md-docs-pn5uln`**. Desarrollá y pusheá ahí.
- Commits descriptivos. No pushear a otra rama sin permiso explícito.
- No crear Pull Request salvo que el usuario lo pida.
- No commitear `.env` ni secretos (WhatsApp/JWT).

---

## 10. Mantener este archivo

Si cambiás la arquitectura, agregás un workspace, cambiás comandos, o modificás
el modelo de datos o convenciones: **actualizá `CLAUDE.md` en el mismo cambio**.
Un `CLAUDE.md` desactualizado es peor que no tenerlo.
