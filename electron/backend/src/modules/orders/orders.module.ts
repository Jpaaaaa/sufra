import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrintersModule } from '../printers/printers.module';
import { ShelvesModule } from '../shelves/shelves.module';
import { TablesModule } from '../tables/tables.module';
import { DineInOrdersService } from './dine-in-orders.service';
import { PickupOrdersService } from './pickup-orders.service';
import { DeliveryOrdersService } from './delivery-orders.service';
import { DeliveryPlatformsService } from './delivery-platforms.service';

@Module({
  imports: [DatabaseModule, PrintersModule, ShelvesModule, TablesModule],
  providers: [
    OrdersService, // Legacy service (read-only)
    DineInOrdersService,
    PickupOrdersService,
    DeliveryOrdersService,
    DeliveryPlatformsService,
  ],
  controllers: [OrdersController],
  exports: [
    OrdersService, // Legacy service (read-only)
    DineInOrdersService,
    PickupOrdersService,
    DeliveryOrdersService,
    DeliveryPlatformsService,
  ],
})
export class OrdersModule {}

