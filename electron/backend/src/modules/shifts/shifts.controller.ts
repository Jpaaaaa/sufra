import {
  Controller,
  Get,
  Post,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ShiftsService, Shift } from './shifts.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('shifts')
@UseGuards(AuthGuard, RolesGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get('active')
  async getActiveShift(): Promise<Shift | null> {
    return this.shiftsService.getActiveShift();
  }

  @Post('start')
  @Roles('admin', 'manager', 'cashier')
  async startShift(@Request() req: any): Promise<Shift> {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User ID not found in token');
    }
    return this.shiftsService.startShift(userId);
  }

  @Post('finish')
  @Roles('admin', 'manager', 'cashier')
  async finishShift(@Request() req: any): Promise<Shift> {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User ID not found in token');
    }
    return this.shiftsService.finishShift(userId);
  }

  @Get('list')
  @Roles('admin', 'manager')
  async getAllShifts(): Promise<Shift[]> {
    return this.shiftsService.getAllShifts();
  }

  @Get(':id')
  @Roles('admin', 'manager')
  async getShiftById(@Param('id', ParseIntPipe) id: number): Promise<Shift | null> {
    return this.shiftsService.getShiftById(id);
  }
}

