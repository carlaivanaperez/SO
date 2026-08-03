import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CustomersService } from "./customers.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerPaymentSchema,
  creditNoteSchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type CustomerPaymentInput,
  type CreditNoteInput,
  type JwtPayload,
} from "@ferrestock/shared";

@Controller("customers")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  // Lectura: cualquier usuario autenticado (el cajero necesita elegir cliente).
  @Get()
  list(@Query("search") search?: string) {
    return this.customers.list(search);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.customers.findOne(id);
  }

  // Alta/edición y pagos: ADMIN y MANAGER.
  @Post()
  @Roles("ADMIN", "MANAGER")
  create(@Body(new ZodValidationPipe(createCustomerSchema)) dto: CreateCustomerInput) {
    return this.customers.create(dto);
  }

  @Patch(":id")
  @Roles("ADMIN", "MANAGER")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) dto: UpdateCustomerInput
  ) {
    return this.customers.update(id, dto);
  }

  @Post(":id/payments")
  @Roles("ADMIN", "MANAGER")
  addPayment(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(customerPaymentSchema)) dto: CustomerPaymentInput,
    @CurrentUser() user: JwtPayload
  ) {
    return this.customers.addPayment(id, dto, user.sub);
  }

  @Post(":id/credit-notes")
  @Roles("ADMIN", "MANAGER")
  addCreditNote(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(creditNoteSchema)) dto: CreditNoteInput,
    @CurrentUser() user: JwtPayload
  ) {
    return this.customers.addCreditNote(id, dto, user.sub);
  }
}
