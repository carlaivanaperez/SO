import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  // Depósitos ordenados con el predeterminado primero (útil para la UI).
  list() {
    return this.prisma.warehouse.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }
}
