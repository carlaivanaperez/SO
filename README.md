# FerreStock 🛠️

Sistema de gestión para ferretería mediana: **ventas, control de stock, precios**
y **consultas de stock por WhatsApp** para clientes.

Web (panel), móvil (Android/iOS) y una API común. Todo en TypeScript.

## Características

- 🧾 **Ventas / POS**: comprobantes, precios congelados, descuento automático de stock.
- 📦 **Stock**: inventario por depósito, punto de reposición, libro de movimientos auditable.
- 🏷️ **Precios**: costo, venta, IVA e historial de cambios.
- 💬 **WhatsApp**: un bot responde automáticamente la disponibilidad y el precio de
  un producto cuando el cliente consulta por WhatsApp (Cloud API oficial de Meta).

## Stack

| Capa | Tecnología |
|---|---|
| Web | Next.js 14 (App Router) |
| Móvil | Expo / React Native |
| API | NestJS 10 |
| Datos | PostgreSQL + Prisma |
| Compartido | Zod (tipos y validaciones) |
| Monorepo | pnpm workspaces + Turborepo |

## Arranque rápido

```bash
pnpm install
cp .env.example .env
docker compose up -d db
pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm dev
```

API en `:3001`, web en `:3000`, móvil vía Expo.

## Documentación

La guía de arquitectura, convenciones y flujos de trabajo está en
**[`CLAUDE.md`](./CLAUDE.md)** — leerla antes de contribuir.

## Estructura

```
apps/api      API REST (NestJS) + webhooks de WhatsApp
apps/web      Panel de administración (Next.js)
apps/mobile   App móvil (Expo)
packages/db   Esquema Prisma + cliente (PostgreSQL)
packages/shared  Tipos y validaciones Zod compartidos
```
