import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { ProductsModule } from "./products/products.module";
import { SalesModule } from "./sales/sales.module";
import { WarehousesModule } from "./warehouses/warehouses.module";
import { WhatsappModule } from "./whatsapp/whatsapp.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProductsModule,
    SalesModule,
    WarehousesModule,
    WhatsappModule,
  ],
})
export class AppModule {}
