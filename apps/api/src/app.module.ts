import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { ProductsModule } from "./products/products.module";
import { SalesModule } from "./sales/sales.module";
import { WhatsappModule } from "./whatsapp/whatsapp.module";

@Module({
  imports: [PrismaModule, AuthModule, ProductsModule, SalesModule, WhatsappModule],
})
export class AppModule {}
