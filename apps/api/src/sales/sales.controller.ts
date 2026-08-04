import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { SalesService } from "./sales.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import {
  createSaleSchema,
  salesQuerySchema,
  type CreateSaleInput,
  type SalesQuery,
  type JwtPayload,
} from "@ferrestock/shared";

@Controller("sales")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  // Crear venta: cualquier usuario autenticado (incluye al vendedor).
  @Post()
  create(
    @Body(new ZodValidationPipe(createSaleSchema)) dto: CreateSaleInput,
    @CurrentUser() user: JwtPayload
  ) {
    return this.sales.create(dto, user.sub);
  }

  // Historial con filtros: /api/sales?from=&to=&paymentMethod=&product=&page=
  // Es facturación del negocio → solo ADMIN/MANAGER (el vendedor no lo ve).
  @Get()
  @Roles("ADMIN", "MANAGER")
  list(@Query(new ZodValidationPipe(salesQuerySchema)) query: SalesQuery) {
    return this.sales.list(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.sales.findOne(id);
  }
}
