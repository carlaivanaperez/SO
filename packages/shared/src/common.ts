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

/**
 * Arma el link de WhatsApp (wa.me) a partir de un teléfono E.164. Si el número
 * no vino en E.164 intenta normalizarlo como celular argentino. Devuelve null
 * si no hay un número usable (para no mostrar el link). Si se pasa `text`, deja
 * ese mensaje precargado en el chat (ej: un saludo inicial).
 */
export function whatsappUrl(phone: string | null | undefined, text?: string): string | null {
  if (!phone) return null;
  const e164 = /^\+[1-9]\d{7,14}$/.test(phone) ? phone : normalizeArPhone(phone);
  if (!e164) return null;
  const base = `https://wa.me/${e164.replace(/\D/g, "")}`; // wa.me quiere solo dígitos
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/**
 * Saludo inicial precargado para escribirle a un cliente por WhatsApp. Usa solo
 * el primer nombre para que suene cercano.
 */
export function whatsappGreeting(name: string): string {
  const firstName = name.trim().split(/\s+/)[0] || name.trim();
  return `Hola ${firstName}, me comunico de la ferretería. `;
}

/**
 * Mensaje precargado para recordarle a un cliente su saldo pendiente de cuenta
 * corriente. `balance` es el saldo que debe (positivo).
 */
export function whatsappDebtMessage(name: string, balance: number): string {
  const firstName = name.trim().split(/\s+/)[0] || name.trim();
  const amount = balance.toLocaleString("es-AR");
  return `Hola ${firstName}, te escribo de la ferretería. Te recordamos que tenés un saldo pendiente de $${amount} en tu cuenta. Cualquier cosa avisanos. ¡Gracias!`;
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
