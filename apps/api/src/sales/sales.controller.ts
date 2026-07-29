import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { SalesService } from "./sales.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { createSaleSchema, type CreateSaleInput } from "@ferrestock/shared";

@Controller("sales")
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post()
  create(@Body(new ZodValidationPipe(createSaleSchema)) dto: CreateSaleInput) {
    // TODO: reemplazar por el userId del JWT una vez integrado AuthGuard.
    const userId = "dev-user";
    return this.sales.create(dto, userId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.sales.findOne(id);
  }
}
