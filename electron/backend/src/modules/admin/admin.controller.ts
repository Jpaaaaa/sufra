import {
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly db: DatabaseService) {}

  @Post('clear-all-data')
  async clearAllData() {
    // Delete in order to respect foreign key constraints
    const tables = [
      'order_items',
      'orders',
      'items',
      'categories',
      'tables',
      'halls',
      'floors',
      'kitchens',
      'printer_settings',
    ];

    const errors: string[] = [];

    for (const table of tables) {
      try {
        this.db.run(`DELETE FROM ${table}`);
      } catch (err: any) {
        errors.push(`Failed to clear ${table}: ${err.message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join('; '));
    }

    return {
      success: true,
      message: 'All data cleared successfully',
      clearedTables: tables,
    };
  }

  @Post('clear-reports-data')
  async clearReportsData() {
    // First, get count of orders before deletion
    const countRow = await this.db.get('SELECT COUNT(*) as count FROM orders');
    const orderCount = countRow?.count || 0;

    // Clear order_items first (due to foreign key constraint)
    await this.db.run('DELETE FROM order_items');

    // Then clear all orders (regardless of status: pending, printed, completed, cancelled)
    await this.db.run('DELETE FROM orders');

    // Verify deletion
    const verifyRow = await this.db.get('SELECT COUNT(*) as count FROM orders');
    const remainingOrders = verifyRow?.count || 0;

    return {
      success: true,
      message: `Reports data cleared successfully. Deleted ${orderCount} orders.`,
      deletedOrders: orderCount,
      remainingOrders,
    };
  }
}
