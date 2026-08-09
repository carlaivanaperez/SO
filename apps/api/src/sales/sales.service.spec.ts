import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma, SaleStatus, StockMovementType } from "@ferrestock/db";
import { SalesService } from "./sales.service";
import type { CreateSaleInput } from "@ferrestock/shared";

// Producto de prueba: precios/impuestos como Decimal (igual que Prisma).
function product(id: string, salePrice: string, taxRate = "21") {
  return { id, salePrice: new Prisma.Decimal(salePrice), taxRate: new Prisma.Decimal(taxRate) };
}

// Arma el servicio con un Prisma mockeado. `$transaction` ejecuta el callback
// con un `tx` espiable para verificar los writes de venta y stock.
function setup(opts: {
  products: ReturnType<typeof product>[];
  warehouse?: { id: string } | null;
  stock?: { productId: string; quantity: Prisma.Decimal }[];
  debt?: number; // deuda actual del cliente (para probar el límite)
  creditLimit?: number;
}) {
  const tx = {
    sale: {
      create: jest.fn().mockResolvedValue({ id: "sale_1", items: [], createdAt: new Date("2026-01-15T12:00:00Z") }),
    },
    stockMovement: { create: jest.fn().mockResolvedValue({}) },
    stockItem: { upsert: jest.fn().mockResolvedValue({}) },
    installment: { createMany: jest.fn().mockResolvedValue({}) },
  };
  // Por defecto: stock abundante (1000) para cada producto, así las ventas pasan.
  const stock =
    opts.stock ?? opts.products.map((p) => ({ productId: p.id, quantity: new Prisma.Decimal(1000) }));
  const prisma = {
    product: { findMany: jest.fn().mockResolvedValue(opts.products) },
    warehouse: {
      findFirst: jest.fn().mockResolvedValue(
        opts.warehouse === undefined ? { id: "wh_default" } : opts.warehouse
      ),
    },
    stockItem: { findMany: jest.fn().mockResolvedValue(stock) },
    // Deuda del cliente = cargos − pagos − créditos (para el límite de cuenta cte).
    sale: { aggregate: jest.fn().mockResolvedValue({ _sum: { total: opts.debt ?? 0 } }) },
    customerPayment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    creditNote: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  // Finance mock: escala de cuotas, mora y tope de cuenta corriente.
  const finance = {
    getConfig: jest.fn().mockResolvedValue({
      lateFeeDailyPercent: 0.3,
      creditLimit: opts.creditLimit ?? 50000,
      options: [
        { installments: 1, surchargePercent: 0 },
        { installments: 3, surchargePercent: 10 },
      ],
    }),
  };
  const service = new SalesService(prisma as never, finance as never);
  return { service, prisma, tx };
}

const baseInput = (items: CreateSaleInput["items"], discount = 0): CreateSaleInput => ({
  paymentMethod: "CASH",
  discount,
  items,
  applyFinancingSurcharge: false,
});

describe("SalesService.create", () => {
  it("calcula el total como precio final (IVA incluido) y desglosa el IVA contenido", async () => {
    const { service, tx } = setup({ products: [product("p1", "100")] });

    await service.create(baseInput([{ productId: "p1", quantity: 2, discount: 0 }]), "u1");

    const data = tx.sale.create.mock.calls[0][0].data;
    // El precio ya incluye IVA: total = 100 * 2 = 200 (lo que paga el cliente).
    // IVA contenido (21%): 200 - 200/1.21 = 34.71; neto = 165.29.
    expect(data.total.toString()).toBe("200");
    expect(data.subtotal.toString()).toBe("165.29");
    expect(data.tax.toString()).toBe("34.71");
    expect(data.status).toBe(SaleStatus.COMPLETED);
    // El ítem guarda el precio unitario congelado y el total final de la línea.
    expect(data.items.create[0].unitPrice.toString()).toBe("100");
    expect(data.items.create[0].total.toString()).toBe("200");
  });

  it("usa el unitPrice provisto en lugar del precio del producto", async () => {
    const { service, tx } = setup({ products: [product("p1", "100")] });

    await service.create(baseInput([{ productId: "p1", quantity: 1, unitPrice: 50, discount: 0 }]), "u1");

    const data = tx.sale.create.mock.calls[0][0].data;
    // Total final 50 (IVA incluido); IVA contenido 50 - 50/1.21 = 8.68; neto 41.32.
    expect(data.total.toString()).toBe("50");
    expect(data.subtotal.toString()).toBe("41.32");
    expect(data.tax.toString()).toBe("8.68");
  });

  it("aplica descuento por ítem y descuento global (sobre precios con IVA incluido)", async () => {
    const { service, tx } = setup({ products: [product("p1", "100")] });

    // qty 1, precio 100, descuento de ítem 10 => línea final 90; descuento global 5 => total 85.
    await service.create(baseInput([{ productId: "p1", quantity: 1, discount: 10 }], 5), "u1");

    const data = tx.sale.create.mock.calls[0][0].data;
    // neto = 90/1.21 = 74.38; IVA = 15.62; total = 74.38 + 15.62 - 5 = 85.
    expect(data.subtotal.toString()).toBe("74.38");
    expect(data.tax.toString()).toBe("15.62");
    expect(data.total.toString()).toBe("85");
  });

  it("descuenta stock: crea un StockMovement negativo y decrementa el StockItem por ítem", async () => {
    const { service, tx } = setup({ products: [product("p1", "100")] });

    await service.create(baseInput([{ productId: "p1", quantity: 3, discount: 0 }]), "u1");

    expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
    const mov = tx.stockMovement.create.mock.calls[0][0].data;
    expect(mov.type).toBe(StockMovementType.SALE);
    expect(mov.quantity.toString()).toBe("-3"); // egreso
    expect(mov.warehouseId).toBe("wh_default");

    expect(tx.stockItem.upsert).toHaveBeenCalledTimes(1);
    const upd = tx.stockItem.upsert.mock.calls[0][0];
    expect(upd.update.quantity).toEqual({ decrement: 3 });
  });

  it("lanza NotFoundException si un producto del carrito no existe", async () => {
    const { service } = setup({ products: [] }); // findMany no devuelve el producto

    await expect(
      service.create(baseInput([{ productId: "p1", quantity: 1, discount: 0 }]), "u1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lanza BadRequestException si no hay depósito por defecto", async () => {
    const { service } = setup({ products: [product("p1", "100")], warehouse: null });

    await expect(
      service.create(baseInput([{ productId: "p1", quantity: 1, discount: 0 }]), "u1")
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("lanza BadRequestException si no hay stock suficiente (no vende en negativo)", async () => {
    const { service } = setup({
      products: [product("p1", "100")],
      stock: [{ productId: "p1", quantity: new Prisma.Decimal(2) }],
    });

    await expect(
      service.create(baseInput([{ productId: "p1", quantity: 5, discount: 0 }]), "u1")
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("cuenta corriente en cuotas con recargo: suma el recargo al total y genera el cronograma", async () => {
    const { service, tx } = setup({ products: [product("p1", "100", "0")] }); // sin IVA para claridad

    // total base = 100; 3 cuotas con 10% de recargo => total 110, cuotas de ~36.67.
    await service.create(
      {
        paymentMethod: "ACCOUNT",
        customerId: "clzcustomer000000000000000",
        discount: 0,
        items: [{ productId: "p1", quantity: 1, discount: 0 }],
        installments: 3,
        applyFinancingSurcharge: true,
      },
      "u1"
    );

    const data = tx.sale.create.mock.calls[0][0].data;
    expect(data.total.toString()).toBe("110");
    expect(data.installmentsCount).toBe(3);
    expect(data.financingSurcharge.toString()).toBe("10");

    // Cronograma: 3 cuotas que suman 110 (la última absorbe el redondeo).
    const rows = tx.installment.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(3);
    const sum = rows.reduce((s: number, r: { amount: Prisma.Decimal }) => s + Number(r.amount), 0);
    expect(sum).toBeCloseTo(110, 2);
    expect(rows.map((r: { number: number }) => r.number)).toEqual([1, 2, 3]);
  });

  it("bloquea una venta a cuenta si el cliente alcanzó el límite de deuda", async () => {
    // Cliente con deuda 60.000 y límite 50.000 → no puede comprar a cuenta.
    const { service } = setup({ products: [product("p1", "100")], debt: 60000, creditLimit: 50000 });
    await expect(
      service.create(
        {
          paymentMethod: "ACCOUNT",
          customerId: "clzcustomer000000000000000",
          discount: 0,
          items: [{ productId: "p1", quantity: 1, discount: 0 }],
          applyFinancingSurcharge: false,
        },
        "u1"
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("permite la venta a cuenta si la deuda está por debajo del límite", async () => {
    const { service, tx } = setup({ products: [product("p1", "100")], debt: 10000, creditLimit: 50000 });
    await service.create(
      {
        paymentMethod: "ACCOUNT",
        customerId: "clzcustomer000000000000000",
        discount: 0,
        items: [{ productId: "p1", quantity: 1, discount: 0 }],
        applyFinancingSurcharge: false,
      },
      "u1"
    );
    expect(tx.sale.create).toHaveBeenCalled();
  });

  it("cuenta corriente en cuotas SIN aplicar recargo: divide el total sin sumar nada", async () => {
    const { service, tx } = setup({ products: [product("p1", "100", "0")] });

    await service.create(
      {
        paymentMethod: "ACCOUNT",
        customerId: "clzcustomer000000000000000",
        discount: 0,
        items: [{ productId: "p1", quantity: 1, discount: 0 }],
        installments: 3,
        applyFinancingSurcharge: false,
      },
      "u1"
    );

    const data = tx.sale.create.mock.calls[0][0].data;
    expect(data.total.toString()).toBe("100");
    expect(data.financingSurcharge.toString()).toBe("0");
    expect(tx.installment.createMany.mock.calls[0][0].data).toHaveLength(3);
  });
});
