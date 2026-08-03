import { z } from "zod";
import { paymentMethodSchema } from "./sale";

export const promotionTypeSchema = z.enum(["PERCENT", "TWO_FOR_ONE"]);
export type PromotionTypeDTO = z.infer<typeof promotionTypeSchema>;

export const createPromotionSchema = z
  .object({
    productId: z.string().cuid(),
    type: promotionTypeSchema,
    percent: z.coerce.number().min(1).max(100).optional(),
    // Medios de pago donde aplica. Vacío = todos.
    paymentMethods: z.array(paymentMethodSchema).optional().default([]),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inicio inválida"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha fin inválida"),
  })
  .refine((d) => d.type !== "PERCENT" || (d.percent ?? 0) > 0, {
    message: "Indicá el % de descuento",
    path: ["percent"],
  });
export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;

// ¿La promo aplica al medio de pago elegido? (vacío = todos).
export function promoAppliesToPayment(
  methods: string[] | null | undefined,
  payment: string
): boolean {
  if (!methods || methods.length === 0) return true;
  return methods.includes(payment);
}

// Descuento total de una línea según la promo. Compartido por POS (preview) y
// backend, así el cálculo es el mismo en los dos lados.
export function promoLineDiscount(
  type: PromotionTypeDTO,
  percent: number | null | undefined,
  unitPrice: number,
  quantity: number
): number {
  if (type === "PERCENT") return (unitPrice * quantity * (percent ?? 0)) / 100;
  // 2x1: por cada par, una unidad gratis.
  if (type === "TWO_FOR_ONE") return Math.floor(quantity / 2) * unitPrice;
  return 0;
}
