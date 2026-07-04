import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';
import { OffersModule } from '../offers/offers.module';
import { UploadService } from './upload.service';

@Module({
  imports: [DatabaseModule, OffersModule],
  providers: [ItemsService, UploadService],
  controllers: [ItemsController],
  exports: [ItemsService],
})
export class ItemsModule {}


