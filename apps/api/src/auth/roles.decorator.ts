import { SetMetadata } from "@nestjs/common";
import type { UserRoleDTO } from "@ferrestock/shared";

export const ROLES_KEY = "roles";

/** Restringe un endpoint a ciertos roles. Ej: @Roles("ADMIN", "MANAGER") */
export const Roles = (...roles: UserRoleDTO[]) => SetMetadata(ROLES_KEY, roles);
