import { z } from "zod";

// ─── Configuración de financiación (cuenta corriente) ────────────────
// Escala de recargo por cantidad de cuotas + tasa de mora (% por día).
// Editable por ADMIN; se guarda como fila única + tabla de opciones.

export const installmentOptionSchema = z.object({
  installments: z.coerce.number().int().positive(),
  surchargePercent: z.coerce.number().min(0).max(1000),
});
export type InstallmentOption = z.infer<typeof installmentOptionSchema>;

export const financeConfigSchema = z.object({
  lateFeeDailyPercent: z.coerce.number().min(0).max(100),
  options: z
    .array(installmentOptionSchema)
    .min(1, "Tiene que haber al menos una opción de cuotas"),
});
export type FinanceConfig = z.infer<typeof financeConfigSchema>;

// Al guardar la config se reemplaza la escala completa.
export const updateFinanceConfigSchema = financeConfigSchema;
export type UpdateFinanceConfigInput = z.infer<typeof updateFinanceConfigSchema>;

const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Recargo (%) para N cuotas según la escala. Devuelve null si esa cantidad de
 * cuotas no está habilitada en la escala.
 */
export function surchargeForInstallments(
  options: InstallmentOption[],
  installments: number
): number | null {
  const opt = options.find((o) => o.installments === installments);
  return opt ? opt.surchargePercent : null;
}

/**
 * Divide un total en `n` cuotas de 2 decimales. Trabaja en centavos para no
 * arrastrar errores de punto flotante; la última cuota absorbe el resto para
 * que la suma dé exactamente el total.
 */
export function splitInstallmentAmounts(total: number, n: number): number[] {
  if (n <= 0) return [];
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / n);
  const amounts: number[] = [];
  for (let i = 0; i < n; i++) {
    // la última cuota absorbe el redondeo para que la suma dé el total exacto
    const cents = i === n - 1 ? totalCents - base * (n - 1) : base;
    amounts.push(cents / 100);
  }
  return amounts;
}

/**
 * Imputa un pool de pagos a una lista de obligaciones ordenadas por
 * vencimiento (la más vieja primero). Devuelve cuánto quedó pagado de cada una.
 */
export function imputePayments(pool: number, amounts: number[]): number[] {
  let poolCents = Math.round(pool * 100);
  return amounts.map((a) => {
    const cents = Math.round(a * 100);
    const paid = Math.max(0, Math.min(poolCents, cents));
    poolCents -= paid;
    return paid / 100;
  });
}

/** Días de atraso de una cuota (0 si todavía no venció). */
export function daysOverdue(dueDateIso: string, nowMs: number): number {
  const diff = nowMs - new Date(dueDateIso).getTime();
  return diff <= 0 ? 0 : Math.floor(diff / DAY_MS);
}

/**
 * Interés por mora de una cuota vencida impaga:
 * saldo impago × (tasa diaria / 100) × días de atraso.
 */
export function lateFee(unpaid: number, daysLate: number, dailyPercent: number): number {
  if (unpaid <= 0 || daysLate <= 0 || dailyPercent <= 0) return 0;
  return round2((unpaid * dailyPercent * daysLate) / 100);
}
