import { z } from "zod";
import { paymentMethodSchema } from "./sale";

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1).max(160),
  // Teléfono E.164 (clave para vincular WhatsApp). Opcional.
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "Teléfono en formato E.164, ej: +5491122334455")
    .optional(),
  email: z.string().trim().email().optional(),
  taxId: z.string().trim().max(20).optional(),
  address: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.partial();
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

// Pago de un cliente a su cuenta corriente.
export const customerPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  method: paymentMethodSchema.optional(),
  note: z.string().trim().max(500).optional(),
});
export type CustomerPaymentInput = z.infer<typeof customerPaymentSchema>;
