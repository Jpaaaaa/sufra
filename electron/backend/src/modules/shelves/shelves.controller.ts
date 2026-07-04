import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Patch,
  Delete,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ShelvesService, ShelfItem } from './shelves.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { IsString, IsNotEmpty, IsNumber, Min, IsOptional } from 'class-validator';

class CreateShelfItemDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  barcode!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsNumber()
  @Min(0)
  quantity!: number;
}

class UpdateShelfItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  barcode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;
}

class DecreaseStockDto {
  @IsNumber()
  @Min(1)
  quantity!: number;
}

class SellDto {
  @IsString()
  @IsNotEmpty()
  barcode!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;
}

@Controller('shelves')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'manager', 'cashier', 'waiter')
export class ShelvesController {
  constructor(private readonly shelvesService: ShelvesService) {}

  @Get()
  findAll(): Promise<ShelfItem[]> {
    return this.shelvesService.findAll();
  }

  @Get('sales/today')
  getTodaySales() {
    return this.shelvesService.getTodaySales();
  }

  @Get('barcode/:barcode')
  findByBarcode(@Param('barcode') barcode: string): Promise<ShelfItem> {
    return this.shelvesService.findOneByBarcode(barcode);
  }

  @Post('sell')
  sell(@Body() dto: SellDto) {
    return this.shelvesService.sell(dto.barcode, dto.quantity);
  }

  @Post()
  create(@Body() dto: CreateShelfItemDto): Promise<ShelfItem> {
    return this.shelvesService.create(dto);
  }

  @Patch(':id/decrease-stock')
  decreaseStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecreaseStockDto,
  ): Promise<ShelfItem> {
    return this.shelvesService.decreaseStock(id, dto.quantity);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShelfItemDto,
  ): Promise<ShelfItem> {
    return this.shelvesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.shelvesService.remove(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ShelfItem> {
    return this.shelvesService.findOneById(id);
  }
}

