import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ItemsModule } from '../items/items.module';
import { KitchensService } from './kitchens.service';
import { KitchensController } from './kitchens.controller';

@Module({
  imports: [DatabaseModule, ItemsModule],
  providers: [KitchensService],
  controllers: [KitchensController],
  exports: [KitchensService],
})
export class KitchensModule {}

