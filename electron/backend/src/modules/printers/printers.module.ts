import { Module } from '@nestjs/common';
import { PrintersController } from './printers.controller';
import { PrintersService } from './printers.service';
import { DatabaseService } from '../../database/database.service';

@Module({
  controllers: [PrintersController],
  providers: [PrintersService, DatabaseService],
  exports: [PrintersService],
})
export class PrintersModule {}

