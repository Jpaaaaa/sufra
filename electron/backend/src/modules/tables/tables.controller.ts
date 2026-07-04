import {
  BadRequestException,
  NotFoundException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { TablesService, TableEntity } from './tables.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

class UnlockTableDto {
  password!: string;
  expires_at?: string;
}

class LockCustomerDto {
  password!: string;
}

@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  findByHall(
    @Query('hall_id', ParseIntPipe) hallId: number,
  ): Promise<TableEntity[]> {
    return this.tablesService.findByHall(hallId);
  }

  @Post()
  async create(@Body() dto: CreateTableDto): Promise<TableEntity> {
    try {
      const result = await this.tablesService.create({
        hall_id: dto.hall_id,
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
      console.error('[TablesController] Error creating table:', error);
      // Throw a generic error
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to create table'
      );
    }
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTableDto,
  ): Promise<TableEntity> {
    return this.tablesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.tablesService.remove(id);
  }

  // Table lock endpoints
  @Get(':id/is-unlocked')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'cashier', 'waiter', 'customer')
  async isTableUnlocked(@Param('id', ParseIntPipe) id: number): Promise<{ unlocked: boolean }> {
    const unlocked = await this.tablesService.isTableUnlocked(id);
    return { unlocked };
  }

  @Post(':id/unlock')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'customer')
  async unlockTable(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UnlockTableDto,
    @Request() req: any,
  ): Promise<{ success: boolean }> {
    await this.tablesService.unlockTable(id, req.user.sub, dto.password, dto.expires_at);
    return { success: true };
  }

  @Post(':id/lock')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'customer')
  async lockTable(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ): Promise<{ success: boolean }> {
    await this.tablesService.lockTable(id, req.user.sub);
    return { success: true };
  }

  @Get('customer/locked-table')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('customer')
  async getCustomerLockedTable(@Request() req: any): Promise<{ table_id: number | null }> {
    const tableId = await this.tablesService.getCustomerLockedTable(req.user.sub);
    return { table_id: tableId };
  }

  @Post('customer/lock')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'customer')
  async lockCustomerToTable(
    @Body() body: { user_id: number; table_id: number },
    @Request() req: any,
  ): Promise<{ success: boolean }> {
    await this.tablesService.lockCustomerToTable(body.user_id, body.table_id);
    return { success: true };
  }

  @Post('customer/unlock')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'customer')
  async unlockCustomerFromTable(
    @Body() body: { user_id: number; password: string },
    @Request() req: any,
  ): Promise<{ success: boolean }> {
    await this.tablesService.unlockCustomerFromTable(body.user_id, req.user.sub, body.password);
    return { success: true };
  }
}


