import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerPaymentInput,
  CreditNoteInput,
} from "@ferrestock/shared";
import { Prisma, PaymentMethod, SaleStatus } from "@ferrestock/db";

const ZERO = () => new Prisma.Decimal(0);

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  // Lista de clientes con su saldo de cuenta corriente.
  // saldo = ventas ACCOUNT (cargos) − pagos recibidos. Positivo = nos debe.
  async list(search?: string) {
    const where: Prisma.CustomerWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { taxId: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const customers = await this.prisma.customer.findMany({ where, orderBy: { name: "asc" } });
    const ids = customers.map((c) => c.id);

    const [charges, payments, credits] = await Promise.all([
      this.prisma.sale.groupBy({
        by: ["customerId"],
        where: { customerId: { in: ids }, paymentMethod: PaymentMethod.ACCOUNT, status: SaleStatus.COMPLETED },
        _sum: { total: true },
      }),
      this.prisma.customerPayment.groupBy({
        by: ["customerId"],
        where: { customerId: { in: ids } },
        _sum: { amount: true },
      }),
      this.prisma.creditNote.groupBy({
        by: ["customerId"],
        where: { customerId: { in: ids } },
        _sum: { amount: true },
      }),
    ]);

    const chargeMap = new Map(charges.map((c) => [c.customerId, c._sum.total ?? ZERO()]));
    const payMap = new Map(payments.map((p) => [p.customerId, p._sum.amount ?? ZERO()]));
    const creditMap = new Map(credits.map((c) => [c.customerId, c._sum.amount ?? ZERO()]));

    // saldo = cargos − pagos − notas de crédito.
    return customers.map((c) => ({
      ...c,
      balance: (chargeMap.get(c.id) ?? ZERO())
        .minus(payMap.get(c.id) ?? ZERO())
        .minus(creditMap.get(c.id) ?? ZERO())
        .toString(),
    }));
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException("Cliente no encontrado");

    const [accountSales, payments, creditNotes] = await Promise.all([
      this.prisma.sale.findMany({
        where: { customerId: id, paymentMethod: PaymentMethod.ACCOUNT, status: SaleStatus.COMPLETED },
        select: { id: true, number: true, total: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.customerPayment.findMany({
        where: { customerId: id },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.creditNote.findMany({
        where: { customerId: id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const charged = accountSales.reduce((s, x) => s.plus(x.total), ZERO());
    const paid = payments.reduce((s, x) => s.plus(x.amount), ZERO());
    const credited = creditNotes.reduce((s, x) => s.plus(x.amount), ZERO());

    const movements = [
      ...accountSales.map((s) => ({
        id: s.id,
        type: "SALE" as const,
        date: s.createdAt.toISOString(),
        amount: s.total.toString(),
        detail: `Venta #${s.number}`,
        method: null as string | null,
      })),
      ...payments.map((p) => ({
        id: p.id,
        type: "PAYMENT" as const,
        date: p.createdAt.toISOString(),
        amount: p.amount.toString(),
        detail: p.note ?? "Pago recibido",
        method: p.method as string | null,
      })),
      ...creditNotes.map((n) => ({
        id: n.id,
        type: "CREDIT" as const,
        date: n.createdAt.toISOString(),
        amount: n.amount.toString(),
        detail: n.reason ?? "Nota de crédito",
        method: null as string | null,
      })),
    ].sort((a, b) => (a.date < b.date ? 1 : -1));

    // saldo = cargos − pagos − notas de crédito.
    return { ...customer, balance: charged.minus(paid).minus(credited).toString(), movements };
  }

  async addCreditNote(id: string, dto: CreditNoteInput, userId?: string) {
    await this.findOneRaw(id);
    return this.prisma.creditNote.create({
      data: { customerId: id, amount: dto.amount, reason: dto.reason, userId },
    });
  }

  create(dto: CreateCustomerInput) {
    return this.prisma.customer.create({ data: dto });
  }

  async update(id: string, dto: UpdateCustomerInput) {
    await this.findOneRaw(id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async addPayment(id: string, dto: CustomerPaymentInput, userId?: string) {
    await this.findOneRaw(id);
    return this.prisma.customerPayment.create({
      data: {
        customerId: id,
        amount: dto.amount,
        method: dto.method as PaymentMethod | undefined,
        note: dto.note,
        userId,
      },
    });
  }

  private async findOneRaw(id: string) {
    const c = await this.prisma.customer.findUnique({ where: { id } });
    if (!c) throw new NotFoundException("Cliente no encontrado");
    return c;
  }
}
