import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@ferrestock/db";
import { SettingsService } from "../settings/settings.service";
import type { PublicCatalog, PublicCatalogItem } from "@ferrestock/shared";

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService
  ) {}

  // Catálogo para clientes (sin login). Devuelve SOLO datos seguros: nombre,
  // marca, precio final (con IVA) y si hay stock (no la cantidad exacta).
  // Nunca costo, margen ni stock exacto.
  async catalog(search?: string): Promise<PublicCatalog> {
    const q = search?.trim();
    const where: Prisma.ProductWhereInput = {
      active: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { brand: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
              { barcode: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const now = new Date();
    const [store, products, promos] = await Promise.all([
      this.settings.getStore(),
      this.prisma.product.findMany({
        where,
        orderBy: { name: "asc" },
        take: 500,
        select: {
          id: true,
          name: true,
          brand: true,
          salePrice: true,
          stockItems: { select: { quantity: true } },
          category: { select: { id: true, name: true } },
        },
      }),
      this.prisma.promotion.findMany({
        where: { active: true, startDate: { lte: now }, endDate: { gte: now } },
        select: { productId: true, type: true, percent: true },
      }),
    ]);

    // Un producto puede tener varias promos: las juntamos por producto.
    const promosByProduct = new Map<string, string[]>();
    for (const pr of promos) {
      const label = pr.type === "PERCENT" ? `${Number(pr.percent ?? 0)}% off` : "2x1";
      const arr = promosByProduct.get(pr.productId) ?? [];
      if (!arr.includes(label)) arr.push(label);
      promosByProduct.set(pr.productId, arr);
    }

    const items: PublicCatalogItem[] = products.map((p) => {
      const stock = p.stockItems.reduce((s, i) => s.plus(i.quantity), new Prisma.Decimal(0));
      return {
        id: p.id,
        name: p.name,
        brand: p.brand,
        price: p.salePrice.toString(),
        available: stock.greaterThan(0),
        promoLabels: promosByProduct.get(p.id) ?? [],
        category: p.category ? { id: p.category.id, name: p.category.name } : null,
      };
    });

    // Solo los datos públicos del negocio (nunca el WhatsApp de soporte del admin).
    return {
      store: {
        storeName: store.storeName,
        whatsappPhone: store.whatsappPhone,
        address: store.address,
        hours: store.hours,
      },
      items,
    };
  }
}
