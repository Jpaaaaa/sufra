import { Controller, Post, Param, ParseIntPipe, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrintService } from './print.service';

@Controller('print')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'manager', 'cashier', 'waiter')
export class PrintController {
  constructor(private readonly printService: PrintService) {}

  @Post('order/:id')
  async getOrderPrintData(@Param('id', ParseIntPipe) id: number) {
    return this.printService.buildOrderPayload(id);
  }

  @Post('receipt')
  async getReceiptPrintData(
    @Body() body: {
      tableId: number;
      hallName: string;
      tableNumber: string | number;
      orders: any[];
      total: number;
      subtotal?: number;
    },
  ) {
    return this.printService.buildReceiptPayload(
      body.tableId,
      body.hallName,
      body.tableNumber,
      body.orders,
      body.total,
      body.subtotal,
    );
  }

  @Post('kitchen/:orderId')
  async getKitchenPrintData(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.printService.generateKitchenPrint(orderId);
  }
}

