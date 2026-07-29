import { Injectable, Logger } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { WhatsappClient } from "./whatsapp.client";
import { WhatsAppQueryStatus, Prisma } from "@ferrestock/db";

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: WhatsappClient
  ) {}

  /** Verificación del webhook (handshake GET) de Meta. */
  verifyWebhook(mode?: string, token?: string, challenge?: string): string | null {
    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return challenge ?? "";
    }
    return null;
  }

  /**
   * Valida la firma X-Hub-Signature-256 del webhook usando el App Secret.
   * Rechazar payloads no firmados evita webhooks falsificados.
   */
  verifySignature(rawBody: Buffer | undefined, signatureHeader?: string): boolean {
    const secret = process.env.WHATSAPP_APP_SECRET;
    if (!secret) return true; // en dev sin secret, no validamos
    if (!rawBody || !signatureHeader) return false;

    const expected =
      "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /**
   * Procesa un mensaje de texto entrante: registra la consulta, busca el
   * producto y responde con disponibilidad y precio.
   */
  async handleIncomingText(fromPhone: string, text: string): Promise<void> {
    const query = await this.prisma.whatsAppQuery.create({
      data: { fromPhone, messageText: text, status: WhatsAppQueryStatus.RECEIVED },
    });

    const product = await this.matchProduct(text);
    const responseText = product
      ? this.formatAvailability(product)
      : "No encontré ese producto 🙈. Probá con el nombre exacto o el código, o escribinos para ayudarte.";

    await this.client.sendText(fromPhone, responseText);

    await this.prisma.whatsAppQuery.update({
      where: { id: query.id },
      data: {
        matchedProductId: product?.id,
        status: product ? WhatsAppQueryStatus.RESPONDED : WhatsAppQueryStatus.NOT_FOUND,
        responseText,
        respondedAt: new Date(),
      },
    });
  }

  /** Matching simple por nombre/SKU/código de barras. Mejorable con full-text. */
  private async matchProduct(text: string) {
    const term = text.trim();
    return this.prisma.product.findFirst({
      where: {
        active: true,
        OR: [
          { sku: { equals: term, mode: "insensitive" } },
          { barcode: { equals: term } },
          { name: { contains: term, mode: "insensitive" } },
        ],
      },
      include: { stockItems: true },
    });
  }

  private formatAvailability(
    product: Prisma.ProductGetPayload<{ include: { stockItems: true } }>
  ): string {
    const totalStock = product.stockItems.reduce(
      (sum, s) => sum + Number(s.quantity),
      0
    );
    const price = Number(product.salePrice).toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
    });

    if (totalStock > 0) {
      return `✅ *${product.name}*\nDisponible: ${totalStock} en stock\nPrecio: ${price}\n\n¡Te esperamos en la ferretería! 🛠️`;
    }
    return `⚠️ *${product.name}*\nSin stock por el momento. Precio: ${price}.\nEscribinos y te avisamos cuando llegue.`;
  }
}
