import { NotFoundException } from "@nestjs/common";
import { Prisma, StockMovementType } from "@ferrestock/db";
import { ProductsService } from "./products.service";
import type { StockAdjustmentInput, UpdateProductInput } from "@ferrestock/shared";

function setup(existing: Record<string, unknown> | null) {
  const tx = {
    product: { update: jest.fn().mockResolvedValue({
      id: "p1",
      costPrice: new Prisma.Decimal("60"),
      salePrice: new Prisma.Decimal("150"),
    }) },
    priceHistory: { create: jest.fn().mockResolvedValue({}) },
    stockMovement: { create: jest.fn().mockResolvedValue({ id: "mov_1" }) },
    stockItem: { upsert: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    product: { findUnique: jest.fn().mockResolvedValue(existing) },
    $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  const service = new ProductsService(prisma as never);
  return { service, prisma, tx };
}

const existingProduct = {
  id: "p1",
  costPrice: new Prisma.Decimal("50"),
  salePrice: new Prisma.Decimal("100"),
};

describe("ProductsService.adjustStock", () => {
  const adj: StockAdjustmentInput = {
    warehouseId: "wh_default",
    quantity: 5,
    type: "PURCHASE",
  };

  it("registra un StockMovement y hace upsert del StockItem en una transacción", async () => {
    const { service, tx } = setup(existingProduct);

    await service.adjustStock("p1", adj, "u1");

    const mov = tx.stockMovement.create.mock.calls[0][0].data;
    expect(mov.type).toBe(StockMovementType.PURCHASE);
    expect(mov.quantity).toBe(5);
    expect(mov.warehouseId).toBe("wh_default");
    expect(mov.userId).toBe("u1");

    const up = tx.stockItem.upsert.mock.calls[0][0];
    expect(up.create.quantity).toBe(5);
    expect(up.update.quantity).toEqual({ increment: 5 });
  });

  it("lanza NotFoundException si el producto no existe", async () => {
    const { service } = setup(null);
    await expect(service.adjustStock("nope", adj, "u1")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("ProductsService.update", () => {
  it("registra PriceHistory cuando cambia el precio", async () => {
    const { service, tx } = setup(existingProduct);

    await service.update("p1", { salePrice: 150 } as UpdateProductInput);

    expect(tx.product.update).toHaveBeenCalledTimes(1);
    expect(tx.priceHistory.create).toHaveBeenCalledTimes(1);
  });

  it("NO registra PriceHistory cuando no cambian los precios", async () => {
    const { service, tx } = setup(existingProduct);

    await service.update("p1", { name: "Nuevo nombre" } as UpdateProductInput);

    expect(tx.product.update).toHaveBeenCalledTimes(1);
    expect(tx.priceHistory.create).not.toHaveBeenCalled();
  });
});
