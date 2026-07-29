import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateSaleInput } from "@ferrestock/shared";
import { Prisma, SaleStatus, StockMovementType } from "@ferrestock/db";

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una venta COMPLETED de forma atómica:
   *  1. congela precios de cada ítem,
   *  2. calcula subtotal/IVA/total,
   *  3. descuenta stock generando StockMovement por ítem.
   * Si algo falla (ej: sin stock), la transacción entera se revierte.
   */
  async create(dto: CreateSaleInput, userId: string) {
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const defaultWarehouse = await this.prisma.warehouse.findFirst({
      where: { isDefault: true },
    });
    if (!defaultWarehouse) throw new BadRequestException("No hay depósito por defecto configurado");

    return this.prisma.$transaction(async (tx) => {
      let subtotal = new Prisma.Decimal(0);
      let tax = new Prisma.Decimal(0);

      const items = dto.items.map((item) => {
        const product = byId.get(item.productId);
        if (!product) throw new NotFoundException(`Producto ${item.productId} no existe`);

        const unitPrice = new Prisma.Decimal(item.unitPrice ?? Number(product.salePrice));
        const lineGross = unitPrice.times(item.quantity).minus(item.discount);
        const lineTax = lineGross.times(product.taxRate).div(100);

        subtotal = subtotal.plus(lineGross);
        tax = tax.plus(lineTax);

        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
          discount: item.discount,
          total: lineGross,
        };
      });

      const total = subtotal.plus(tax).minus(dto.discount);

      const sale = await tx.sale.create({
        data: {
          userId,
          customerId: dto.customerId,
          status: SaleStatus.COMPLETED,
          paymentMethod: dto.paymentMethod,
          subtotal,
          tax,
          discount: dto.discount,
          total,
          items: { create: items },
        },
        include: { items: true },
      });

      // Descontar stock + registrar movimientos.
      for (const item of dto.items) {
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId: defaultWarehouse.id,
            type: StockMovementType.SALE,
            quantity: new Prisma.Decimal(item.quantity).negated(),
            saleId: sale.id,
            userId,
          },
        });
        await tx.stockItem.update({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: defaultWarehouse.id,
            },
          },
          data: { quantity: { decrement: item.quantity } },
        });
      }

      return sale;
    });
  }

  findOne(id: string) {
    return this.prisma.sale.findUniqueOrThrow({
      where: { id },
      include: { items: { include: { product: true } }, customer: true },
    });
  }
}
