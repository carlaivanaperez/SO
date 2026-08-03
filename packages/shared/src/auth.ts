import { z } from "zod";

export const userRoleSchema = z.enum(["ADMIN", "MANAGER", "CASHIER"]);
export type UserRoleDTO = z.infer<typeof userRoleSchema>;

/** Nombres de los roles de cara al usuario (es-AR). */
export const roleLabels: Record<UserRoleDTO, string> = {
  ADMIN: "Administrador",
  MANAGER: "Encargado de stock",
  CASHIER: "Vendedor",
};

/** Qué hace cada rol, para explicarlo en la UI. */
export const roleDescriptions: Record<UserRoleDTO, string> = {
  ADMIN: "Acceso total: productos, precios, stock, ventas, clientes, promociones, reportes y usuarios.",
  MANAGER: "Gestiona el catálogo: alta/edición de productos, stock, promociones y clientes. También puede vender.",
  CASHIER: "Registra ventas en el punto de venta y consulta catálogo, stock y clientes.",
};

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  name: z.string().trim().min(1).max(120),
  role: userRoleSchema.default("CASHIER"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

// Editar rol / activar-desactivar un usuario del staff.
export const updateUserSchema = z.object({
  role: userRoleSchema.optional(),
  active: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export type StaffUser = {
  id: string;
  email: string;
  name: string;
  role: UserRoleDTO;
  active: boolean;
};

/** Contenido del JWT que emite la API. */
export type JwtPayload = {
  sub: string; // userId
  email: string;
  role: UserRoleDTO;
};

export type AuthResponse = {
  token: string;
  user: { id: string; email: string; name: string; role: UserRoleDTO };
};
