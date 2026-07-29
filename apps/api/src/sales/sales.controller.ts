import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { SalesService } from "./sales.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { createSaleSchema, type CreateSaleInput, type JwtPayload } from "@ferrestock/shared";

@Controller("sales")
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createSaleSchema)) dto: CreateSaleInput,
    @CurrentUser() user: JwtPayload
  ) {
    return this.sales.create(dto, user.sub);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.sales.findOne(id);
  }
}
