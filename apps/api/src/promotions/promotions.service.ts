import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreatePromotionInput } from "@ferrestock/shared";
import { PromotionType } from "@ferrestock/db";

// Argentina: offset fijo -3h. Inicio/fin del día en hora AR (en UTC).
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
function arDayStart(dateStr: string): Date {
  const parts = dateStr.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return new Date(Date.UTC(y, m - 1, d) + AR_OFFSET_MS);
}

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreatePromotionInput) {
    return this.prisma.promotion.create({
      data: {
        productId: dto.productId,
        type: dto.type as PromotionType,
        percent: dto.type === "PERCENT" ? dto.percent : null,
        startDate: arDayStart(dto.startDate),
        // La fecha fin incluye todo ese día (hasta las 23:59:59.999 AR).
        endDate: new Date(arDayStart(dto.endDate).getTime() + DAY_MS - 1),
      },
    });
  }

  listByProduct(productId: string) {
    return this.prisma.promotion.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
    });
  }

  // Promociones vigentes ahora (para que el POS y el catálogo las apliquen).
  active() {
    const now = new Date();
    return this.prisma.promotion.findMany({
      where: { active: true, startDate: { lte: now }, endDate: { gte: now } },
      select: { id: true, productId: true, type: true, percent: true, endDate: true },
    });
  }

  remove(id: string) {
    return this.prisma.promotion.delete({ where: { id } });
  }
}
