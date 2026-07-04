import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { UsersModule } from '../users/users.module';
import { TablesService } from './tables.service';
import { TablesController } from './tables.controller';
import { HallsTablesController } from './halls-tables.controller';

@Module({
  imports: [DatabaseModule, UsersModule],
  providers: [TablesService],
  controllers: [TablesController, HallsTablesController],
  exports: [TablesService],
})
export class TablesModule {}


