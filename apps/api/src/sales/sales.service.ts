import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  surchargeForInstallments,
  splitInstallmentAmounts,
  type CreateSaleInput,
  type SalesQuery,
} from "@ferrestock/shared";
import { Prisma, SaleStatus, StockMovementType } from "@ferrestock/db";
import { FinanceService } from "../finance/finance.service";

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

// Suma `months` meses a una fecha, acotando el día si el mes destino es más
// corto (ej: 31/ene + 1 mes → 28/feb).
function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService
  ) {}

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

    // Plan de cuotas: solo aplica a cuenta corriente. Resuelve el recargo (%)
    // de la escala vigente. `financePlan` es null si la venta no se financia.
    const financeInstallments =
      dto.paymentMethod === "ACCOUNT" && dto.installments ? dto.installments : null;
    let financePlan: { count: number; surchargePercent: number } | null = null;
    if (financeInstallments) {
      const config = await this.finance.getConfig();
      const surcharge = surchargeForInstallments(config.options, financeInstallments);
      if (surcharge === null) {
        throw new BadRequestException(`La opción de ${financeInstallments} cuotas no está habilitada`);
      }
      financePlan = {
        count: financeInstallments,
        surchargePercent: dto.applyFinancingSurcharge ? surcharge : 0,
      };
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

        // Los precios de venta ya incluyen IVA (precio final al público). El
        // IVA no se suma: se calcula como la parte ya contenida en el precio.
        const unitPrice = new Prisma.Decimal(item.unitPrice ?? Number(product.salePrice));
        const lineFinal = unitPrice.times(item.quantity).minus(item.discount); // IVA incluido
        const divisor = new Prisma.Decimal(product.taxRate).div(100).plus(1); // ej: 1.21
        const lineNet = lineFinal.div(divisor).toDecimalPlaces(2); // neto sin IVA
        const lineTax = lineFinal.minus(lineNet); // IVA contenido en el precio

        subtotal = subtotal.plus(lineNet);
        tax = tax.plus(lineTax);

        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
          discount: item.discount,
          total: lineFinal, // total de la línea = lo que paga el cliente (IVA incl.)
        };
      });

      // total = neto + IVA − descuento = suma de precios finales − descuento.
      const baseTotal = subtotal.plus(tax).minus(dto.discount);

      // Recargo por financiación (0 si no se financia o no se aplica recargo).
      // El total de la venta ya lo incluye, así que el saldo de cuenta corriente
      // refleja el monto financiado.
      const financingSurcharge = financePlan
        ? baseTotal.times(financePlan.surchargePercent).div(100)
        : new Prisma.Decimal(0);
      const total = baseTotal.plus(financingSurcharge);

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
          installmentsCount: financePlan ? financePlan.count : null,
          financingSurcharge,
          items: { create: items },
        },
        include: { items: true },
      });

      // Cronograma de cuotas: monto (con recargo prorrateado) + vencimiento
      // mensual (la cuota k vence a los k meses de la venta).
      if (financePlan) {
        const amounts = splitInstallmentAmounts(Number(total), financePlan.count);
        await tx.installment.createMany({
          data: amounts.map((amount, i) => ({
            saleId: sale.id,
            number: i + 1,
            amount: new Prisma.Decimal(amount),
            dueDate: addMonths(sale.createdAt, i + 1),
          })),
        });
      }

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
