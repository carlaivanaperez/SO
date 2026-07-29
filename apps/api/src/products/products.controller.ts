import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ProductsService } from "./products.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import {
  createProductSchema,
  updateProductSchema,
  stockAdjustmentSchema,
  paginationSchema,
  type CreateProductInput,
  type UpdateProductInput,
  type StockAdjustmentInput,
  type Pagination,
} from "@ferrestock/shared";

@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(paginationSchema)) query: Pagination) {
    return this.products.list(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.products.findOne(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(createProductSchema)) dto: CreateProductInput) {
    return this.products.create(dto);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) dto: UpdateProductInput
  ) {
    return this.products.update(id, dto);
  }

  @Post(":id/stock")
  adjustStock(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(stockAdjustmentSchema)) dto: StockAdjustmentInput
  ) {
    return this.products.adjustStock(id, dto);
  }
}
