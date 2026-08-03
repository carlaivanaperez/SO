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
}) {
  const tx = {
    sale: { create: jest.fn().mockResolvedValue({ id: "sale_1", items: [] }) },
    stockMovement: { create: jest.fn().mockResolvedValue({}) },
    stockItem: { upsert: jest.fn().mockResolvedValue({}) },
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
    $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  const service = new SalesService(prisma as never);
  return { service, prisma, tx };
}

const baseInput = (items: CreateSaleInput["items"], discount = 0): CreateSaleInput => ({
  paymentMethod: "CASH",
  discount,
  items,
});

describe("SalesService.create", () => {
  it("calcula subtotal, IVA y total congelando el precio de venta del producto", async () => {
    const { service, tx } = setup({ products: [product("p1", "100")] });

    await service.create(baseInput([{ productId: "p1", quantity: 2, discount: 0 }]), "u1");

    const data = tx.sale.create.mock.calls[0][0].data;
    // 100 * 2 = 200 subtotal; IVA 21% = 42; total 242.
    expect(data.subtotal.toString()).toBe("200");
    expect(data.tax.toString()).toBe("42");
    expect(data.total.toString()).toBe("242");
    expect(data.status).toBe(SaleStatus.COMPLETED);
    // El ítem guarda el precio unitario congelado.
    expect(data.items.create[0].unitPrice.toString()).toBe("100");
  });

  it("usa el unitPrice provisto en lugar del precio del producto", async () => {
    const { service, tx } = setup({ products: [product("p1", "100")] });

    await service.create(baseInput([{ productId: "p1", quantity: 1, unitPrice: 50, discount: 0 }]), "u1");

    const data = tx.sale.create.mock.calls[0][0].data;
    expect(data.subtotal.toString()).toBe("50");
    expect(data.tax.toString()).toBe("10.5"); // 50 * 21%
    expect(data.total.toString()).toBe("60.5");
  });

  it("aplica descuento por ítem y descuento global", async () => {
    const { service, tx } = setup({ products: [product("p1", "100")] });

    // qty 1, precio 100, descuento de ítem 10 => bruto 90; IVA 18.9; total 90+18.9-5.
    await service.create(baseInput([{ productId: "p1", quantity: 1, discount: 10 }], 5), "u1");

    const data = tx.sale.create.mock.calls[0][0].data;
    expect(data.subtotal.toString()).toBe("90");
    expect(data.tax.toString()).toBe("18.9");
    expect(data.total.toString()).toBe("103.9");
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
});
