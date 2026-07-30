// Datos de ejemplo para desarrollo. Ejecutar con: pnpm db:seed
import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient, UserRole, ProductUnit } from "@prisma/client";
import * as argon2 from "argon2";

// El .env vive en la raíz del monorepo; el seed corre desde packages/db.
config({ path: resolve(process.cwd(), "../../.env") });

const prisma = new PrismaClient();

async function main() {
  const adminHash = await argon2.hash("admin1234");

  const warehouse = await prisma.warehouse.upsert({
    where: { id: "wh_default" },
    update: {},
    create: { id: "wh_default", name: "Depósito principal", isDefault: true },
  });

  await prisma.user.upsert({
    where: { email: "admin@ferreteria.local" },
    update: {},
    create: {
      email: "admin@ferreteria.local",
      name: "Administrador",
      role: UserRole.ADMIN,
      passwordHash: adminHash,
    },
  });

  const herramientas = await prisma.category.upsert({
    where: { slug: "herramientas" },
    update: {},
    create: { name: "Herramientas", slug: "herramientas" },
  });

  const productos = [
    { sku: "MAR-001", name: 'Martillo carpintero 25mm', brand: "Stanley", salePrice: 8500, qty: 24 },
    { sku: "TOR-114", name: 'Tornillo autoperforante 1/4"', brand: "Genérico", unit: ProductUnit.BOX, salePrice: 3200, qty: 8 },
    { sku: "CAB-2X15", name: "Cable unipolar 2.5mm", brand: "Prysmian", unit: ProductUnit.METER, salePrice: 780, qty: 300 },
  ];

  for (const p of productos) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: { salePrice: p.salePrice },
      create: {
        sku: p.sku,
        name: p.name,
        brand: p.brand,
        unit: p.unit ?? ProductUnit.UNIT,
        salePrice: p.salePrice,
        categoryId: herramientas.id,
      },
    });
    await prisma.stockItem.upsert({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
      update: { quantity: p.qty },
      create: { productId: product.id, warehouseId: warehouse.id, quantity: p.qty, minQuantity: 5 },
    });
  }

  console.log("✔ Seed completado");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
