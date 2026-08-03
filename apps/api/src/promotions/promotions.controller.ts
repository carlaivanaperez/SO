import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { PromotionsService } from "./promotions.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { createPromotionSchema, type CreatePromotionInput } from "@ferrestock/shared";

@Controller("promotions")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  // Promos vigentes (las usa el POS/catálogo). Cualquier usuario autenticado.
  @Get("active")
  active() {
    return this.promotions.active();
  }

  @Get()
  listByProduct(@Query("productId") productId: string) {
    return this.promotions.listByProduct(productId);
  }

  @Post()
  @Roles("ADMIN", "MANAGER")
  create(@Body(new ZodValidationPipe(createPromotionSchema)) dto: CreatePromotionInput) {
    return this.promotions.create(dto);
  }

  @Delete(":id")
  @Roles("ADMIN", "MANAGER")
  remove(@Param("id") id: string) {
    return this.promotions.remove(id);
  }
}
