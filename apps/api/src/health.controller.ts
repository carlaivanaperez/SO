import { Controller, Get } from "@nestjs/common";

// Endpoint público de salud para el hosting (Render lo consulta en /api/health).
@Controller("health")
export class HealthController {
  @Get()
  check() {
    return { status: "ok" };
  }
}
