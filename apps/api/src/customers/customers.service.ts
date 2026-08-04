import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  imputePayments,
  daysOverdue,
  lateFee,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type CustomerPaymentInput,
  type CreditNoteInput,
} from "@ferrestock/shared";
import { Prisma, PaymentMethod, SaleStatus } from "@ferrestock/db";
import { FinanceService } from "../finance/finance.service";

const ZERO = () => new Prisma.Decimal(0);
const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService
  ) {}

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

    const [accountSales, payments, creditNotes, config] = await Promise.all([
      this.prisma.sale.findMany({
        where: { customerId: id, paymentMethod: PaymentMethod.ACCOUNT, status: SaleStatus.COMPLETED },
        select: {
          id: true,
          number: true,
          total: true,
          createdAt: true,
          installmentsCount: true,
          installments: {
            select: { id: true, number: true, amount: true, dueDate: true },
            orderBy: { number: "asc" },
          },
        },
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
      this.finance.getConfig(),
    ]);

    const charged = accountSales.reduce((s, x) => s.plus(x.total), ZERO());
    const paid = payments.reduce((s, x) => s.plus(x.amount), ZERO());
    const credited = creditNotes.reduce((s, x) => s.plus(x.amount), ZERO());

    // ── Cuotas + mora ────────────────────────────────────────────────
    // Las obligaciones del cliente (cuotas de ventas financiadas + ventas a
    // cuenta sin financiar, tratadas como un único cargo con vencimiento en la
    // fecha de la venta) se ordenan por vencimiento y se les imputa el pool de
    // pagos + notas de crédito, de la más vieja a la más nueva.
    type Obligation = {
      dueMs: number;
      amount: number;
      saleNumber: number;
      installmentNumber: number | null; // null = venta a cuenta sin cuotas
    };
    const obligations: Obligation[] = [];
    for (const sale of accountSales) {
      if (sale.installmentsCount && sale.installments.length > 0) {
        for (const inst of sale.installments) {
          obligations.push({
            dueMs: inst.dueDate.getTime(),
            amount: Number(inst.amount),
            saleNumber: sale.number,
            installmentNumber: inst.number,
          });
        }
      } else {
        obligations.push({
          dueMs: sale.createdAt.getTime(),
          amount: Number(sale.total),
          saleNumber: sale.number,
          installmentNumber: null,
        });
      }
    }
    obligations.sort((a, b) => a.dueMs - b.dueMs);

    const pool = Number(paid.plus(credited));
    const paidPer = imputePayments(pool, obligations.map((o) => o.amount));
    const now = Date.now();
    const dailyPercent = config.lateFeeDailyPercent;

    let totalLateFee = 0;
    // Vista de cuotas (solo obligaciones que son cuotas de ventas financiadas).
    const installments = obligations
      .map((o, i) => {
        const paidAmount = paidPer[i] ?? 0;
        const unpaid = round2(o.amount - paidAmount);
        const overdueDays = unpaid > 0.005 ? daysOverdue(new Date(o.dueMs).toISOString(), now) : 0;
        const fee = o.installmentNumber !== null ? lateFee(unpaid, overdueDays, dailyPercent) : 0;
        totalLateFee += fee;
        const status =
          unpaid <= 0.005
            ? "PAID"
            : overdueDays > 0
              ? "OVERDUE"
              : paidAmount > 0.005
                ? "PARTIAL"
                : "PENDING";
        return {
          saleNumber: o.saleNumber,
          number: o.installmentNumber,
          amount: round2(o.amount),
          paid: round2(paidAmount),
          dueDate: new Date(o.dueMs).toISOString(),
          status,
          lateFee: round2(fee),
          overdueDays,
        };
      })
      .filter((x) => x.number !== null); // en la vista solo mostramos cuotas

    const movements = [
      ...accountSales.map((s) => ({
        id: s.id,
        type: "SALE" as const,
        date: s.createdAt.toISOString(),
        amount: s.total.toString(),
        detail: s.installmentsCount ? `Venta #${s.number} (${s.installmentsCount} cuotas)` : `Venta #${s.number}`,
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

    // saldo capital = cargos − pagos − notas de crédito (la mora va aparte).
    const balance = charged.minus(paid).minus(credited);
    const lateFeeTotal = round2(totalLateFee);
    const totalDue = round2(Number(balance) + lateFeeTotal);

    return {
      ...customer,
      balance: balance.toString(),
      lateFee: lateFeeTotal.toFixed(2),
      totalDue: totalDue.toFixed(2),
      installments,
      movements,
    };
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
