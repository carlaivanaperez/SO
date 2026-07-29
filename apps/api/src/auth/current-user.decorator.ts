import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { JwtPayload } from "@ferrestock/shared";
import type { AuthedRequest } from "./jwt-auth.guard";

/** Inyecta el usuario autenticado. Ej: @CurrentUser() user: JwtPayload */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    return req.user!;
  }
);
