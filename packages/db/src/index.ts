// Punto de entrada del paquete de base de datos.
// Exporta un singleton de PrismaClient (evita agotar conexiones en dev por HMR)
// y re-exporta los tipos generados por Prisma para consumirlos desde otros paquetes.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
