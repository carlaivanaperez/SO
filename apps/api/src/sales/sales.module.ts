import { Module } from "@nestjs/common";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";
import { FinanceModule } from "../finance/finance.module";

@Module({
  imports: [FinanceModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
