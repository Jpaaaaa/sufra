import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';

@Module({
  imports: [DatabaseModule],
  providers: [CategoriesService],
  controllers: [CategoriesController],
})
export class CategoriesModule {}


