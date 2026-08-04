import { Controller, Get, UseGuards } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtPayload } from "@ferrestock/shared";

@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  // Resumen para el dashboard: ventas de hoy, stock bajo y últimas ventas.
  // El vendedor (CASHIER) no recibe facturación (dinero del día / últimas ventas).
  @Get("summary")
  summary(@CurrentUser() user: JwtPayload) {
    return this.reports.summary(user.role !== "CASHIER");
  }

  // Planilla de compra: productos bajo el mínimo con cantidad sugerida.
  @Get("low-stock")
  lowStock() {
    return this.reports.lowStock();
  }
}
