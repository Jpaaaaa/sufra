import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ShelvesService } from './shelves.service';
import { ShelvesController } from './shelves.controller';

@Module({
  imports: [DatabaseModule],
  providers: [ShelvesService],
  controllers: [ShelvesController],
  exports: [ShelvesService],
})
export class ShelvesModule {}

