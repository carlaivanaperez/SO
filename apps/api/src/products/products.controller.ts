import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ProductsService } from "./products.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import {
  createProductSchema,
  updateProductSchema,
  stockAdjustmentSchema,
  importProductsSchema,
  paginationSchema,
  type CreateProductInput,
  type UpdateProductInput,
  type StockAdjustmentInput,
  type ImportProductsInput,
  type Pagination,
  type JwtPayload,
} from "@ferrestock/shared";

@Controller("products")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  // Lectura: cualquier usuario autenticado (incluye cajeros).
  @Get()
  list(@Query(new ZodValidationPipe(paginationSchema)) query: Pagination) {
    return this.products.list(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.products.findOne(id);
  }

  // Alta/edición de catálogo y precios: solo ADMIN y MANAGER.
  @Post()
  @Roles("ADMIN", "MANAGER")
  create(@Body(new ZodValidationPipe(createProductSchema)) dto: CreateProductInput) {
    return this.products.create(dto);
  }

  @Patch(":id")
  @Roles("ADMIN", "MANAGER")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) dto: UpdateProductInput
  ) {
    return this.products.update(id, dto);
  }

  // Importación masiva de productos (CSV/Excel) → solo ADMIN/MANAGER.
  @Post("import")
  @Roles("ADMIN", "MANAGER")
  import(
    @Body(new ZodValidationPipe(importProductsSchema)) dto: ImportProductsInput,
    @CurrentUser() user: JwtPayload
  ) {
    return this.products.importProducts(dto, user.sub);
  }

  @Post(":id/stock")
  @Roles("ADMIN", "MANAGER")
  adjustStock(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(stockAdjustmentSchema)) dto: StockAdjustmentInput,
    @CurrentUser() user: JwtPayload
  ) {
    return this.products.adjustStock(id, dto, user.sub);
  }
}
