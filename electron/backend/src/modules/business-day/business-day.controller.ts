import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { BusinessDayService, BusinessDay } from './business-day.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('business-day')
@UseGuards(AuthGuard, RolesGuard)
export class BusinessDayController {
  constructor(private readonly businessDayService: BusinessDayService) {}

  @Get('current')
  async getCurrent(): Promise<BusinessDay | null> {
    return this.businessDayService.getCurrentBusinessDay();
  }

  /**
   * Ensure a business day exists. Creates one if needed.
   * Also handles orphaned orders from the past.
   * Call this on app startup.
   */
  @Post('ensure')
  async ensure(): Promise<BusinessDay> {
    try {
      console.log('[BUSINESS-DAY] Ensure endpoint called');
      const result = await this.businessDayService.ensureBusinessDayExists();
      console.log('[BUSINESS-DAY] Ensure successful, day ID:', result.id);
      return result;
    } catch (error: any) {
      console.error('[BUSINESS-DAY] Ensure error:', error);
      console.error('[BUSINESS-DAY] Error stack:', error.stack);
      throw error;
    }
  }

  /**
   * Get all business days (for debugging/admin purposes)
   */
  @Get('all')
  @Roles('admin', 'manager')
  async getAll(): Promise<BusinessDay[]> {
    return this.businessDayService.getAllBusinessDays();
  }

  @Post('reset')
  @Roles('admin', 'manager')
  async reset(@Request() req: any): Promise<BusinessDay> {
    try {
      // Get username from authenticated user (set by AuthGuard)
      const username = req.user?.username || req.user?.name || 'Unknown';
      console.log('[BUSINESS-DAY] Reset requested by:', username);
      const result = await this.businessDayService.startNewBusinessDay(username);
      console.log('[BUSINESS-DAY] Reset successful, new day ID:', result.id);
      return result;
    } catch (error: any) {
      console.error('[BUSINESS-DAY] Reset error:', error);
      console.error('[BUSINESS-DAY] Error stack:', error.stack);
      throw error;
    }
  }
}

