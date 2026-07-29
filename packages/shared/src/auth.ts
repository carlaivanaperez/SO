import { z } from "zod";

export const userRoleSchema = z.enum(["ADMIN", "MANAGER", "CASHIER"]);
export type UserRoleDTO = z.infer<typeof userRoleSchema>;

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
