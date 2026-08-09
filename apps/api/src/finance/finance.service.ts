import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@ferrestock/db";
import type { FinanceConfig, UpdateFinanceConfigInput } from "@ferrestock/shared";

// Valores por defecto si todavía no se configuró nada (así funciona en
// producción sin correr el seed): escala de recargo + mora 0,3%/día.
const DEFAULT_LATE_FEE = 0.3;
const DEFAULT_CREDIT_LIMIT = 50000;
const DEFAULT_OPTIONS = [
  { installments: 1, surchargePercent: 0 },
  { installments: 3, surchargePercent: 10 },
  { installments: 6, surchargePercent: 25 },
  { installments: 12, surchargePercent: 60 },
];

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  // Devuelve la config vigente, creando los valores por defecto si faltan.
  async getConfig(): Promise<FinanceConfig> {
    const config = await this.prisma.financeConfig.upsert({
      where: { id: 1 },
      create: { id: 1, lateFeeDailyPercent: DEFAULT_LATE_FEE, creditLimit: DEFAULT_CREDIT_LIMIT },
      update: {},
    });

    let options = await this.prisma.installmentOption.findMany({
      orderBy: { installments: "asc" },
    });
    if (options.length === 0) {
      await this.prisma.installmentOption.createMany({ data: DEFAULT_OPTIONS });
      options = await this.prisma.installmentOption.findMany({ orderBy: { installments: "asc" } });
    }

    return {
      lateFeeDailyPercent: Number(config.lateFeeDailyPercent),
      creditLimit: Number(config.creditLimit),
      options: options.map((o) => ({
        installments: o.installments,
        surchargePercent: Number(o.surchargePercent),
      })),
    };
  }

  // Reemplaza la escala completa + la tasa de mora (solo ADMIN).
  async updateConfig(dto: UpdateFinanceConfigInput): Promise<FinanceConfig> {
    await this.prisma.$transaction([
      this.prisma.financeConfig.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          lateFeeDailyPercent: new Prisma.Decimal(dto.lateFeeDailyPercent),
          creditLimit: new Prisma.Decimal(dto.creditLimit),
        },
        update: {
          lateFeeDailyPercent: new Prisma.Decimal(dto.lateFeeDailyPercent),
          creditLimit: new Prisma.Decimal(dto.creditLimit),
        },
      }),
      this.prisma.installmentOption.deleteMany({}),
      this.prisma.installmentOption.createMany({
        data: dto.options.map((o) => ({
          installments: o.installments,
          surchargePercent: new Prisma.Decimal(o.surchargePercent),
        })),
      }),
    ]);
    return this.getConfig();
  }
}
