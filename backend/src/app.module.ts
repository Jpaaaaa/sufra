import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { ItemsModule } from './modules/items/items.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { FloorsModule } from './modules/floors/floors.module';
import { HallsModule } from './modules/halls/halls.module';
import { TablesModule } from './modules/tables/tables.module';
import { KitchensModule } from './modules/kitchens/kitchens.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PrintersModule } from './modules/printers/printers.module';
import { ReportsModule } from './modules/reports/reports.module';
import { FinanceModule } from './modules/finance/finance.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { BusinessDayModule } from './modules/business-day/business-day.module';
import { AdminModule } from './modules/admin/admin.module';
import { ShelvesModule } from './modules/shelves/shelves.module';
import { PrintModule } from './modules/print/print.module';
import { OffersModule } from './modules/offers/offers.module';
import { ShiftsModule } from './modules/shifts/shifts.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsersModule,
    ItemsModule,
    CategoriesModule,
    FloorsModule,
    HallsModule,
    TablesModule,
    KitchensModule,
    OrdersModule,
    PrintersModule,
    PrintModule,
    ReportsModule,
    FinanceModule,
    HealthModule,
    BusinessDayModule,
    AdminModule,
    ShelvesModule,
    OffersModule,
    ShiftsModule,
  ],
})
export class AppModule {}
