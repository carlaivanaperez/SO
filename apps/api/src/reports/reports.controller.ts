import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
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

  // Visitas al catálogo (contador propio, métrica interna): solo ADMIN.
  @Get("visits")
  @Roles("ADMIN")
  visits() {
    return this.reports.visits();
  }

  // Informe mensual (facturación + ganancia): solo ADMIN/MANAGER.
  // ?month=YYYY-MM (por defecto, el mes en curso en hora Argentina).
  @Get("monthly")
  @Roles("ADMIN", "MANAGER")
  monthly(@Query("month") month?: string) {
    const value = month ?? currentMonthAr();
    if (!/^\d{4}-\d{2}$/.test(value)) {
      throw new BadRequestException("El mes debe tener el formato YYYY-MM");
    }
    return this.reports.monthly(value);
  }
}

// Mes en curso en hora Argentina (offset fijo -3h), formato "YYYY-MM".
function currentMonthAr(): string {
  const ar = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return `${ar.getUTCFullYear()}-${String(ar.getUTCMonth() + 1).padStart(2, "0")}`;
}
