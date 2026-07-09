import { DatabaseService } from '../../database/database.service';
import { removeAllArchived as dineInRemoveAllArchived } from '../orders/dine-in-orders.service';
import * as fs from 'fs';
import * as path from 'path';
import { getAppDataPath, ensureDirectoryExists } from '../../utils/app-data-path';

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

class BusinessDayService {
  private readonly reportsHistoryDir: string;

  constructor(private readonly db: DatabaseService) {
    // Use Electron's userData directory in production, or local data in dev
    this.reportsHistoryDir = getAppDataPath('reports-history');

    // Ensure directory exists
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

  /**
   * Ensure an active business day exists. If not, create one.
   * This should be called on app startup to prevent orphaned orders.
   */
  async ensureBusinessDayExists(): Promise<BusinessDay> {
    console.log('[BUSINESS-DAY] Ensuring business day exists...');
    
    // First, handle any orphaned orders from the past
    await this.createBusinessDaysForOrphanedOrders();
    
    // Check if there's an active business day
    const currentDay = await this.getCurrentBusinessDay();
    
    if (currentDay) {
      console.log('[BUSINESS-DAY] Active business day exists, ID:', currentDay.id);
      return currentDay;
    }
    
    // No active business day - create one
    console.log('[BUSINESS-DAY] No active business day, creating one...');
    return await this.createNewBusinessDay();
  }

  /**
   * Get business day by ID
   */
  async getBusinessDayById(id: number): Promise<BusinessDay | null> {
    const row = await this.db.get(
      'SELECT id, start_at, end_at, is_active, created_at FROM business_days WHERE id = ?',
      [id],
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

  /**
   * Get all business days (for debugging/admin)
   */
  async getAllBusinessDays(): Promise<BusinessDay[]> {
    const rows = await this.db.all(
      'SELECT id, start_at, end_at, is_active, created_at FROM business_days ORDER BY start_at DESC',
    );
    return rows.map((row: any) => ({
      id: row.id,
      start_at: row.start_at,
      end_at: row.end_at,
      is_active: Boolean(row.is_active),
      created_at: row.created_at,
    }));
  }

  async startNewBusinessDay(username?: string): Promise<BusinessDay> {
    try {
      console.log('[BUSINESS-DAY] Starting new business day, username:', username);
      
      // STEP 1: Check for orphaned orders (orders without any business day)
      // This handles the case where users sold items before ever starting a business day
      await this.createBusinessDaysForOrphanedOrders();
      
      // Get current business day before ending it
      const currentDay = await this.getCurrentBusinessDay();
      console.log('[BUSINESS-DAY] Current business day:', currentDay?.id || 'none');
      
      if (!currentDay) {
        // No current day, just create a new one
        console.log('[BUSINESS-DAY] No current day, creating new one');
        return await this.createNewBusinessDay();
      }

      // Calculate and save daily summary before ending the day
      try {
        console.log('[BUSINESS-DAY] Calculating daily summary...');
        const summary = await this.calculateDailySummary(currentDay.start_at);
        const resetTimestamp = new Date().toISOString();

        // Write summary to TXT file
        await this.writeDailySummaryToFile(summary, username || 'Unknown', resetTimestamp);

        // Store summary in database (optional - can be used for future features)
        // This is already done via the business_days table end_at timestamp

      } catch (summaryError: any) {
        console.error('[BUSINESS-DAY] Failed to calculate/save daily summary:', summaryError);
        console.error('[BUSINESS-DAY] Summary error stack:', summaryError?.stack);
        // Continue with reset even if summary fails
      }

      // End the current active day
      console.log('[BUSINESS-DAY] Ending current business day...');
      await this.db.run(
        "UPDATE business_days SET end_at = datetime('now'), is_active = 0 WHERE is_active = 1",
      );

      // Clear archived dine-in orders before starting new business day
      try {
        console.log('[BUSINESS-DAY] Clearing archived dine-in orders...');
        const deletedCount = await dineInRemoveAllArchived();
        console.log('[BUSINESS-DAY] Cleared', deletedCount, 'archived dine-in orders');
      } catch (clearError: any) {
        console.error('[BUSINESS-DAY] Failed to clear archived dine-in orders:', clearError);
        // Continue with business day reset even if clearing fails
      }

      // Then create a new active business day
      console.log('[BUSINESS-DAY] Creating new business day...');
      const newDay = await this.createNewBusinessDay();
      console.log('[BUSINESS-DAY] New business day created, ID:', newDay.id);
      return newDay;
    } catch (error: any) {
      console.error('[BUSINESS-DAY] Error in startNewBusinessDay:', error);
      console.error('[BUSINESS-DAY] Error message:', error.message);
      console.error('[BUSINESS-DAY] Error stack:', error.stack);
      throw error;
    }
  }

  /**
   * Find orders that exist before any business day and create retroactive business days for them.
   * This ensures historical sales data is never lost.
   */
  private async createBusinessDaysForOrphanedOrders(): Promise<void> {
    try {
      console.log('[BUSINESS-DAY] Checking for orphaned orders...');
      
      // Find the earliest business day start time
      const earliestBusinessDay = await this.db.get(
        'SELECT MIN(start_at) as earliest_start FROM business_days',
      );
      
      const earliestStart = earliestBusinessDay?.earliest_start;
      console.log('[BUSINESS-DAY] Earliest business day start:', earliestStart || 'none');
      
      // Find all unique dates with orders that are before the earliest business day
      // or if no business days exist at all
      let orphanedDatesQuery: string;
      let queryParams: any[] = [];
      
      if (earliestStart) {
        // Find orders before the earliest business day
        orphanedDatesQuery = `
          SELECT DISTINCT DATE(created_at) as order_date, 
                 MIN(created_at) as first_order, 
                 MAX(created_at) as last_order,
                 COUNT(*) as order_count
          FROM (
            SELECT created_at FROM orders WHERE created_at < ? AND status IN ('pending', 'printed', 'completed')
            UNION ALL
            SELECT created_at FROM pickup_orders WHERE created_at < ? AND status IN ('pending', 'printed', 'completed')
            UNION ALL
            SELECT created_at FROM dine_in_orders WHERE created_at < ? AND status IN ('pending', 'printed', 'completed')
            UNION ALL
            SELECT created_at FROM delivery_orders WHERE created_at < ? AND status IN ('pending', 'printed', 'completed')
          )
          GROUP BY DATE(created_at)
          ORDER BY order_date ASC
        `;
        queryParams = [earliestStart, earliestStart, earliestStart, earliestStart];
      } else {
        // No business days exist - find all orders grouped by date
        orphanedDatesQuery = `
          SELECT DISTINCT DATE(created_at) as order_date, 
                 MIN(created_at) as first_order, 
                 MAX(created_at) as last_order,
                 COUNT(*) as order_count
          FROM (
            SELECT created_at FROM orders WHERE status IN ('pending', 'printed', 'completed')
            UNION ALL
            SELECT created_at FROM pickup_orders WHERE status IN ('pending', 'printed', 'completed')
            UNION ALL
            SELECT created_at FROM dine_in_orders WHERE status IN ('pending', 'printed', 'completed')
            UNION ALL
            SELECT created_at FROM delivery_orders WHERE status IN ('pending', 'printed', 'completed')
          )
          GROUP BY DATE(created_at)
          ORDER BY order_date ASC
        `;
      }
      
      const orphanedDates = await this.db.all(orphanedDatesQuery, queryParams);
      
      if (!orphanedDates || orphanedDates.length === 0) {
        console.log('[BUSINESS-DAY] No orphaned orders found');
        return;
      }
      
      console.log('[BUSINESS-DAY] Found', orphanedDates.length, 'dates with orphaned orders');
      
      // Create a business day for each orphaned date
      for (const dateInfo of orphanedDates) {
        try {
          const orderDate = dateInfo.order_date;
          const firstOrder = dateInfo.first_order;
          const lastOrder = dateInfo.last_order;
          const orderCount = dateInfo.order_count;
          
          console.log(`[BUSINESS-DAY] Creating retroactive business day for ${orderDate} (${orderCount} orders)`);
          
          // Create business day starting at the first order time and ending after the last order
          // Use the first order time as start, and either the next day's first order or end of day as end
          const startAt = firstOrder;
          
          // Find if there's a next day's orders or use end of the day
          const nextDayStart = new Date(orderDate);
          nextDayStart.setDate(nextDayStart.getDate() + 1);
          nextDayStart.setHours(0, 0, 0, 0);
          const nextDayStartStr = nextDayStart.toISOString().replace('T', ' ').replace('Z', '');
          
          // End at the later of: last order time + 1 minute, or end of day
          const lastOrderDate = new Date(lastOrder);
          lastOrderDate.setMinutes(lastOrderDate.getMinutes() + 1);
          const endAt = lastOrderDate.toISOString().replace('T', ' ').replace('Z', '');
          
          // Insert the retroactive business day (not active)
          await this.db.run(
            `INSERT INTO business_days (start_at, end_at, is_active, created_at) 
             VALUES (?, ?, 0, datetime('now'))`,
            [startAt, endAt],
          );
          
          console.log(`[BUSINESS-DAY] Created retroactive business day: ${startAt} to ${endAt}`);
        } catch (dateError: any) {
          console.error(`[BUSINESS-DAY] Failed to create business day for ${dateInfo.order_date}:`, dateError);
          // Continue with other dates
        }
      }
      
      console.log('[BUSINESS-DAY] Finished creating retroactive business days');
    } catch (error: any) {
      console.error('[BUSINESS-DAY] Error creating business days for orphaned orders:', error);
      // Don't throw - this is a recovery mechanism, shouldn't block new business day creation
    }
  }

  private async createNewBusinessDay(): Promise<BusinessDay> {
    try {
      console.log('[BUSINESS-DAY] Inserting new business day into database...');
      const startTime = new Date().toISOString();
      
      await this.db.run(
        "INSERT INTO business_days (start_at, is_active) VALUES (datetime('now'), 1)",
      );

      let id = await this.db.getLastInsertRowId();
      console.log('[BUSINESS-DAY] New business day inserted, ID from last_insert_rowid:', id);

      // Fallback: if last_insert_rowid() returns 0, query for the most recent active business day
      if (!id || id === 0) {
        console.log('[BUSINESS-DAY] last_insert_rowid() returned 0, using fallback query...');
        const fallbackRow = await this.db.get(
          'SELECT id, start_at, end_at, is_active, created_at FROM business_days WHERE is_active = 1 ORDER BY id DESC LIMIT 1',
        );
        
        if (fallbackRow && fallbackRow.id) {
          id = fallbackRow.id;
          console.log('[BUSINESS-DAY] Fallback query found ID:', id);
        } else {
          throw new Error('Failed to get insert ID for new business day (both last_insert_rowid and fallback query failed)');
        }
      }

      // Return the newly created day
      const row = await this.db.get(
        'SELECT id, start_at, end_at, is_active, created_at FROM business_days WHERE id = ?',
        [id],
      );

      if (!row) {
        throw new Error(`Failed to retrieve created business day with ID ${id}`);
      }

      console.log('[BUSINESS-DAY] Retrieved new business day:', row);
      return {
        id: row.id,
        start_at: row.start_at,
        end_at: row.end_at,
        is_active: Boolean(row.is_active),
        created_at: row.created_at,
      };
    } catch (error: any) {
      console.error('[BUSINESS-DAY] Error in createNewBusinessDay:', error);
      console.error('[BUSINESS-DAY] Error message:', error.message);
      console.error('[BUSINESS-DAY] Error stack:', error.stack);
      throw error;
    }
  }

  async calculateDailySummary(businessDayStart: string): Promise<DailySummary> {
    const businessDayEnd = new Date().toISOString();

    // Get all completed orders for the current business day
    const orders = await this.db.all(
      `SELECT id, total, discount, globalDiscount, created_at 
       FROM orders 
       WHERE created_at >= ? AND created_at < ? AND status = 'completed'`,
      [businessDayStart, businessDayEnd],
    );

    let totalSales = 0;
    let totalDiscounts = 0;
    let numberOfOrders = orders.length;

    orders.forEach((order: any) => {
      // Calculate discount amount
      let discountAmount = 0;

      // Handle globalDiscount (stored as JSON string)
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

      // Also check the discount column (legacy)
      if (order.discount) {
        discountAmount += order.discount;
      }

      // Total before discount (assuming order.total is the final amount after discount)
      // We need to add back the discount to get the original amount
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
    try {
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0];
      const filename = `daily-summary-${dateStr}.txt`;
      const filepath = path.join(this.reportsHistoryDir, filename);

      // Ensure directory exists before writing
      ensureDirectoryExists(this.reportsHistoryDir);

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
      console.log('[BUSINESS-DAY] Daily summary written to:', filepath);
    } catch (error: any) {
      console.error('[BUSINESS-DAY] Failed to write daily summary file:', error);
      console.error('[BUSINESS-DAY] Reports history dir:', this.reportsHistoryDir);
      // Don't throw - allow business day reset to continue even if file write fails
    }
  }
}

let businessDayInstance: BusinessDayService | null = null;

export function initializeBusinessDay(db: DatabaseService): void {
  businessDayInstance = new BusinessDayService(db);
}

function requireBusinessDay(): BusinessDayService {
  if (!businessDayInstance) {
    throw new Error('Business day not initialized');
  }
  return businessDayInstance;
}

export function getCurrentBusinessDay(): ReturnType<
  BusinessDayService['getCurrentBusinessDay']
> {
  return requireBusinessDay().getCurrentBusinessDay();
}

export function getBusinessDayStartTime(): ReturnType<
  BusinessDayService['getBusinessDayStartTime']
> {
  return requireBusinessDay().getBusinessDayStartTime();
}

export function ensureBusinessDayExists(): ReturnType<
  BusinessDayService['ensureBusinessDayExists']
> {
  return requireBusinessDay().ensureBusinessDayExists();
}

export function getBusinessDayById(
  ...args: Parameters<BusinessDayService['getBusinessDayById']>
): ReturnType<BusinessDayService['getBusinessDayById']> {
  return requireBusinessDay().getBusinessDayById(...args);
}

export function getAllBusinessDays(): ReturnType<
  BusinessDayService['getAllBusinessDays']
> {
  return requireBusinessDay().getAllBusinessDays();
}

export function startNewBusinessDay(
  ...args: Parameters<BusinessDayService['startNewBusinessDay']>
): ReturnType<BusinessDayService['startNewBusinessDay']> {
  return requireBusinessDay().startNewBusinessDay(...args);
}

export function calculateDailySummary(
  ...args: Parameters<BusinessDayService['calculateDailySummary']>
): ReturnType<BusinessDayService['calculateDailySummary']> {
  return requireBusinessDay().calculateDailySummary(...args);
}
