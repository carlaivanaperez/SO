// Cálculo de ganancia y margen. Regla clave: costo y venta se cargan **con IVA
// incluido** (como el precio final), pero la ganancia real se calcula **neto
// contra neto**, porque el IVA no es del negocio (se cobra y se paga a AFIP).

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Quita el IVA contenido en un precio final. */
export function netFromGross(gross: number, taxRatePercent: number): number {
  return gross / (1 + taxRatePercent / 100);
}

export type MarginResult = {
  costNet: number; // costo sin IVA
  priceNet: number; // venta sin IVA
  profit: number; // ganancia neta ($ que queda)
  marginOnPrice: number; // % sobre la venta
  markupOnCost: number; // % sobre el costo (recargo)
};

/**
 * Ganancia y márgenes a partir del costo y la venta (ambos con IVA incluido).
 * El % de margen es el mismo se calcule sobre bruto o neto; la ganancia en $ se
 * informa neta (la real).
 */
export function computeMargin(
  costGross: number,
  priceGross: number,
  taxRatePercent: number
): MarginResult {
  const costNet = netFromGross(costGross, taxRatePercent);
  const priceNet = netFromGross(priceGross, taxRatePercent);
  const profit = priceNet - costNet;
  return {
    costNet: round2(costNet),
    priceNet: round2(priceNet),
    profit: round2(profit),
    marginOnPrice: priceNet > 0 ? round2((profit / priceNet) * 100) : 0,
    markupOnCost: costNet > 0 ? round2((profit / costNet) * 100) : 0,
  };
}

/**
 * Sugiere el precio de venta final (con IVA) para lograr un margen deseado
 * sobre la venta, a partir del costo (con IVA). El IVA se cancela porque ambos
 * lo incluyen: precio = costo / (1 − margen). Devuelve 0 si el margen es ≥ 100%.
 */
export function priceFromMargin(costGross: number, marginOnPricePercent: number): number {
  const m = marginOnPricePercent / 100;
  if (m >= 1 || costGross <= 0) return 0;
  return round2(costGross / (1 - m));
}
