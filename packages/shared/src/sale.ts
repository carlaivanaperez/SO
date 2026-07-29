import { z } from "zod";

export const paymentMethodSchema = z.enum(["CASH", "CARD", "TRANSFER", "ACCOUNT"]);

export const saleItemInputSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.coerce.number().positive(),
  // Si se omite, la API usa el salePrice vigente del producto.
  unitPrice: z.coerce.number().nonnegative().optional(),
  discount: z.coerce.number().nonnegative().default(0),
});

export const createSaleSchema = z.object({
  customerId: z.string().cuid().optional(),
  paymentMethod: paymentMethodSchema,
  discount: z.coerce.number().nonnegative().default(0),
  items: z.array(saleItemInputSchema).min(1, "La venta debe tener al menos un ítem"),
});
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
