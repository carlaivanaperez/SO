import { computeMargin, priceFromMargin, netFromGross } from "@ferrestock/shared";

describe("margin helpers", () => {
  it("computeMargin calcula la ganancia neta y el margen (costo y venta con IVA)", () => {
    // costo 6000, venta 8500, IVA 21% → neto 4958.68 y 7024.79 → ganancia 2066.12
    const m = computeMargin(6000, 8500, 21);
    expect(m.costNet).toBeCloseTo(4958.68, 2);
    expect(m.priceNet).toBeCloseTo(7024.79, 2);
    expect(m.profit).toBeCloseTo(2066.12, 2);
    expect(m.marginOnPrice).toBeCloseTo(29.41, 1);
  });

  it("el margen % es igual con o sin IVA (el IVA es proporcional)", () => {
    const conIva = computeMargin(6000, 8500, 21).marginOnPrice;
    const sinIva = computeMargin(6000, 8500, 0).marginOnPrice;
    expect(conIva).toBeCloseTo(sinIva, 2);
  });

  it("priceFromMargin sugiere el precio final para el margen deseado", () => {
    // costo 6000, margen 40% sobre venta → precio = 6000 / (1 - 0.4) = 10000
    expect(priceFromMargin(6000, 40)).toBe(10000);
    // el margen resultante debe dar ~40%
    expect(computeMargin(6000, 10000, 21).marginOnPrice).toBeCloseTo(40, 1);
  });

  it("priceFromMargin devuelve 0 ante datos sin sentido", () => {
    expect(priceFromMargin(6000, 100)).toBe(0); // margen 100% imposible
    expect(priceFromMargin(0, 40)).toBe(0); // sin costo
  });

  it("netFromGross quita el IVA contenido", () => {
    expect(netFromGross(121, 21)).toBeCloseTo(100, 2);
  });
});
