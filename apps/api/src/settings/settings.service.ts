import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeArPhone, type StoreSettings, type UpdateStoreSettingsInput } from "@ferrestock/shared";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // Datos del negocio, creando la fila por defecto si falta (sin seed).
  async getStore(): Promise<StoreSettings> {
    const s = await this.prisma.storeSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    });
    return { storeName: s.storeName, whatsappPhone: s.whatsappPhone };
  }

  async updateStore(dto: UpdateStoreSettingsInput): Promise<StoreSettings> {
    let phone: string | null = null;
    if (dto.whatsappPhone && dto.whatsappPhone.trim()) {
      const normalized = normalizeArPhone(dto.whatsappPhone);
      if (!normalized) {
        throw new BadRequestException("Revisá el WhatsApp del negocio (ej: 3624721664)");
      }
      phone = normalized;
    }
    const s = await this.prisma.storeSettings.upsert({
      where: { id: 1 },
      create: { id: 1, storeName: dto.storeName, whatsappPhone: phone },
      update: { storeName: dto.storeName, whatsappPhone: phone },
    });
    return { storeName: s.storeName, whatsappPhone: s.whatsappPhone };
  }
}
