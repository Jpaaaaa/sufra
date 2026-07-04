import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Patch,
} from '@nestjs/common';
import { FloorsService, Floor } from './floors.service';
import { CreateFloorDto } from './dto/create-floor.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';

@Controller('floors')
export class FloorsController {
  constructor(private readonly floorsService: FloorsService) {}

  @Get()
  findAll(): Promise<Floor[]> {
    return this.floorsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Floor> {
    return this.floorsService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateFloorDto): Promise<Floor> {
    try {
      const floorNumber = dto.number ?? dto.floor_number;
      if (floorNumber == null) {
        throw new BadRequestException('floor number is required');
      }
      const result = await this.floorsService.create({
        name: dto.name,
        floor_number: floorNumber,
      });
      return result;
    } catch (error) {
      // If it's already a NestJS exception, re-throw it
      if (error instanceof BadRequestException) {
        throw error;
      }
      // Log unexpected errors
      console.error('[FloorsController] Error creating floor:', error);
      // Throw a generic error
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to create floor'
      );
    }
  }

  @Put(':id')
  updatePut(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFloorDto,
  ): Promise<Floor> {
    return this.floorsService.update(id, {
      name: dto.name,
      floor_number: dto.number ?? dto.floor_number,
    });
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFloorDto,
  ): Promise<Floor> {
    return this.floorsService.update(id, {
      name: dto.name,
      floor_number: dto.number ?? dto.floor_number,
    });
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.floorsService.remove(id);
  }
}

