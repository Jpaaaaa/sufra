import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Put,
  Delete,
  ParseIntPipe,
  UseGuards,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ItemsService, Item } from './items.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OffersService } from '../offers/offers.service';
import { UploadService } from './upload.service';
import { memoryStorage } from 'multer';

class CreateItemDto {
  name!: string;
  price!: number;
  categoryId?: number;
  kitchen_id?: number;
  image_url?: string;
  is_out_of_stock?: boolean;
  hidden_from_menu?: boolean;
}

class UpdateItemDto {
  name?: string;
  price?: number;
  categoryId?: number;
  kitchen_id?: number;
  image_url?: string;
  is_out_of_stock?: boolean;
  hidden_from_menu?: boolean;
}

@Controller('items')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'manager', 'customer')
export class ItemsController {
  constructor(
    private readonly itemsService: ItemsService,
    private readonly offersService: OffersService,
    private readonly uploadService: UploadService,
  ) {}

  @Get()
  async findAll(
    @Query('applyOffers') applyOffers?: string, 
    @Query('includeCombos') includeCombos?: string,
    @Query('kitchen_id') kitchenId?: string,
  ): Promise<Item[]> {
    const kitchen_id = kitchenId ? parseInt(kitchenId, 10) : undefined;
    const items = await this.itemsService.findAll(kitchen_id);
    
    // Default to applying offers unless explicitly disabled
    const shouldApplyOffers = applyOffers !== 'false';
    const shouldIncludeCombos = includeCombos !== 'false';
    
    let enrichedItems = items;
    
    if (shouldApplyOffers) {
      enrichedItems = await this.offersService.enrichItemsWithOffers(items);
    }
    
    // Add combos as virtual items
    if (shouldIncludeCombos) {
      const combos = await this.offersService.getAllCombos();
      const activeCombos = combos.filter((c) => c.is_active === 1);
      
      // Add combos as virtual items with negative IDs to distinguish them
      const comboItems: Item[] = activeCombos.map((combo) => ({
        id: -combo.id, // Negative ID to indicate it's a combo
        name: combo.combo_name,
        price: combo.combo_price,
        categoryId: null,
        kitchen_id: null,
        original_price: combo.combo_price,
        is_featured: false,
        is_out_of_stock: false,
        hidden_from_menu: false,
      }));
      
      enrichedItems = [...enrichedItems, ...comboItems];
    }
    
    return enrichedItems;
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Item> {
    return this.itemsService.findOne(id);
  }

  @Post()
  @Roles('admin', 'manager')
  create(@Body() dto: CreateItemDto): Promise<Item> {
    return this.itemsService.create(dto);
  }

  @Put(':id')
  @Roles('admin', 'manager')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateItemDto,
  ): Promise<Item> {
    // If updating image_url, delete old image if it was an uploaded file
    if (dto.image_url !== undefined) {
      const existing = await this.itemsService.findOne(id);
      if (existing.image_url && existing.image_url.startsWith('/uploads/') && existing.image_url !== dto.image_url) {
        this.uploadService.deleteFile(existing.image_url);
      }
    }
    return this.itemsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    // Get item before deleting to remove its image
    const item = await this.itemsService.findOne(id);
    if (item.image_url && item.image_url.startsWith('/uploads/')) {
      this.uploadService.deleteFile(item.image_url);
    }
    return this.itemsService.remove(id);
  }

  @Post('upload')
  @Roles('admin', 'manager')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const imageUrl = await this.uploadService.saveFile(file);
    return { imageUrl };
  }
}


