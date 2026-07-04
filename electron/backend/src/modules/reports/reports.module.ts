import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { BusinessDayModule } from '../business-day/business-day.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [DatabaseModule, BusinessDayModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}

