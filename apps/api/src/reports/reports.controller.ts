import { Controller, Get, UseGuards } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtPayload } from "@ferrestock/shared";

@Controller("reports")
@UseGuards(JwtAuthGuard, RolesGuard)
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

  // Márgenes por producto (costo/ganancia): info sensible → solo ADMIN/MANAGER.
  @Get("margins")
  @Roles("ADMIN", "MANAGER")
  margins() {
    return this.reports.margins();
  }
}
