import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Res,
  HttpStatus,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { FinanceService } from './finance.service';
import { CreateRevenueDto } from './dto/create-revenue.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { CreateCashFlowDto } from './dto/create-cash-flow.dto';
import { ExportFinanceDto } from './dto/export-finance.dto';
import { generateFinancePDF } from './generate-finance-pdf';
import { generateFinanceExcel } from './generate-finance-excel';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('finance')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // ============ REVENUE ============

  @Get('revenue')
  async getRevenue(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'extra',
  ) {
    return this.financeService.getRevenues({ from, to, type });
  }

  @Post('revenue')
  async createRevenue(@Body() dto: CreateRevenueDto) {
    return this.financeService.createRevenue(dto);
  }

  @Post('revenue/sync')
  async syncRevenue(@Body() body: { date?: string }) {
    const date = body.date ?? new Date().toISOString().split('T')[0];
    return this.financeService.syncRevenueFromOrders(date);
  }

  // ============ EXPENSES ============

  @Get('expenses')
  async getExpenses(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('category') category?: string,
  ) {
    try {
      return await this.financeService.getExpenses({ from, to, category });
    } catch (error) {
      console.error('Error in getExpenses:', error);
      throw error;
    }
  }

  @Post('expenses')
  async createExpense(@Body() dto: CreateExpenseDto) {
    return this.financeService.createExpense(dto);
  }

  @Patch('expenses/:id')
  async updateExpense(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.financeService.updateExpense(id, dto);
  }

  @Delete('expenses/:id')
  async deleteExpense(@Param('id', ParseIntPipe) id: number) {
    await this.financeService.deleteExpense(id);
    return { success: true };
  }

  // ============ CASH FLOW ============

  @Get('cashflow')
  async getCashFlow(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: 'in' | 'out',
  ) {
    return this.financeService.getCashFlow({ from, to, type });
  }

  @Post('cashflow')
  async createCashFlow(@Body() dto: CreateCashFlowDto) {
    return this.financeService.createCashFlow(dto);
  }

  @Post('cashflow/sync')
  async syncCashFlow(@Body() body: { date?: string }) {
    const date = body.date ?? new Date().toISOString().split('T')[0];
    await this.financeService.syncCashFlowFromOrders(date);
    return { success: true };
  }

  // ============ PROFIT & LOSS ============

  @Get('profit')
  async getProfit(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    try {
      return await this.financeService.getProfitAndLoss({ from, to });
    } catch (error) {
      console.error('Error in getProfit:', error);
      throw error;
    }
  }

  // ============ EXPORT ============

  @Post('export/pdf')
  async exportPDF(@Body() dto: ExportFinanceDto, @Res() res: Response) {
    try {
      if (!dto.type || !dto.from || !dto.to || !dto.data) {
        throw new BadRequestException('Missing required fields: type, from, to, data');
      }

      const pdfBuffer = await generateFinancePDF(dto);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="finance-${dto.type}-${dto.from}-${dto.to}.pdf"`,
      );
      res.setHeader('Content-Length', pdfBuffer.length.toString());

      res.status(HttpStatus.OK).send(pdfBuffer);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to generate PDF: ${errorMessage}`);
    }
  }

  @Post('export/excel')
  async exportExcel(@Body() dto: ExportFinanceDto, @Res() res: Response) {
    try {
      if (!dto.type || !dto.from || !dto.to || !dto.data) {
        throw new BadRequestException('Missing required fields: type, from, to, data');
      }

      const excelBuffer = generateFinanceExcel(dto);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="finance-${dto.type}-${dto.from}-${dto.to}.xlsx"`,
      );
      res.setHeader('Content-Length', excelBuffer.length.toString());

      res.status(HttpStatus.OK).send(excelBuffer);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to generate Excel: ${errorMessage}`);
    }
  }

  @Get('daily/pdf')
  async getDailyPDF(@Res() res: Response) {
    try {
      // Use today's date (real calendar date, no business day)
      const today = new Date().toISOString().split('T')[0];
      const from = today;
      const to = today;

      const revenues = await this.financeService.getRevenues({ from, to, type: 'daily' });
      const expenses = await this.financeService.getExpenses({ from, to });
      const cashFlow = await this.financeService.getCashFlow({ from, to });
      const profit = await this.financeService.getProfitAndLoss({ from, to });

      const profitData = profit || {
        period: 'daily' as const,
        from,
        to,
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
      };

      const dto: ExportFinanceDto = {
        type: 'daily',
        from,
        to,
        data: {
          period: 'daily',
          from,
          to,
          revenues: Array.isArray(revenues) ? revenues : [],
          expenses: Array.isArray(expenses) ? expenses : [],
          cashFlow: Array.isArray(cashFlow) ? cashFlow : [],
          profit: profitData,
        },
      };

      const pdfBuffer = await generateFinancePDF(dto);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="finance-daily-${today}.pdf"`,
      );
      res.setHeader('Content-Length', pdfBuffer.length.toString());

      res.status(HttpStatus.OK).send(pdfBuffer);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to generate PDF: ${errorMessage}`);
    }
  }
}

