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
import { HallsService, Hall } from './halls.service';
import { CreateHallDto } from './dto/create-hall.dto';
import { UpdateHallDto } from './dto/update-hall.dto';

@Controller('halls')
export class HallsController {
  constructor(private readonly hallsService: HallsService) {}

  @Get()
  findAll(): Promise<Hall[]> {
    return this.hallsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Hall> {
    return this.hallsService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateHallDto): Promise<Hall> {
    try {
      const hallNumber = dto.number ?? dto.hall_number;
      if (hallNumber == null) {
        throw new BadRequestException('hall number is required');
      }
      const result = await this.hallsService.create({
        name: dto.name,
        hall_number: hallNumber,
        floor_id: dto.floor_id,
      });
      return result;
    } catch (error) {
      // If it's already a NestJS exception, re-throw it
      if (error instanceof BadRequestException) {
        throw error;
      }
      // Log unexpected errors
      console.error('[HallsController] Error creating hall:', error);
      // If DB write succeeded but something else failed, return the created hall if possible
      // Otherwise, throw a generic error
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to create hall'
      );
    }
  }

  @Put(':id')
  updatePut(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHallDto,
  ): Promise<Hall> {
    // Backwards-compatibility for any existing PUT clients
    return this.hallsService.update(id, {
      name: dto.name,
      hall_number: dto.number ?? dto.hall_number,
      floor_id: dto.floor_id,
    });
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHallDto,
  ): Promise<Hall> {
    return this.hallsService.update(id, {
      name: dto.name,
      hall_number: dto.number ?? dto.hall_number,
      floor_id: dto.floor_id,
    });
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.hallsService.remove(id);
  }
}


