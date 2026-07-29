import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@ferrestock/db";

// Envolvemos el PrismaClient como provider inyectable de Nest.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
