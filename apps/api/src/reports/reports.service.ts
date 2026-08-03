import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, SaleStatus } from "@ferrestock/db";

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

  async summary() {
    const since = startOfTodayAr();

    const [todayAgg, recentSales, products] = await Promise.all([
      // Ventas completadas de hoy: cantidad y total facturado.
      this.prisma.sale.aggregate({
        where: { status: SaleStatus.COMPLETED, createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { total: true },
      }),
      // Últimas 5 ventas.
      this.prisma.sale.findMany({
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
      }),
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
        revenue: (todayAgg._sum.total ?? new Prisma.Decimal(0)).toString(),
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
}
