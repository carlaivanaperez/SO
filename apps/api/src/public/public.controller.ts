import { Controller, Get, Query } from "@nestjs/common";
import { PublicService } from "./public.service";

// Endpoints PÚBLICOS (sin login): catálogo para clientes. No usan guards.
@Controller("public")
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get("catalog")
  catalog(@Query("search") search?: string) {
    return this.publicService.catalog(search);
  }
}
