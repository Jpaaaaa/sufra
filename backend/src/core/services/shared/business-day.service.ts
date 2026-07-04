import { DatabaseService } from '../../database/database.service';
import * as fs from 'fs';
import * as path from 'path';
import { getAppDataPath, ensureDirectoryExists } from '../../../utils/app-data-path';

export interface BusinessDay {
  id: number;
  start_at: string;
  end_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DailySummary {
  totalSales: number;
  totalDiscounts: number;
  netProfit: number;
  numberOfOrders: number;
  averageOrderValue: number;
  businessDayStart: string;
  businessDayEnd: string;
}

export class BusinessDayService {
  private readonly reportsHistoryDir: string;

  constructor(private readonly db: DatabaseService) {
    this.reportsHistoryDir = getAppDataPath('reports-history');

    ensureDirectoryExists(this.reportsHistoryDir);
    console.log('[BUSINESS-DAY] Reports history directory:', this.reportsHistoryDir);
  }

  async getCurrentBusinessDay(): Promise<BusinessDay | null> {
    const row = await this.db.get(
      'SELECT id, start_at, end_at, is_active, created_at FROM business_days WHERE is_active = 1 ORDER BY start_at DESC LIMIT 1',
    );
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      start_at: row.start_at,
      end_at: row.end_at,
      is_active: Boolean(row.is_active),
      created_at: row.created_at,
    };
  }

  async getBusinessDayStartTime(): Promise<string | null> {
    const businessDay = await this.getCurrentBusinessDay();
    return businessDay ? businessDay.start_at : null;
  }

  async startNewBusinessDay(username?: string): Promise<BusinessDay> {
    const currentDay = await this.getCurrentBusinessDay();
    if (!currentDay) {
      return await this.createNewBusinessDay();
    }

    try {
      const summary = await this.calculateDailySummary(currentDay.start_at);
      const resetTimestamp = new Date().toISOString();

      await this.writeDailySummaryToFile(summary, username || 'Unknown', resetTimestamp);
    } catch (summaryError) {
      console.error('Failed to calculate/save daily summary:', summaryError);
    }

    await this.db.run(
      "UPDATE business_days SET end_at = datetime('now'), is_active = 0 WHERE is_active = 1",
    );

    return await this.createNewBusinessDay();
  }

  private async createNewBusinessDay(): Promise<BusinessDay> {
    await this.db.run(
      "INSERT INTO business_days (start_at, is_active) VALUES (datetime('now'), 1)",
    );

    const id = await this.db.getLastInsertRowId();

    const row = await this.db.get(
      'SELECT id, start_at, end_at, is_active, created_at FROM business_days WHERE id = ?',
      [id],
    );

    if (!row) {
      throw new Error('Failed to retrieve created business day');
    }

    return {
      id: row.id,
      start_at: row.start_at,
      end_at: row.end_at,
      is_active: Boolean(row.is_active),
      created_at: row.created_at,
    };
  }

  async calculateDailySummary(businessDayStart: string): Promise<DailySummary> {
    const businessDayEnd = new Date().toISOString();

    const orders = await this.db.all(
      `SELECT id, total, discount, globalDiscount, created_at 
       FROM orders 
       WHERE created_at >= ? AND created_at < ? AND status = 'completed'`,
      [businessDayStart, businessDayEnd],
    );

    let totalSales = 0;
    let totalDiscounts = 0;
    const numberOfOrders = orders.length;

    orders.forEach((order: any) => {
      let discountAmount = 0;

      if (order.globalDiscount) {
        try {
          const globalDiscount = typeof order.globalDiscount === 'string'
            ? JSON.parse(order.globalDiscount)
            : order.globalDiscount;

          if (globalDiscount && globalDiscount.amount) {
            discountAmount += globalDiscount.amount;
          }
        } catch (e) {
          // Invalid JSON, skip
        }
      }

      if (order.discount) {
        discountAmount += order.discount;
      }

      const orderTotalBeforeDiscount = (order.total || 0) + discountAmount;
      totalSales += orderTotalBeforeDiscount;
      totalDiscounts += discountAmount;
    });

    const averageOrderValue = numberOfOrders > 0
      ? Math.round(totalSales / numberOfOrders)
      : 0;
    const netProfit = totalSales - totalDiscounts;

    return {
      totalSales,
      totalDiscounts,
      netProfit,
      numberOfOrders,
      averageOrderValue,
      businessDayStart,
      businessDayEnd,
    };
  }

  private async writeDailySummaryToFile(
    summary: DailySummary,
    username: string,
    timestamp: string,
  ): Promise<void> {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const filename = `daily-summary-${dateStr}.txt`;
    const filepath = path.join(this.reportsHistoryDir, filename);

    const content = `
=== تقرير يومي ===
التاريخ: ${dateStr}
المستخدم: ${username}
وقت الإغلاق: ${timestamp}

=== الملخص ===
إجمالي المبيعات: ${summary.totalSales.toLocaleString('ar-IQ')} د.ع
إجمالي الخصومات: ${summary.totalDiscounts.toLocaleString('ar-IQ')} د.ع
صافي الربح: ${summary.netProfit.toLocaleString('ar-IQ')} د.ع
عدد الطلبات: ${summary.numberOfOrders}
متوسط قيمة الطلب: ${summary.averageOrderValue.toLocaleString('ar-IQ')} د.ع

وقت بداية اليوم: ${summary.businessDayStart}
وقت نهاية اليوم: ${summary.businessDayEnd}
`;

    fs.writeFileSync(filepath, content, 'utf-8');
  }
}
