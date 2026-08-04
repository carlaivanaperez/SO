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
    return {
      storeName: s.storeName,
      whatsappPhone: s.whatsappPhone,
      address: s.address,
      hours: s.hours,
      supportPhone: s.supportPhone,
    };
  }

  async updateStore(dto: UpdateStoreSettingsInput): Promise<StoreSettings> {
    const phone = this.normalizePhone(dto.whatsappPhone, "Revisá el WhatsApp del negocio (ej: 3624721664)");
    const support = this.normalizePhone(dto.supportPhone, "Revisá el WhatsApp de soporte (ej: 3624721664)");
    const address = dto.address?.trim() || null;
    const hours = dto.hours?.trim() || null;
    const data = {
      storeName: dto.storeName,
      whatsappPhone: phone,
      address,
      hours,
      supportPhone: support,
    };
    const s = await this.prisma.storeSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    });
    return {
      storeName: s.storeName,
      whatsappPhone: s.whatsappPhone,
      address: s.address,
      hours: s.hours,
      supportPhone: s.supportPhone,
    };
  }

  // Normaliza un teléfono a E.164 (o null si viene vacío); error si es inválido.
  private normalizePhone(raw: string | null | undefined, errMsg: string): string | null {
    if (!raw || !raw.trim()) return null;
    const normalized = normalizeArPhone(raw);
    if (!normalized) throw new BadRequestException(errMsg);
    return normalized;
  }
}
