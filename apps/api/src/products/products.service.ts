import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateProductInput,
  UpdateProductInput,
  StockAdjustmentInput,
  Pagination,
} from "@ferrestock/shared";
import { Prisma, StockMovementType } from "@ferrestock/db";

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
}
