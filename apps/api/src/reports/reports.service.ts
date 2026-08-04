import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, SaleStatus } from "@ferrestock/db";
import { computeMargin } from "@ferrestock/shared";

// Argentina no usa horario de verano: offset fijo -3h.
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

// Inicio del día de hoy en hora Argentina, expresado en UTC.
function startOfTodayAr(): Date {
  const now = new Date();
  const ar = new Date(now.getTime() - AR_OFFSET_MS);
  const midnightAr = Date.UTC(ar.getUTCFullYear(), ar.getUTCMonth(), ar.getUTCDate());
  return new Date(midnightAr + AR_OFFSET_MS);
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // `canSeeRevenue` = ADMIN/MANAGER. El vendedor (CASHIER) no ve facturación:
  // ni el dinero del día ni el listado de últimas ventas del negocio.
  async summary(canSeeRevenue: boolean) {
    const since = startOfTodayAr();

    const [todayAgg, recentSales, products, todayItems] = await Promise.all([
      // Ventas completadas de hoy: cantidad y total facturado.
      this.prisma.sale.aggregate({
        where: { status: SaleStatus.COMPLETED, createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { total: true },
      }),
      // Últimas 5 ventas (solo para quien puede ver facturación).
      canSeeRevenue
        ? this.prisma.sale.findMany({
            where: { status: SaleStatus.COMPLETED },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              number: true,
              total: true,
              createdAt: true,
              paymentMethod: true,
              _count: { select: { items: true } },
            },
          })
        : Promise.resolve([]),
      // Productos activos con su stock, para detectar los que están bajos.
      this.prisma.product.findMany({
        where: { active: true },
        select: { id: true, name: true, stockItems: { select: { quantity: true, minQuantity: true } } },
      }),
      // Ítems vendidos hoy con el costo del producto, para la ganancia estimada
      // (solo ADMIN/MANAGER). Se estima con el costo actual del producto.
      canSeeRevenue
        ? this.prisma.saleItem.findMany({
            where: { sale: { status: SaleStatus.COMPLETED, createdAt: { gte: since } } },
            select: {
              quantity: true,
              total: true,
              product: { select: { costPrice: true, taxRate: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const lowStockItems = products
      .map((p) => {
        const stock = p.stockItems.reduce((s, i) => s.plus(i.quantity), new Prisma.Decimal(0));
        const min = p.stockItems.reduce((s, i) => s.plus(i.minQuantity), new Prisma.Decimal(0));
        return { id: p.id, name: p.name, stock: stock.toString(), min: min.toString(), low: stock.lte(min) };
      })
      .filter((p) => p.low);

    // Ganancia estimada de hoy (neto vs neto). Solo cuenta ítems con costo
    // cargado (> 0); los que no tienen costo no suman ganancia (se marca aparte).
    let profit = new Prisma.Decimal(0);
    let itemsWithoutCost = 0;
    for (const it of todayItems) {
      const cost = it.product.costPrice;
      if (cost.lte(0)) {
        itemsWithoutCost++;
        continue;
      }
      const divisor = it.product.taxRate.div(100).plus(1); // ej: 1.21
      const lineNet = it.total.div(divisor); // venta neta de la línea
      const costNet = cost.div(divisor).times(it.quantity); // costo neto de la línea
      profit = profit.plus(lineNet.minus(costNet));
    }

    return {
      today: {
        count: todayAgg._count._all,
        revenue: canSeeRevenue ? (todayAgg._sum.total ?? new Prisma.Decimal(0)).toString() : null,
        profit: canSeeRevenue ? profit.toDecimalPlaces(2).toString() : null,
        profitPartial: canSeeRevenue ? itemsWithoutCost > 0 : false,
      },
      lowStock: {
        count: lowStockItems.length,
        items: lowStockItems.slice(0, 8).map(({ id, name, stock, min }) => ({ id, name, stock, min })),
      },
      recentSales: recentSales.map((s) => ({
        id: s.id,
        number: s.number,
        total: s.total.toString(),
        createdAt: s.createdAt.toISOString(),
        paymentMethod: s.paymentMethod,
        itemCount: s._count.items,
      })),
    };
  }

  // Informe mensual: ventas, facturación, IVA, ganancia estimada, por medio de
  // pago y productos más vendidos. `month` en formato "YYYY-MM" (hora Argentina).
  async monthly(month: string) {
    const parts = month.split("-");
    const year = Number(parts[0]);
    const monthNum = Number(parts[1]); // 1-12
    const from = new Date(Date.UTC(year, monthNum - 1, 1) + AR_OFFSET_MS);
    const to = new Date(Date.UTC(year, monthNum, 1) + AR_OFFSET_MS); // inicio del mes siguiente
    const range = { gte: from, lt: to };

    const [agg, byPayment, grouped, items, paymentsAgg] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { status: SaleStatus.COMPLETED, createdAt: range },
        _count: { _all: true },
        _sum: { total: true, tax: true },
      }),
      this.prisma.sale.groupBy({
        by: ["paymentMethod"],
        where: { status: SaleStatus.COMPLETED, createdAt: range },
        _count: { _all: true },
        _sum: { total: true },
      }),
      this.prisma.saleItem.groupBy({
        by: ["productId"],
        where: { sale: { status: SaleStatus.COMPLETED, createdAt: range } },
        _sum: { quantity: true, total: true },
      }),
      this.prisma.saleItem.findMany({
        where: { sale: { status: SaleStatus.COMPLETED, createdAt: range } },
        select: { quantity: true, total: true, product: { select: { costPrice: true, taxRate: true } } },
      }),
      // Cobranzas del mes (pagos recibidos a cuenta corriente).
      this.prisma.customerPayment.aggregate({
        where: { createdAt: range },
        _sum: { amount: true },
      }),
    ]);

    // Ganancia estimada del mes (neto vs neto, costo actual del producto).
    let profit = new Prisma.Decimal(0);
    let itemsWithoutCost = 0;
    for (const it of items) {
      if (it.product.costPrice.lte(0)) {
        itemsWithoutCost++;
        continue;
      }
      const divisor = it.product.taxRate.div(100).plus(1);
      profit = profit.plus(it.total.div(divisor).minus(it.product.costPrice.div(divisor).times(it.quantity)));
    }

    // Top 10 productos más vendidos (por facturación).
    const topIds = [...grouped]
      .sort((a, b) => Number(b._sum.total ?? 0) - Number(a._sum.total ?? 0))
      .slice(0, 10);
    const products = await this.prisma.product.findMany({
      where: { id: { in: topIds.map((g) => g.productId) } },
      select: { id: true, name: true, sku: true },
    });
    const nameById = new Map(products.map((p) => [p.id, p]));
    const topProducts = topIds.map((g) => ({
      productId: g.productId,
      name: nameById.get(g.productId)?.name ?? "—",
      sku: nameById.get(g.productId)?.sku ?? "",
      quantity: (g._sum.quantity ?? new Prisma.Decimal(0)).toString(),
      revenue: (g._sum.total ?? new Prisma.Decimal(0)).toString(),
    }));

    const count = agg._count._all;
    const revenue = agg._sum.total ?? new Prisma.Decimal(0);
    const tax = agg._sum.tax ?? new Prisma.Decimal(0);
    const avgTicket = count > 0 ? revenue.div(count) : new Prisma.Decimal(0);

    return {
      month,
      totals: {
        count,
        revenue: revenue.toString(),
        tax: tax.toString(),
        profit: profit.toDecimalPlaces(2).toString(),
        profitPartial: itemsWithoutCost > 0,
        avgTicket: avgTicket.toDecimalPlaces(2).toString(),
        payments: (paymentsAgg._sum.amount ?? new Prisma.Decimal(0)).toString(),
      },
      byPayment: byPayment.map((p) => ({
        method: p.paymentMethod,
        count: p._count._all,
        total: (p._sum.total ?? new Prisma.Decimal(0)).toString(),
      })),
      topProducts,
    };
  }

  // Márgenes por producto: ganancia (neta) y % sobre cada producto activo.
  // Ordenado por menor margen primero, para detectar los que rinden poco.
  async margins() {
    const products = await this.prisma.product.findMany({
      where: { active: true },
      select: { id: true, name: true, sku: true, costPrice: true, salePrice: true, taxRate: true },
      orderBy: { name: "asc" },
    });

    return products
      .map((p) => {
        const cost = Number(p.costPrice);
        const price = Number(p.salePrice);
        const rate = Number(p.taxRate);
        const m = computeMargin(cost, price, rate);
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          cost, // con IVA (como se carga)
          price, // con IVA
          profit: m.profit, // ganancia neta
          marginOnPrice: m.marginOnPrice,
          markupOnCost: m.markupOnCost,
          hasCost: cost > 0,
        };
      })
      .sort((a, b) => {
        // Los que no tienen costo cargado van al final; el resto por menor margen.
        if (a.hasCost !== b.hasCost) return a.hasCost ? -1 : 1;
        return a.marginOnPrice - b.marginOnPrice;
      });
  }

  // Planilla de compra: todos los productos activos bajo el mínimo, con la
  // cantidad sugerida a comprar (para llegar al mínimo).
  async lowStock() {
    const zero = new Prisma.Decimal(0);
    const products = await this.prisma.product.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        sku: true,
        stockItems: { select: { quantity: true, minQuantity: true } },
      },
      orderBy: { name: "asc" },
    });

    return products
      .map((p) => {
        const stock = p.stockItems.reduce((s, i) => s.plus(i.quantity), zero);
        const min = p.stockItems.reduce((s, i) => s.plus(i.minQuantity), zero);
        const toBuy = min.minus(stock);
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock: stock.toString(),
          min: min.toString(),
          toBuy: toBuy.greaterThan(0) ? toBuy.toString() : "0",
          low: stock.lte(min),
        };
      })
      .filter((p) => p.low);
  }
}
