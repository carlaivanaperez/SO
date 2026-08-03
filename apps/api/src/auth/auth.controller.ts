import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RolesGuard } from "./roles.guard";
import { Roles } from "./roles.decorator";
import { CurrentUser } from "./current-user.decorator";
import {
  loginSchema,
  registerSchema,
  updateUserSchema,
  type LoginInput,
  type RegisterInput,
  type UpdateUserInput,
  type JwtPayload,
} from "@ferrestock/shared";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginInput) {
    return this.auth.login(dto);
  }

  // Alta de usuarios del staff: solo un ADMIN puede crear otros usuarios.
  @Post("register")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  register(@Body(new ZodValidationPipe(registerSchema)) dto: RegisterInput) {
    return this.auth.register(dto);
  }

  @Get("users")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  listUsers() {
    return this.auth.listUsers();
  }

  @Patch("users/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  updateUser(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) dto: UpdateUserInput,
    @CurrentUser() user: JwtPayload
  ) {
    // Evitar que un admin se desactive o se quite el rol a sí mismo (lockout).
    if (id === user.sub && (dto.active === false || (dto.role && dto.role !== "ADMIN"))) {
      throw new BadRequestException("No podés quitarte tu propio acceso de administrador");
    }
    return this.auth.updateUser(id, dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }
}
