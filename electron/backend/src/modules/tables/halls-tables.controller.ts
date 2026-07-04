import {
  BadRequestException,
  NotFoundException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { TablesService, TableEntity } from './tables.service';
import { CreateTableDto } from './dto/create-table.dto';

@Controller('halls/:hallId/tables')
export class HallsTablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  findByHall(
    @Param('hallId', ParseIntPipe) hallId: number,
  ): Promise<TableEntity[]> {
    return this.tablesService.findByHall(hallId);
  }

  @Post()
  async createForHall(
    @Param('hallId', ParseIntPipe) hallId: number,
    @Body() dto: CreateTableDto,
  ): Promise<TableEntity> {
    try {
      // Ensure hall_id comes from the route, even if the client sends something else
      const result = await this.tablesService.create({
        hall_id: hallId,
        number: dto.number,
        name: dto.name,
      });
      return result;
    } catch (error) {
      // If it's already a NestJS exception, re-throw it
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      // Log unexpected errors
      console.error('[HallsTablesController] Error creating table:', error);
      // Throw a generic error
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to create table'
      );
    }
  }
}


