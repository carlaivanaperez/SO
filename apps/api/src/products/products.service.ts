import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateProductInput,
  UpdateProductInput,
  StockAdjustmentInput,
  ImportProductsInput,
  ImportResult,
  Pagination,
} from "@ferrestock/shared";
import { Prisma, StockMovementType } from "@ferrestock/db";

// Convierte un nombre de rubro en un slug simple (para Category.slug).
function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca tildes/diacríticos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  return s || "rubro";
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list({ page, pageSize, search }: Pagination) {
    const where: Prisma.ProductWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
            { barcode: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { stockItems: true, category: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { stockItems: { include: { warehouse: true } }, category: true },
    });
    if (!product) throw new NotFoundException("Producto no encontrado");
    return product;
  }

  create(dto: CreateProductInput) {
    return this.prisma.product.create({ data: dto });
  }

  async update(id: string, dto: UpdateProductInput) {
    const existing = await this.findOne(id);

    // Si cambia el precio, registramos el historial.
    const priceChanged =
      (dto.salePrice !== undefined && dto.salePrice !== Number(existing.salePrice)) ||
      (dto.costPrice !== undefined && dto.costPrice !== Number(existing.costPrice));

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({ where: { id }, data: dto });
      if (priceChanged) {
        await tx.priceHistory.create({
          data: {
            productId: id,
            costPrice: updated.costPrice,
            salePrice: updated.salePrice,
          },
        });
      }
      return updated;
    });
  }

  /**
   * Ajusta stock creando un StockMovement (libro mayor) y actualizando el
   * StockItem (snapshot) en una sola transacción para mantenerlos consistentes.
   */
  async adjustStock(productId: string, dto: StockAdjustmentInput, userId?: string) {
    await this.findOne(productId);
    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          productId,
          warehouseId: dto.warehouseId,
          type: dto.type as StockMovementType,
          quantity: dto.quantity,
          reason: dto.reason,
          userId,
        },
      });
      await tx.stockItem.upsert({
        where: { productId_warehouseId: { productId, warehouseId: dto.warehouseId } },
        create: {
          productId,
          warehouseId: dto.warehouseId,
          quantity: dto.quantity,
        },
        update: { quantity: { increment: dto.quantity } },
      });
      return movement;
    });
  }

  /**
   * Importación masiva de productos desde un archivo (CSV/Excel).
   * Crea o actualiza por SKU. Si la fila trae `stock`, lo fija (movimiento de
   * ajuste). Procesa fila por fila: una fila con error no frena el resto.
   */
  async importProducts(dto: ImportProductsInput, userId?: string): Promise<ImportResult> {
    const warehouse = await this.prisma.warehouse.findFirst({ where: { isDefault: true } });
    if (!warehouse) throw new BadRequestException("No hay depósito por defecto configurado");

    const catCache = new Map<string, string>();
    const result: ImportResult = { created: 0, updated: 0, errors: [] };

    const resolveCategory = async (name: string): Promise<string> => {
      const key = name.trim().toLowerCase();
      const cached = catCache.get(key);
      if (cached) return cached;
      let cat = await this.prisma.category.findFirst({
        where: { name: { equals: name.trim(), mode: "insensitive" } },
      });
      if (!cat) {
        const base = slugify(name);
        let slug = base;
        let n = 2;
        while (await this.prisma.category.findUnique({ where: { slug } })) slug = `${base}-${n++}`;
        cat = await this.prisma.category.create({ data: { name: name.trim(), slug } });
      }
      catCache.set(key, cat.id);
      return cat.id;
    };

    for (let i = 0; i < dto.items.length; i++) {
      const row = dto.items[i]!;
      try {
        const categoryId = row.category ? await resolveCategory(row.category) : undefined;
        const data = {
          name: row.name,
          brand: row.brand ?? null,
          barcode: row.barcode ?? null,
          unit: row.unit,
          costPrice: row.costPrice,
          salePrice: row.salePrice,
          taxRate: row.taxRate,
          ...(categoryId ? { categoryId } : {}),
        };

        const existing = await this.prisma.product.findUnique({ where: { sku: row.sku } });
        let productId: string;
        if (existing) {
          await this.prisma.product.update({ where: { id: existing.id }, data });
          productId = existing.id;
          result.updated++;
        } else {
          const created = await this.prisma.product.create({ data: { sku: row.sku, ...data } });
          productId = created.id;
          result.created++;
        }

        // Fijar stock (absoluto) si vino en la fila.
        if (row.stock !== undefined && !Number.isNaN(row.stock)) {
          const si = await this.prisma.stockItem.findUnique({
            where: { productId_warehouseId: { productId, warehouseId: warehouse.id } },
          });
          const current = si ? Number(si.quantity) : 0;
          const delta = row.stock - current;
          if (delta !== 0) {
            await this.prisma.$transaction([
              this.prisma.stockMovement.create({
                data: {
                  productId,
                  warehouseId: warehouse.id,
                  type: StockMovementType.ADJUSTMENT,
                  quantity: new Prisma.Decimal(delta),
                  reason: "Importación",
                  userId,
                },
              }),
              this.prisma.stockItem.upsert({
                where: { productId_warehouseId: { productId, warehouseId: warehouse.id } },
                create: { productId, warehouseId: warehouse.id, quantity: new Prisma.Decimal(row.stock) },
                update: { quantity: { increment: delta } },
              }),
            ]);
          }
        }
      } catch (e) {
        result.errors.push({
          row: i + 1,
          sku: row.sku,
          message: e instanceof Error ? e.message : "Error desconocido",
        });
      }
    }

    return result;
  }
}
