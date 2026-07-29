import { z } from "zod";

/** Teléfono en formato E.164 (ej: +5491122334455), clave para WhatsApp. */
export const phoneE164 = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "Teléfono debe estar en formato E.164, ej: +5491122334455");

/** Paginación estándar para todos los listados. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
});
export type Pagination = z.infer<typeof paginationSchema>;

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
