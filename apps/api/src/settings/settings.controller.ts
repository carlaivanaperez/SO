import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { updateStoreSettingsSchema, type UpdateStoreSettingsInput } from "@ferrestock/shared";

@Controller("settings")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  // Lectura: cualquier usuario autenticado. Edición: solo ADMIN.
  @Get("store")
  getStore() {
    return this.settings.getStore();
  }

  @Patch("store")
  @Roles("ADMIN")
  updateStore(
    @Body(new ZodValidationPipe(updateStoreSettingsSchema)) dto: UpdateStoreSettingsInput
  ) {
    return this.settings.updateStore(dto);
  }
}
