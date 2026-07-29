import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRoleDTO } from "@ferrestock/shared";
import { ROLES_KEY } from "./roles.decorator";
import type { AuthedRequest } from "./jwt-auth.guard";

// Debe usarse DESPUÉS de JwtAuthGuard (que setea request.user).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRoleDTO[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user || !required.includes(req.user.role)) {
      throw new ForbiddenException("No tenés permisos para esta acción");
    }
    return true;
  }
}
