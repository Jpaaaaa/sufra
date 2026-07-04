import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { BusinessDayService } from './business-day.service';
import { BusinessDayController } from './business-day.controller';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [DatabaseModule, OrdersModule],
  providers: [BusinessDayService],
  controllers: [BusinessDayController],
  exports: [BusinessDayService],
})
export class BusinessDayModule {}

