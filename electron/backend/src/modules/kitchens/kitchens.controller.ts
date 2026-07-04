import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { KitchensService, Kitchen } from './kitchens.service';
import { ItemsService } from '../items/items.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

class CreateKitchenDto {
  name!: string;
  description?: string;
  floor_id?: number | null;
}

class UpdateKitchenDto {
  name?: string;
  description?: string;
  floor_id?: number | null;
  is_active?: number;
}

@Controller('kitchens')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'kitchen', 'customer')
export class KitchensController {
  constructor(
    private readonly kitchensService: KitchensService,
    private readonly itemsService: ItemsService,
  ) {}

  @Get()
  findAll(): Promise<Kitchen[]> {
    return this.kitchensService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Kitchen> {
    return this.kitchensService.findOne(id);
  }

  @Get(':id/items')
  async getKitchenItems(@Param('id', ParseIntPipe) id: number) {
    const items = await this.itemsService.findAll(id);
    
    // Get service type information for each item from recent orders
    const itemsWithServiceTypes = await Promise.all(
      items.map(async (item) => {
        // Query order_items to see what service_types have been used for this item
        const serviceTypes = await this.kitchensService.getItemsServiceTypes(item.id);
        
        return {
          ...item,
          service_types: serviceTypes, // Array of service types used: ['dine-in', 'pickup'] or just one
          available_for_pickup: serviceTypes.includes('pickup'),
          available_for_dine_in: serviceTypes.includes('dine-in'),
        };
      })
    );
    
    return itemsWithServiceTypes;
  }

  @Post()
  @Roles('admin', 'kitchen')
  create(@Body() dto: CreateKitchenDto): Promise<Kitchen> {
    return this.kitchensService.create({
      name: dto.name,
      description: dto.description,
      floor_id: dto.floor_id,
    });
  }

  @Put(':id')
  @Roles('admin', 'kitchen')
  updatePut(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateKitchenDto,
  ): Promise<Kitchen> {
    return this.kitchensService.update(id, dto);
  }

  @Patch(':id')
  @Roles('admin', 'kitchen')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateKitchenDto,
  ): Promise<Kitchen> {
    return this.kitchensService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'kitchen')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.kitchensService.remove(id);
  }
}

