import { Controller, Get, UseGuards } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  // Resumen para el dashboard: ventas de hoy, stock bajo y últimas ventas.
  @Get("summary")
  summary() {
    return this.reports.summary();
  }
}
