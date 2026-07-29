import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { WhatsappService } from "./whatsapp.service";
import { whatsappWebhookSchema, whatsappTextMessageSchema } from "@ferrestock/shared";

// Extendemos Request para exponer el rawBody capturado en main.ts.
type RawRequest = Request & { rawBody?: Buffer };

@Controller("whatsapp")
export class WhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  /** GET: handshake de verificación del webhook (lo llama Meta una vez). */
  @Get("webhook")
  verify(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") token: string,
    @Query("hub.challenge") challenge: string
  ): string {
    const result = this.whatsapp.verifyWebhook(mode, token, challenge);
    if (result === null) throw new ForbiddenException("Verificación fallida");
    return result;
  }

  /** POST: mensajes entrantes. Responder 200 rápido; procesar async. */
  @Post("webhook")
  @HttpCode(200)
  async receive(
    @Req() req: RawRequest,
    @Headers("x-hub-signature-256") signature: string
  ): Promise<string> {
    if (!this.whatsapp.verifySignature(req.rawBody, signature)) {
      throw new ForbiddenException("Firma inválida");
    }

    const parsed = whatsappWebhookSchema.safeParse(req.body);
    if (!parsed.success) return "EVENT_RECEIVED";

    for (const entry of parsed.data.entry) {
      for (const change of entry.changes) {
        for (const raw of change.value.messages ?? []) {
          const msg = whatsappTextMessageSchema.safeParse(raw);
          if (msg.success) {
            // No await bloqueante: procesamos y respondemos 200 igual.
            void this.whatsapp.handleIncomingText(msg.data.from, msg.data.text.body);
          }
        }
      }
    }
    return "EVENT_RECEIVED";
  }
}
