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

    const [todayAgg, recentSales, products] = await Promise.all([
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
    ]);

    const lowStockItems = products
      .map((p) => {
        const stock = p.stockItems.reduce((s, i) => s.plus(i.quantity), new Prisma.Decimal(0));
        const min = p.stockItems.reduce((s, i) => s.plus(i.minQuantity), new Prisma.Decimal(0));
        return { id: p.id, name: p.name, stock: stock.toString(), min: min.toString(), low: stock.lte(min) };
      })
      .filter((p) => p.low);

    return {
      today: {
        count: todayAgg._count._all,
        revenue: canSeeRevenue ? (todayAgg._sum.total ?? new Prisma.Decimal(0)).toString() : null,
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
