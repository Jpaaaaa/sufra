import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  HttpStatus,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { BusinessDayService } from '../business-day/business-day.service';
import { ExportPdfDto } from './dto/export-pdf.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('reports')
@UseGuards(AuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly businessDayService: BusinessDayService,
  ) {}

  @Get('daily-summary')
  async getDailySummary() {
    return this.reportsService.getDailySummary();
  }

  @Get('data')
  async getReportData(
    @Query('period') period: 'daily' | 'weekly' | 'monthly' | 'yearly',
    @Query('date') date: string,
  ) {
    if (!period || !['daily', 'weekly', 'monthly', 'yearly'].includes(period)) {
      throw new BadRequestException('Invalid period. Must be: daily, weekly, monthly, or yearly');
    }
    if (!date) {
      throw new BadRequestException('Date is required');
    }
    
    return this.reportsService.getReportData(period, date);
  }

  private validateDto(dto: ExportPdfDto) {
    if (!dto.type || !dto.date || !dto.data) {
      throw new BadRequestException('Missing required fields: type, date, data');
    }

    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(dto.type)) {
      throw new BadRequestException('Invalid type. Must be: daily, weekly, monthly, or yearly');
    }

    const date = new Date(dto.date);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
  }

  // PDF export endpoint removed - PDF export is ONLY available via IPC in Electron main process

  private validateDataStructure(dto: ExportPdfDto) {
    if (!dto.data) {
      throw new BadRequestException('Data is required');
    }

    // Validate summary structure
    if (dto.data.summary) {
      const summary = dto.data.summary;
      const requiredFields: (keyof typeof summary)[] = ['totalSales', 'orderCount', 'averageOrder', 'discounts', 'cancellations'];
      const missingFields = requiredFields.filter(field => summary[field] === undefined);
      
      if (missingFields.length > 0) {
        console.warn('[Controller] Summary missing fields:', missingFields);
        // Don't throw, just log - we'll handle undefined in template
      }

      // Ensure all summary fields are numbers
      if (summary.totalSales !== undefined && (typeof summary.totalSales !== 'number' || isNaN(summary.totalSales))) {
        throw new BadRequestException('summary.totalSales must be a valid number');
      }
      if (summary.orderCount !== undefined && (typeof summary.orderCount !== 'number' || isNaN(summary.orderCount))) {
        throw new BadRequestException('summary.orderCount must be a valid number');
      }
      if (summary.averageOrder !== undefined && (typeof summary.averageOrder !== 'number' || isNaN(summary.averageOrder))) {
        throw new BadRequestException('summary.averageOrder must be a valid number');
      }
      if (summary.discounts !== undefined && (typeof summary.discounts !== 'number' || isNaN(summary.discounts))) {
        throw new BadRequestException('summary.discounts must be a valid number');
      }
      if (summary.cancellations !== undefined && (typeof summary.cancellations !== 'number' || isNaN(summary.cancellations))) {
        throw new BadRequestException('summary.cancellations must be a valid number');
      }
      if (summary.netProfit !== undefined && (typeof summary.netProfit !== 'number' || isNaN(summary.netProfit))) {
        throw new BadRequestException('summary.netProfit must be a valid number');
      }
    }

    // Validate orders structure (should be DailyAggregate[])
    if (Array.isArray(dto.data.orders)) {
      dto.data.orders.forEach((order: any, index: number) => {
        if (!order || typeof order !== 'object') {
          console.warn(`[Controller] Order ${index} is invalid:`, order);
          return;
        }

        // Check for old order fields (should not exist)
        const oldFields = ['openTime', 'closeTime', 'itemCount', 'totalAmount', 'status', 'employee'];
        const hasOldFields = oldFields.some(field => field in order);
        if (hasOldFields) {
          console.error(`[Controller] Order ${index} has old fields (OrderReport structure):`, Object.keys(order));
          throw new BadRequestException(`Order ${index} has invalid structure (contains old OrderReport fields)`);
        }

        // Validate DailyAggregate structure
        const requiredFields = ['id', 'date', 'day', 'totalSales', 'totalDiscounts', 'netProfit', 'orderCount', 'averageOrder'];
        const missingFields = requiredFields.filter(field => order[field] === undefined);
        
        if (missingFields.length > 0) {
          console.warn(`[Controller] Order ${index} missing DailyAggregate fields:`, missingFields);
        }

        // Ensure all numeric fields are valid numbers
        const numericFields = ['totalSales', 'totalDiscounts', 'netProfit', 'orderCount', 'averageOrder'];
        numericFields.forEach(field => {
          if (order[field] !== undefined) {
            const value = order[field];
            if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
              console.error(`[Controller] Order ${index}.${field} is invalid:`, value, 'type:', typeof value);
              throw new BadRequestException(`Order ${index}.${field} must be a valid number, got: ${value} (${typeof value})`);
            }
          }
        });
      });
    }

    console.log('[Controller] Data structure validation passed');
  }

  @Post('export/excel')
  async exportExcel(@Body() dto: ExportPdfDto, @Res() res: Response) {
    try {
      this.validateDto(dto);

      // Generate Excel
      const excelBuffer = await this.reportsService.generateExcel(dto);

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="report-${dto.type}-${dto.date}.xlsx"`,
      );
      res.setHeader('Content-Length', excelBuffer.length.toString());

      // Send Excel buffer
      res.status(HttpStatus.OK).send(excelBuffer);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to generate Excel: ${errorMessage}`);
    }
  }

  // Daily PDF endpoint removed - PDF export is ONLY available via IPC in Electron main process

}

