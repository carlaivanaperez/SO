import { Injectable, Logger } from "@nestjs/common";

/**
 * Cliente mínimo de la WhatsApp Cloud API (Graph API) para enviar mensajes
 * de texto salientes. Docs:
 * https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */
@Injectable()
export class WhatsappClient {
  private readonly logger = new Logger(WhatsappClient.name);
  private readonly graphUrl = "https://graph.facebook.com/v21.0";

  async sendText(to: string, body: string): Promise<void> {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !token) {
      // En desarrollo sin credenciales, solo logueamos.
      this.logger.warn(`[DEV] Respuesta a ${to}: ${body}`);
      return;
    }

    const res = await fetch(`${this.graphUrl}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    });

    if (!res.ok) {
      this.logger.error(`Error enviando WhatsApp a ${to}: ${res.status} ${await res.text()}`);
    }
  }
}
