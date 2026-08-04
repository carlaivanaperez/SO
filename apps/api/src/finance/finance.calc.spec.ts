import {
  splitInstallmentAmounts,
  imputePayments,
  lateFee,
  daysOverdue,
  surchargeForInstallments,
} from "@ferrestock/shared";

describe("finance helpers", () => {
  it("splitInstallmentAmounts divide el total y la última cuota absorbe el redondeo", () => {
    const parts = splitInstallmentAmounts(100, 3);
    expect(parts).toHaveLength(3);
    expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 2);
    expect(parts[0]).toBe(33.33);
    expect(parts[2]).toBe(33.34); // absorbe el centavo restante
  });

  it("imputePayments cubre las cuotas más viejas primero", () => {
    const paid = imputePayments(80, [50, 50, 50]);
    expect(paid).toEqual([50, 30, 0]); // 80 alcanza para la 1ª y parte de la 2ª
  });

  it("imputePayments no reparte de más si el pool supera el total", () => {
    expect(imputePayments(1000, [50, 50])).toEqual([50, 50]);
  });

  it("lateFee = saldo × tasa diaria × días de atraso", () => {
    // 2000 impago, 10 días, 0,3%/día => 2000 * 0.003 * 10 = 60
    expect(lateFee(2000, 10, 0.3)).toBe(60);
    expect(lateFee(2000, 0, 0.3)).toBe(0); // sin atraso, sin mora
    expect(lateFee(0, 10, 0.3)).toBe(0); // sin saldo, sin mora
  });

  it("daysOverdue es 0 antes del vencimiento", () => {
    const now = Date.parse("2026-02-10T12:00:00Z");
    expect(daysOverdue("2026-02-20T12:00:00Z", now)).toBe(0); // aún no vence
    expect(daysOverdue("2026-02-05T12:00:00Z", now)).toBe(5); // 5 días vencida
  });

  it("surchargeForInstallments devuelve null si la opción no existe", () => {
    const options = [
      { installments: 1, surchargePercent: 0 },
      { installments: 3, surchargePercent: 10 },
    ];
    expect(surchargeForInstallments(options, 3)).toBe(10);
    expect(surchargeForInstallments(options, 6)).toBeNull();
  });
});
