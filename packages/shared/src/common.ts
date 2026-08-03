import { z } from "zod";

/** Teléfono en formato E.164 (ej: +5491122334455), clave para WhatsApp. */
export const phoneE164 = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "Teléfono debe estar en formato E.164, ej: +5491122334455");

/**
 * Normaliza un celular argentino a E.164 para WhatsApp: +549 + 10 dígitos.
 * Acepta lo que la gente suele escribir: "3624721664", "03624721664",
 * "+5493624721664", con espacios/guiones. Devuelve null si no se puede
 * interpretar con confianza (para pedir que lo revise).
 */
export function normalizeArPhone(raw: string): string | null {
  let d = raw.replace(/\D/g, ""); // solo dígitos
  if (!d) return null;
  if (d.startsWith("54")) d = d.slice(2); // saca prefijo país si vino
  if (d.startsWith("0")) d = d.slice(1); // saca 0 de larga distancia
  if (d.length === 11 && d.startsWith("9")) d = d.slice(1); // saca el 9 de móvil (lo re-agregamos)
  if (d.length !== 10) return null; // el número nacional debe tener 10 dígitos
  return `+549${d}`;
}

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
