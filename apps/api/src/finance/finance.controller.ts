import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { FinanceService } from "./finance.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { updateFinanceConfigSchema, type UpdateFinanceConfigInput } from "@ferrestock/shared";

@Controller("finance")
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  // Lectura: cualquier usuario autenticado (el POS necesita la escala para
  // mostrar el recargo y armar el cronograma al vender a cuenta).
  @Get("config")
  getConfig() {
    return this.finance.getConfig();
  }

  // Edición de tasas: solo ADMIN.
  @Patch("config")
  @Roles("ADMIN")
  updateConfig(
    @Body(new ZodValidationPipe(updateFinanceConfigSchema)) dto: UpdateFinanceConfigInput
  ) {
    return this.finance.updateConfig(dto);
  }
}
