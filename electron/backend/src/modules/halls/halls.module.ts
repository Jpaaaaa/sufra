import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { HallsService } from './halls.service';
import { HallsController } from './halls.controller';

@Module({
  imports: [DatabaseModule],
  providers: [HallsService],
  controllers: [HallsController],
  exports: [HallsService],
})
export class HallsModule {}


