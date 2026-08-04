import { Module } from "@nestjs/common";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";
import { FinanceModule } from "../finance/finance.module";

@Module({
  imports: [FinanceModule],
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
