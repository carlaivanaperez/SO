import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateSaleInput, SalesQuery } from "@ferrestock/shared";
import { Prisma, SaleStatus, StockMovementType } from "@ferrestock/db";

// Argentina no usa horario de verano: offset fijo -3h.
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Inicio (00:00 hora AR) de una fecha "YYYY-MM-DD", expresado en UTC.
function arDayStart(dateStr: string): Date {
  const parts = dateStr.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return new Date(Date.UTC(y, m - 1, d) + AR_OFFSET_MS);
}

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  // Historial de ventas con filtros por fecha, medio de pago y producto.
  async list(q: SalesQuery) {
    const where: Prisma.SaleWhereInput = { status: SaleStatus.COMPLETED };

    if (q.from || q.to) {
      where.createdAt = {};
      if (q.from) where.createdAt.gte = arDayStart(q.from);
      if (q.to) where.createdAt.lte = new Date(arDayStart(q.to).getTime() + DAY_MS - 1);
    }
    if (q.paymentMethod) where.paymentMethod = q.paymentMethod;
    if (q.product) {
      where.items = {
        some: {
          product: {
            OR: [
              { name: { contains: q.product, mode: "insensitive" } },
              { sku: { contains: q.product, mode: "insensitive" } },
            ],
          },
        },
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true,
          number: true,
          total: true,
          createdAt: true,
          paymentMethod: true,
          user: { select: { name: true } },
          customer: { select: { name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.sale.count({ where }),
    ]);

    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  /**
   * Crea una venta COMPLETED de forma atómica:
   *  1. congela precios de cada ítem,
   *  2. calcula subtotal/IVA/total,
   *  3. descuenta stock generando StockMovement por ítem.
   * Si algo falla (ej: sin stock), la transacción entera se revierte.
   */
  async create(dto: CreateSaleInput, userId: string) {
    // Las ventas a cuenta corriente deben tener un cliente asociado.
    if (dto.paymentMethod === "ACCOUNT" && !dto.customerId) {
      throw new BadRequestException("Las ventas a cuenta corriente requieren elegir un cliente");
    }

    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const defaultWarehouse = await this.prisma.warehouse.findFirst({
      where: { isDefault: true },
    });
    if (!defaultWarehouse) throw new BadRequestException("No hay depósito por defecto configurado");

    // Validar stock disponible: no permitir vender más de lo que hay.
    const stockItems = await this.prisma.stockItem.findMany({
      where: { warehouseId: defaultWarehouse.id, productId: { in: productIds } },
    });
    const stockMap = new Map(stockItems.map((s) => [s.productId, s.quantity]));
    const qtyByProduct = new Map<string, number>();
    for (const it of dto.items) {
      qtyByProduct.set(it.productId, (qtyByProduct.get(it.productId) ?? 0) + it.quantity);
    }
    for (const [pid, qty] of qtyByProduct) {
      const product = byId.get(pid);
      if (!product) throw new NotFoundException(`Producto ${pid} no existe`);
      const available = stockMap.get(pid) ?? new Prisma.Decimal(0);
      if (available.lessThan(qty)) {
        throw new BadRequestException(
          `Stock insuficiente de "${product.name}": disponible ${available.toString()}, pedido ${qty}`
        );
      }
    }

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
        // upsert (no update): si el producto aún no tenía registro de stock en
        // el depósito, lo crea (en negativo) en vez de reventar la venta.
        await tx.stockItem.upsert({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: defaultWarehouse.id,
            },
          },
          create: {
            productId: item.productId,
            warehouseId: defaultWarehouse.id,
            quantity: new Prisma.Decimal(item.quantity).negated(),
          },
          update: { quantity: { decrement: item.quantity } },
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
