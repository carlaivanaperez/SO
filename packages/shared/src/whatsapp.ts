import { z } from "zod";

/**
 * Forma (parcial) del payload de webhook entrante de WhatsApp Cloud API.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 * Solo modelamos lo que consumimos: mensajes de texto entrantes.
 */
export const whatsappTextMessageSchema = z.object({
  from: z.string(), // teléfono del cliente (sin '+', formato wa)
  id: z.string(),
  timestamp: z.string(),
  type: z.literal("text"),
  text: z.object({ body: z.string() }),
});

export const whatsappWebhookSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          field: z.literal("messages"),
          value: z.object({
            messaging_product: z.literal("whatsapp"),
            metadata: z.object({ phone_number_id: z.string() }),
            messages: z.array(z.unknown()).optional(),
            statuses: z.array(z.unknown()).optional(),
          }),
        })
      ),
    })
  ),
});
export type WhatsAppWebhook = z.infer<typeof whatsappWebhookSchema>;
