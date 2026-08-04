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
  // Financiación en cuotas (solo cuenta corriente). Si se omite `installments`,
  // la venta a cuenta queda abierta (sin plan de cuotas), como siempre.
  installments: z.coerce.number().int().positive().optional(),
  applyFinancingSurcharge: z.coerce.boolean().default(false),
});
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

// Búsqueda de historial de ventas: fechas (YYYY-MM-DD, hora Argentina),
// medio de pago y texto de producto (nombre/SKU).
export const salesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paymentMethod: paymentMethodSchema.optional(),
  product: z.string().trim().min(1).optional(),
});
export type SalesQuery = z.infer<typeof salesQuerySchema>;
