import { Injectable, UnauthorizedException, ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import type {
  LoginInput,
  RegisterInput,
  AuthResponse,
  JwtPayload,
  UserRoleDTO,
  UpdateUserInput,
} from "@ferrestock/shared";
import { UserRole } from "@ferrestock/db";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  async register(dto: RegisterInput): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("Ya existe un usuario con ese email");

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        role: dto.role as UserRole,
        passwordHash,
      },
    });
    return this.buildResponse(user.id, user.email, user.name, user.role);
  }

  async login(dto: LoginInput): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Verificamos siempre para no filtrar si el email existe (timing).
    const ok = user && user.active && (await argon2.verify(user.passwordHash, dto.password));
    if (!ok || !user) throw new UnauthorizedException("Credenciales inválidas");

    return this.buildResponse(user.id, user.email, user.name, user.role);
  }

  // Staff del panel (sin el hash de contraseña).
  listUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, name: true, role: true, active: true },
    });
  }

  updateUser(id: string, dto: UpdateUserInput) {
    return this.prisma.user.update({
      where: { id },
      data: { role: dto.role as UserRole | undefined, active: dto.active },
      select: { id: true, email: true, name: true, role: true, active: true },
    });
  }

  private async buildResponse(
    id: string,
    email: string,
    name: string,
    role: UserRole
  ): Promise<AuthResponse> {
    const payload: JwtPayload = { sub: id, email, role: role as UserRoleDTO };
    const token = await this.jwt.signAsync(payload);
    return { token, user: { id, email, name, role: role as UserRoleDTO } };
  }
}
