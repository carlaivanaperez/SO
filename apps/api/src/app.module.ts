import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { ProductsModule } from "./products/products.module";
import { SalesModule } from "./sales/sales.module";
import { WarehousesModule } from "./warehouses/warehouses.module";
import { WhatsappModule } from "./whatsapp/whatsapp.module";
import { ReportsModule } from "./reports/reports.module";
import { CustomersModule } from "./customers/customers.module";
import { PromotionsModule } from "./promotions/promotions.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProductsModule,
    SalesModule,
    WarehousesModule,
    WhatsappModule,
    ReportsModule,
    CustomersModule,
    PromotionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
