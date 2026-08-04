import { z } from "zod";

export const productUnitSchema = z.enum(["UNIT", "KG", "METER", "LITER", "BOX"]);
export type ProductUnitDTO = z.infer<typeof productUnitSchema>;

export const createProductSchema = z.object({
  sku: z.string().trim().min(1).max(50),
  barcode: z.string().trim().max(50).optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  brand: z.string().trim().max(100).optional(),
  unit: productUnitSchema.default("UNIT"),
  categoryId: z.string().cuid().optional(),
  costPrice: z.coerce.number().nonnegative().default(0),
  salePrice: z.coerce.number().nonnegative(),
  taxRate: z.coerce.number().min(0).max(100).default(21),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial().extend({
  active: z.boolean().optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

/** Fila de importación masiva de productos (desde un CSV/Excel). */
export const importProductRowSchema = z.object({
  sku: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(100).optional().nullable(),
  barcode: z.string().trim().max(50).optional().nullable(),
  unit: productUnitSchema.default("UNIT"),
  costPrice: z.coerce.number().nonnegative().default(0),
  salePrice: z.coerce.number().nonnegative(),
  taxRate: z.coerce.number().min(0).max(100).default(21),
  category: z.string().trim().max(100).optional().nullable(),
  // Cantidad de stock a fijar (absoluta). Si se omite, no toca el stock.
  stock: z.coerce.number().optional(),
});
export type ImportProductRow = z.infer<typeof importProductRowSchema>;

export const importProductsSchema = z.object({
  items: z.array(importProductRowSchema).min(1, "El archivo no tiene filas").max(5000),
});
export type ImportProductsInput = z.infer<typeof importProductsSchema>;

export type ImportResult = {
  created: number;
  updated: number;
  errors: { row: number; sku?: string; message: string }[];
};

/** Ajuste de stock (ingreso/egreso/corrección) para un producto. */
export const stockAdjustmentSchema = z.object({
  // No exigimos cuid: los depósitos pueden tener ids propios (ej. "wh_default").
  warehouseId: z.string().min(1),
  quantity: z.coerce.number(), // positivo = ingreso, negativo = egreso
  type: z.enum(["PURCHASE", "ADJUSTMENT", "RETURN", "TRANSFER"]),
  reason: z.string().trim().max(500).optional(),
});
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
