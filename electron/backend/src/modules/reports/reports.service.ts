import { BadRequestException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';
import { getCurrentBusinessDateFromSettings } from '../settings/resolve-order-shift';
import { getShiftConfig } from '../settings/settings.service';
import { getShiftDefinitions } from '../settings/shift-definitions.service';
import { ExportPdfDto } from './dto/export-pdf.dto';
import { generateReportExcel } from './generate-report-excel';

class ReportsService {
  constructor(private readonly db: DatabaseService) {}

  /** Map query aliases to order_items.order_type values stored in DB */
  private orderTypeForItems(orderType: string): string {
    if (orderType === 'dine-in' || orderType === 'dine_in') return 'dine_in';
    return orderType;
  }

  /**
   * Get orders from all order tables by business_date range.
   */
  private async getOrdersByBusinessDateRange(dateStart: string, dateEnd: string): Promise<any[]> {
    const orders = await this.db.all(
      `SELECT id, total, globalDiscount, created_at, business_date, shift_definition_id, status, 'dine_in' as order_type, created_by_user_id
       FROM dine_in_orders 
       WHERE business_date >= ? AND business_date <= ? AND status IN ('completed', 'archived')
       UNION ALL
       SELECT id, total, globalDiscount, created_at, business_date, shift_definition_id, status, 'pickup' as order_type, created_by_user_id
       FROM pickup_orders 
       WHERE business_date >= ? AND business_date <= ? AND status IN ('completed', 'archived')
       UNION ALL
       SELECT id, total, globalDiscount, created_at, business_date, shift_definition_id, status, 'delivery' as order_type, created_by_user_id
       FROM delivery_orders 
       WHERE business_date >= ? AND business_date <= ? AND status IN ('completed', 'archived')`,
      [dateStart, dateEnd, dateStart, dateEnd, dateStart, dateEnd],
    );
    return orders || [];
  }

  private orderBusinessDateKey(order: { business_date?: string; created_at?: string }): string {
    if (order.business_date) return order.business_date;
    const d = new Date(order.created_at || '');
    return (
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-` +
      `${String(d.getDate()).padStart(2, '0')}`
    );
  }

  async getDailySummary(): Promise<{
    totalSales: number;
    ordersCount: number;
    occupiedTables: number;
    emptyTables: number;
    printerStatus: 'success' | 'error';
  }> {
    const today = await getCurrentBusinessDateFromSettings();
    const orders = await this.db.all(
      `SELECT total, globalDiscount 
       FROM dine_in_orders 
       WHERE business_date = ? AND status IN ('completed', 'archived')
       UNION ALL
       SELECT total, globalDiscount 
       FROM pickup_orders 
       WHERE business_date = ? AND status IN ('completed', 'archived')
       UNION ALL
       SELECT total, globalDiscount 
       FROM delivery_orders 
       WHERE business_date = ? AND status IN ('completed', 'archived')`,
      [today, today, today],
    );

    const shelfSales = await this.db.all(
      `SELECT (quantity * price) as total
       FROM shelf_sales
       WHERE business_date = ?`,
      [today],
    ) || [];

    // Calculate total sales and discounts using globalDiscount?.amount || 0
    let totalSales = 0;
    let ordersCount = orders.length;

    orders.forEach((order: any) => {
      let discountAmount = 0;

      // Use globalDiscount?.amount || 0
      if (order.globalDiscount) {
        try {
          const globalDiscount = typeof order.globalDiscount === 'string'
            ? JSON.parse(order.globalDiscount)
            : order.globalDiscount;
          discountAmount = globalDiscount?.amount || 0;
        } catch (e) {
          // Invalid JSON
          discountAmount = 0;
        }
      }

      // Total sales = NET (order.total) to match Finance
      totalSales += order.total || 0;
    });

    // Add shelf sales to total
    shelfSales.forEach((sale: any) => {
      totalSales += sale.total || 0;
    });

    // Get table counts (exclude virtual tables + orphan tables whose hall was deleted)
    const tableRows = await this.db.all(
      `SELECT t.id, COUNT(o.id) as orderCount
       FROM tables t
       INNER JOIN halls h ON t.hall_id = h.id
       LEFT JOIN dine_in_orders o ON t.id = o.table_id 
         AND o.status IN ('pending', 'printed')
       WHERE t.name NOT IN ('سفري', 'توصيل')
       GROUP BY t.id`,
    );

    const occupiedTables = tableRows.filter((t: any) => t.orderCount > 0).length;
    const emptyTables = tableRows.length - occupiedTables;

    // Check printer status (simple check - if any printer settings exist and are active)
    let printerStatus: 'success' | 'error' = 'success';
    try {
      const printerRow = await this.db.get(
        `SELECT COUNT(*) as count FROM printer_settings WHERE is_active = 1`,
      );
      printerStatus = printerRow?.count > 0 ? 'success' : 'error';
    } catch (printerErr) {
      // If error, assume success (printers might not be configured)
      printerStatus = 'success';
    }

    return {
      totalSales: totalSales,
      ordersCount: ordersCount,
      occupiedTables,
      emptyTables,
      printerStatus,
    };
  }

  // generatePDF method removed - PDF export is ONLY available via IPC in Electron main process

  async generateExcel(dto: ExportPdfDto): Promise<Buffer> {
    return generateReportExcel(dto);
  }

  async getReportData(
    period: 'daily' | 'weekly' | 'monthly' | 'yearly',
    dateStr: string,
  ): Promise<any> {
    const date = new Date(dateStr);

    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    // ============================================================
    // DATE-BASED REPORTS (real time - no shift)
    // ============================================================

    if (period === 'daily') {
      const orders = await this.db.all(
        `SELECT id, total, globalDiscount, created_at, business_date, shift_definition_id, status, 'dine_in' as order_type, created_by_user_id
         FROM dine_in_orders 
         WHERE business_date = ? AND status IN ('completed', 'archived')
         UNION ALL
         SELECT id, total, globalDiscount, created_at, business_date, shift_definition_id, status, 'pickup' as order_type, created_by_user_id
         FROM pickup_orders 
         WHERE business_date = ? AND status IN ('completed', 'archived')
         UNION ALL
         SELECT id, total, globalDiscount, created_at, business_date, shift_definition_id, status, 'delivery' as order_type, created_by_user_id
         FROM delivery_orders 
         WHERE business_date = ? AND status IN ('completed', 'archived')`,
        [dateStr, dateStr, dateStr],
      );
      const result = await this.processOrdersForReport(period, orders || [], dateStr);
      const config = await getShiftConfig();
      if (config.shift_mode === 'multi') {
        result.shiftBreakdown = await this.buildShiftBreakdown(orders || [], dateStr);
        result.shiftBreakdownByDay = await this.buildShiftBreakdownByDay(orders || []);
        result.shiftBreakdownTotals = result.shiftBreakdown;
      }
      return result;
    }

    if (period === 'weekly') {
      const weekEnd = new Date(`${dateStr}T12:00:00`);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      const pad = (n: number) => String(n).padStart(2, '0');
      const startStr = `${weekStart.getFullYear()}-${pad(weekStart.getMonth() + 1)}-${pad(weekStart.getDate())}`;
      const orders = await this.getOrdersByBusinessDateRange(startStr, dateStr);
      return this.processWeeklyFromOrders(orders, dateStr);
    }

    if (period === 'monthly') {
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const pad = (n: number) => String(n).padStart(2, '0');
      const startStr = `${monthStart.getFullYear()}-${pad(monthStart.getMonth() + 1)}-${pad(monthStart.getDate())}`;
      const endStr = `${monthEnd.getFullYear()}-${pad(monthEnd.getMonth() + 1)}-${pad(monthEnd.getDate())}`;
      const orders = await this.getOrdersByBusinessDateRange(startStr, endStr);
      const config = await getShiftConfig();
      if (config.shift_mode === 'multi') {
        return this.processMonthlyDaysFromOrders(orders, monthStart);
      }
      return this.processMonthlyFromOrders(orders, monthStart);
    }

    const yearStart = `${date.getFullYear()}-01-01`;
    const yearEnd = `${date.getFullYear()}-12-31`;
    const orders = await this.getOrdersByBusinessDateRange(yearStart, yearEnd);
    const config = await getShiftConfig();
    if (config.shift_mode === 'multi') {
      return this.processYearlyMultiFromOrders(orders, date.getFullYear());
    }
    return this.processYearlyFromOrders(orders, date.getFullYear());
  }

  private async processWeeklyBusinessDays(
    businessDays: any[],
  ): Promise<any> {
    if (businessDays.length === 0) {
      return {
        summary: {
          totalSales: 0,
          orderCount: 0,
          averageOrder: 0,
          discounts: 0,
          cancellations: 0,
          netProfit: 0,
        },
        graphData: [],
        itemsPerformance: [],
        unsoldMenuItems: [],
        employeeSummary: [],
        orders: [],
      };
    }

    // Process each business day and get its orders
    const businessDayData = await Promise.all(businessDays.map(async (businessDay) => {
      try {
        // For active business day, use CURRENT_TIMESTAMP as end, otherwise use end_at
        const endDate = businessDay.is_active === 1
          ? "CURRENT_TIMESTAMP"
          : (businessDay.end_at || "CURRENT_TIMESTAMP");

        // Query orders for this specific business day
        // Use parameterized query for start_at, but end_at might be CURRENT_TIMESTAMP
        const endDateCondition = endDate === "CURRENT_TIMESTAMP"
          ? "CURRENT_TIMESTAMP"
          : "?";

        const ordersQuery = `SELECT id, NULL as table_id, 'pickup' as order_type, status, total, globalDiscount,
              created_at, updated_at
           FROM pickup_orders
           WHERE status IN ('completed', 'archived')
             AND created_at >= ?
             AND created_at <= ${endDateCondition}
           UNION ALL
           SELECT id, table_id, 'dine-in' as order_type, status, total, globalDiscount,
              created_at, updated_at
           FROM dine_in_orders
           WHERE status IN ('completed', 'archived')
             AND created_at >= ?
             AND created_at <= ${endDateCondition}
           UNION ALL
           SELECT id, NULL as table_id, 'delivery' as order_type, status, total, globalDiscount,
              created_at, updated_at
           FROM delivery_orders
           WHERE status IN ('completed', 'archived')
             AND created_at >= ?
             AND created_at <= ${endDateCondition}`;

        const queryParams = endDate === "CURRENT_TIMESTAMP"
          ? [businessDay.start_at, businessDay.start_at, businessDay.start_at]
          : [businessDay.start_at, businessDay.end_at, businessDay.start_at, businessDay.end_at, businessDay.start_at, businessDay.end_at];

        console.log(`Querying orders for business day ${businessDay.id}:`, {
          start_at: businessDay.start_at,
          end_at: endDate,
          query: ordersQuery,
          params: queryParams,
        });

        const orders = await this.db.all(ordersQuery, queryParams);
        const ordersArray = orders || [];

        // Get shelf sales for this business day
        const shelfSalesEndDateCondition = endDate === "CURRENT_TIMESTAMP"
          ? "CURRENT_TIMESTAMP"
          : "?";
        
        const shelfSalesQueryParams = endDate === "CURRENT_TIMESTAMP"
          ? [businessDay.start_at]
          : [businessDay.start_at, businessDay.end_at];

        const shelfSales = await this.db.all(
          `SELECT id, shelf_item_id, quantity, price, created_at,
                  (quantity * price) as total
           FROM shelf_sales
           WHERE created_at >= ? 
             AND created_at < ${shelfSalesEndDateCondition}`,
          shelfSalesQueryParams,
        ) || [];

        // Calculate totals for this business day
        let totalSales = 0;
        let totalDiscounts = 0;

        ordersArray.forEach((order: any) => {
          let discountAmount = 0;
          if (order.globalDiscount) {
            try {
              const parsedDiscount = typeof order.globalDiscount === 'string'
                ? JSON.parse(order.globalDiscount)
                : order.globalDiscount;
              discountAmount = parsedDiscount?.amount || 0;
            } catch (e) {
              discountAmount = 0;
            }
          }
          totalSales += order.total || 0;
          totalDiscounts += discountAmount;
        });

        shelfSales.forEach((sale: any) => {
          totalSales += sale.total || 0;
        });

        const orderCount = ordersArray.length;
        const averageOrder = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;
        const netProfit = totalSales;

        // Format date from start_at - handle invalid dates
        let dateString = '';
        let dayName = '';
        try {
          const startDate = new Date(businessDay.start_at);
          if (!isNaN(startDate.getTime())) {
            dateString = startDate.toISOString().split('T')[0];
            // Format as numeric date (DD/MM/YYYY)
            const day = String(startDate.getDate()).padStart(2, '0');
            const month = String(startDate.getMonth() + 1);
            const year = startDate.getFullYear();
            dayName = `${day}/${month}/${year}`;
          } else {
            // Fallback: try to extract date from string
            const dateMatch = businessDay.start_at.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              dateString = dateMatch[1];
              // Try to parse the extracted date for dayName
              try {
                const fallbackDate = new Date(dateString);
                if (!isNaN(fallbackDate.getTime())) {
                  const day = String(fallbackDate.getDate()).padStart(2, '0');
                  const month = String(fallbackDate.getMonth() + 1);
                  const year = fallbackDate.getFullYear();
                  dayName = `${day}/${month}/${year}`;
                } else {
                  dayName = dateString; // Use dateString as fallback
                }
              } catch {
                dayName = dateString; // Use dateString as fallback
              }
            } else {
              dateString = businessDay.start_at ? businessDay.start_at.split(' ')[0] : '';
              dayName = dateString || '-';
            }
          }
        } catch (e) {
          console.error('Error parsing business day date:', businessDay.start_at, e);
          dateString = businessDay.start_at ? businessDay.start_at.split(' ')[0] : '';
          dayName = dateString || '-';
        }

        // CRITICAL: Return DailyAggregate structure (NOT OrderReport)
        // Required fields: id, date, day, totalSales, totalDiscounts, netProfit, orderCount, averageOrder
        // Ensure ALL numeric fields are explicitly set to 0 if undefined (same as daily reports)
        return {
          id: businessDay.id || 0,
          date: dateString || '-',
          day: dayName || '-',
          orderCount: Number(orderCount || 0),
          totalSales: Number(totalSales || 0),
          totalDiscounts: Number(totalDiscounts || 0),
          netProfit: Number(netProfit || 0),
          averageOrder: Number(averageOrder || 0),
        };
      } catch (err) {
        console.error(`Error fetching orders for business day ${businessDay.id}:`, err);
        // Don't reject, return empty data for this business day
        const startDate = new Date(businessDay.start_at);
        const dateString = startDate.toISOString().split('T')[0];
        // Format as numeric date (DD/MM/YYYY)
        const day = String(startDate.getDate()).padStart(2, '0');
        const month = String(startDate.getMonth() + 1);
        const year = startDate.getFullYear();
        const dayName = `${day}/${month}/${year}`;

        return {
          id: Number(businessDay.id || 0),
          date: dateString || '-',
          day: dayName || '-',
          totalSales: 0,
          totalDiscounts: 0,
          netProfit: 0,
          orderCount: 0,
          averageOrder: 0,
        };
      }
    }));

    // Filter out any null/undefined results, but keep business days even with no orders
    const validBusinessDayData = businessDayData.filter(day => {
      if (!day) return false;
      // Must have id and date at minimum
      return day.id !== undefined && day.date !== undefined && day.date !== '';
    });

    // Calculate overall summary - ensure all values are numbers (same as daily reports)
    let totalSales = 0;
    let totalDiscounts = 0;
    let totalOrders = 0;

    validBusinessDayData.forEach((day) => {
      totalSales += Number(day.totalSales || 0);
      totalDiscounts += Number(day.totalDiscounts || 0);
      totalOrders += Number(day.orderCount || 0);
    });

    const averageOrder = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;
    const netProfit = totalSales;

    // Ensure all summary fields are explicitly numbers (same as daily reports)
    const finalTotalSales = Number(totalSales || 0);
    const finalTotalDiscounts = Number(totalDiscounts || 0);
    const finalTotalOrders = Number(totalOrders || 0);
    const finalAverageOrder = Number(averageOrder || 0);
    const finalNetProfit = Number(netProfit || 0);

    // Generate graph data (simple daily aggregation) - ensure all values are numbers
    const graphData = validBusinessDayData.map((day) => ({
      label: day.day || day.date || '-',
      value: Number(day.totalSales || 0),
      timestamp: day.date || '-',
    }));

    // Verify the data structure is DailyAggregate, not OrderReport
    if (validBusinessDayData.length > 0) {
      const firstItem = validBusinessDayData[0];
      const hasOrderReportFields = 'openTime' in firstItem || 'closeTime' in firstItem || 'totalAmount' in firstItem;
      if (hasOrderReportFields) {
        console.error('ERROR: processWeeklyBusinessDays returning OrderReport structure!', firstItem);
      }
    }

    // CRITICAL: Verify we're returning DailyAggregate structure, not OrderReport
    const sampleItem = validBusinessDayData[0];
    if (sampleItem) {
      const hasOrderReportFields = 'openTime' in sampleItem || 'closeTime' in sampleItem || 'totalAmount' in sampleItem;
      if (hasOrderReportFields) {
        console.error('ERROR: processWeeklyBusinessDays is returning OrderReport structure!');
        console.error('Sample item:', JSON.stringify(sampleItem, null, 2));
        throw new Error('processWeeklyBusinessDays returned wrong data structure (OrderReport instead of DailyAggregate)');
      }
    }

    return {
      summary: {
        totalSales: finalTotalSales,
        orderCount: finalTotalOrders,
        averageOrder: finalAverageOrder,
        discounts: finalTotalDiscounts,
        cancellations: 0,
        netProfit: finalNetProfit,
      },
      graphData,
      itemsPerformance: [], // Can be calculated if needed
      unsoldMenuItems: [],
      employeeSummary: [],
      orders: validBusinessDayData, // Return only valid business days - MUST be DailyAggregate[]
    };
  }

  private async processMonthlyWeeks(
    businessDays: any[],
    monthStart: Date,
  ): Promise<any> {
    if (businessDays.length === 0) {
      return {
        summary: {
          totalSales: 0,
          orderCount: 0,
          averageOrder: 0,
          discounts: 0,
          cancellations: 0,
          netProfit: 0,
        },
        graphData: [],
        itemsPerformance: [],
        unsoldMenuItems: [],
        employeeSummary: [],
        orders: [],
      };
    }

    // Group business days into 4 weeks
    // Each week is 7 days from the month start
    const weeks: { start: Date; end: Date; businessDays: any[] }[] = [];
    for (let weekIndex = 0; weekIndex < 4; weekIndex++) {
      const weekStart = new Date(monthStart);
      weekStart.setDate(monthStart.getDate() + (weekIndex * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      
      // Find business days that fall within this week
      const weekBusinessDays = businessDays.filter((bd) => {
        const bdStart = new Date(bd.start_at);
        return bdStart >= weekStart && bdStart < weekEnd;
      });
      
      weeks.push({
        start: weekStart,
        end: weekEnd,
        businessDays: weekBusinessDays,
      });
    }

    // Process each week
    const weekPromises = weeks.map(async (week, weekIndex) => {
      if (week.businessDays.length === 0) {
        // No business days in this week - return empty week data
        const weekStartStr = week.start.toISOString().split('T')[0];
        // Format as numeric date (DD/MM/YYYY)
        const day = String(week.start.getDate()).padStart(2, '0');
        const month = String(week.start.getMonth() + 1);
        const year = week.start.getFullYear();
        const weekLabel = `${day}/${month}/${year}`;
        return {
          id: weekIndex + 1,
          date: weekStartStr,
          day: weekLabel,
          totalSales: 0,
          totalDiscounts: 0,
          netProfit: 0,
          orderCount: 0,
          averageOrder: 0,
        };
      }

      // Get all orders for business days in this week
      // Find the earliest start_at and latest end_at for all business days in this week
      let weekEarliestStart: string | null = null;
      let weekLatestEnd: string | null = null;
      let hasActiveDay = false;

      week.businessDays.forEach((bd) => {
        if (!weekEarliestStart || bd.start_at < weekEarliestStart) {
          weekEarliestStart = bd.start_at;
        }
        
        if (bd.is_active === 1) {
          hasActiveDay = true;
        } else if (bd.end_at) {
          if (!weekLatestEnd || bd.end_at > weekLatestEnd) {
            weekLatestEnd = bd.end_at;
          }
        }
      });

      // Build query - use week range for efficiency
      const weekStartDate = weekEarliestStart!;
      const weekEndDate = hasActiveDay 
        ? "CURRENT_TIMESTAMP" 
        : (weekLatestEnd || "CURRENT_TIMESTAMP");

      const endDateCondition = weekEndDate === "CURRENT_TIMESTAMP"
        ? "CURRENT_TIMESTAMP"
        : "?";

      const ordersQuery = `SELECT id, total, globalDiscount
         FROM pickup_orders
         WHERE status IN ('completed', 'archived')
           AND created_at >= ?
           AND created_at <= ${endDateCondition}
         UNION ALL
         SELECT id, total, globalDiscount
         FROM dine_in_orders
         WHERE status IN ('completed', 'archived')
           AND created_at >= ?
           AND created_at <= ${endDateCondition}
         UNION ALL
         SELECT id, total, globalDiscount
         FROM delivery_orders
         WHERE status IN ('completed', 'archived')
           AND created_at >= ?
           AND created_at <= ${endDateCondition}`;

      const queryParams = weekEndDate === "CURRENT_TIMESTAMP"
        ? [weekStartDate, weekStartDate, weekStartDate]
        : [weekStartDate, weekLatestEnd, weekStartDate, weekLatestEnd, weekStartDate, weekLatestEnd];

      try {
        const orders = await this.db.all(ordersQuery, queryParams) || [];
        
        // Get shelf sales for this week
        const shelfSalesEndDateCondition = weekEndDate === "CURRENT_TIMESTAMP"
          ? "CURRENT_TIMESTAMP"
          : "?";
        
        const shelfSalesQueryParams = weekEndDate === "CURRENT_TIMESTAMP"
          ? [weekStartDate]
          : [weekStartDate, weekLatestEnd];

        const shelfSales = await this.db.all(
          `SELECT id, shelf_item_id, quantity, price, created_at,
                  (quantity * price) as total
           FROM shelf_sales
           WHERE created_at >= ? 
             AND created_at < ${shelfSalesEndDateCondition}`,
          shelfSalesQueryParams,
        ) || [];
        
        // Calculate totals for this week
        let totalSales = 0;
        let totalDiscounts = 0;

        orders.forEach((order: any) => {
          let discountAmount = 0;
          if (order.globalDiscount) {
            try {
              const parsedDiscount = typeof order.globalDiscount === 'string'
                ? JSON.parse(order.globalDiscount)
                : order.globalDiscount;
              discountAmount = parsedDiscount?.amount || 0;
            } catch (e) {
              discountAmount = 0;
            }
          }
          totalSales += order.total || 0;
          totalDiscounts += discountAmount;
        });

        shelfSales.forEach((sale: any) => {
          totalSales += sale.total || 0;
        });

        const orderCount = orders.length;
        const averageOrder = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;
        const netProfit = totalSales;

        // Format week label as numeric date (DD/MM/YYYY)
        const weekStartStr = week.start.toISOString().split('T')[0];
        const day = String(week.start.getDate()).padStart(2, '0');
        const month = String(week.start.getMonth() + 1);
        const year = week.start.getFullYear();
        const weekLabel = `${day}/${month}/${year}`;

        return {
          id: weekIndex + 1,
          date: weekStartStr,
          day: weekLabel,
          totalSales,
          totalDiscounts,
          netProfit,
          orderCount,
          averageOrder,
        };
      } catch (err) {
        console.error(`Error fetching orders for week ${weekIndex + 1}:`, err);
        const weekStartStr = week.start.toISOString().split('T')[0];
        // Format as numeric date (DD/MM/YYYY)
        const day = String(week.start.getDate()).padStart(2, '0');
        const month = String(week.start.getMonth() + 1);
        const year = week.start.getFullYear();
        const weekLabel = `${day}/${month}/${year}`;
        return {
          id: weekIndex + 1,
          date: weekStartStr,
          day: weekLabel,
          totalSales: 0,
          totalDiscounts: 0,
          netProfit: 0,
          orderCount: 0,
          averageOrder: 0,
        };
      }
    });

    try {
      // Wait for all weeks to be processed
      const weekData = await Promise.all(weekPromises);
      
      // Filter out any null/undefined results
      const validWeekData = weekData.filter(week => week && week.id !== undefined);

      // Calculate overall summary
      let totalSales = 0;
      let totalDiscounts = 0;
      let totalOrders = 0;

      validWeekData.forEach((week) => {
        totalSales += week.totalSales || 0;
        totalDiscounts += week.totalDiscounts || 0;
        totalOrders += week.orderCount || 0;
      });

      const averageOrder = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;
      const netProfit = totalSales;

      // Generate graph data
      const graphData = validWeekData.map((week) => ({
        label: week.day || week.date,
        value: week.totalSales || 0,
        timestamp: week.date,
      }));

      // Verify we're returning DailyAggregate structure, not OrderReport
      const sampleItem = validWeekData[0];
      if (sampleItem) {
        const hasOrderReportFields = 'openTime' in sampleItem || 'closeTime' in sampleItem || 'totalAmount' in sampleItem;
        if (hasOrderReportFields) {
          console.error('ERROR: processMonthlyWeeks is returning OrderReport structure!');
          console.error('Sample item:', JSON.stringify(sampleItem, null, 2));
          throw new Error('processMonthlyWeeks returned wrong data structure (OrderReport instead of DailyAggregate)');
        }
      }

      return {
        summary: {
          totalSales,
          orderCount: totalOrders,
          averageOrder,
          discounts: totalDiscounts,
          cancellations: 0,
          netProfit,
        },
        graphData,
        itemsPerformance: [],
        unsoldMenuItems: [],
        employeeSummary: [],
        orders: validWeekData, // Return weekly aggregates - MUST be DailyAggregate[]
      };
    } catch (err) {
      console.error('Error processing monthly weeks:', err);
      // Return empty result instead of throwing to prevent frontend crash
      return {
        summary: {
          totalSales: 0,
          orderCount: 0,
          averageOrder: 0,
          discounts: 0,
          cancellations: 0,
          netProfit: 0,
        },
        graphData: [],
        itemsPerformance: [],
        unsoldMenuItems: [],
        employeeSummary: [],
        orders: [],
      };
    }
  }

  private async processYearlyMonths(
    businessDays: any[],
    year: number,
  ): Promise<any> {
    if (businessDays.length === 0) {
      return {
        summary: {
          totalSales: 0,
          orderCount: 0,
          averageOrder: 0,
          discounts: 0,
          cancellations: 0,
          netProfit: 0,
        },
        graphData: [],
        itemsPerformance: [],
        unsoldMenuItems: [],
        employeeSummary: [],
        orders: [],
      };
    }

    // Group business days into 12 months
    const months: { start: Date; end: Date; businessDays: any[] }[] = [];
    // Format dates as numbers only (DD/MM/YYYY)
    const formatNumericDate = (d: Date): string => {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1);
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const monthStart = new Date(year, monthIndex, 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(year, monthIndex + 1, 1);
      monthEnd.setHours(0, 0, 0, 0);
      
      // Find business days that fall within this month
      const monthBusinessDays = businessDays.filter((bd) => {
        const bdStart = new Date(bd.start_at);
        return bdStart >= monthStart && bdStart < monthEnd;
      });
      
      months.push({
        start: monthStart,
        end: monthEnd,
        businessDays: monthBusinessDays,
      });
    }

    // Process each month
    const monthPromises = months.map(async (month, monthIndex) => {
      if (month.businessDays.length === 0) {
        // No business days in this month - return empty month data
        const monthStartStr = month.start.toISOString().split('T')[0];
        return {
          id: monthIndex + 1,
          date: monthStartStr,
          day: formatNumericDate(month.start),
          totalSales: 0,
          totalDiscounts: 0,
          netProfit: 0,
          orderCount: 0,
          averageOrder: 0,
        };
      }

      // Get all orders for business days in this month
      // Find the earliest start_at and latest end_at for all business days in this month
      let monthEarliestStart: string | null = null;
      let monthLatestEnd: string | null = null;
      let hasActiveDay = false;

      month.businessDays.forEach((bd) => {
        if (!monthEarliestStart || bd.start_at < monthEarliestStart) {
          monthEarliestStart = bd.start_at;
        }
        
        if (bd.is_active === 1) {
          hasActiveDay = true;
        } else if (bd.end_at) {
          if (!monthLatestEnd || bd.end_at > monthLatestEnd) {
            monthLatestEnd = bd.end_at;
          }
        }
      });

      // Build query - use month range for efficiency
      const monthStartDate = monthEarliestStart!;
      const monthEndDate = hasActiveDay 
        ? "CURRENT_TIMESTAMP" 
        : (monthLatestEnd || "CURRENT_TIMESTAMP");

      const endDateCondition = monthEndDate === "CURRENT_TIMESTAMP"
        ? "CURRENT_TIMESTAMP"
        : "?";

      const ordersQuery = `SELECT id, total, globalDiscount
         FROM pickup_orders
         WHERE status IN ('completed', 'archived')
           AND created_at >= ?
           AND created_at <= ${endDateCondition}
         UNION ALL
         SELECT id, total, globalDiscount
         FROM dine_in_orders
         WHERE status IN ('completed', 'archived')
           AND created_at >= ?
           AND created_at <= ${endDateCondition}
         UNION ALL
         SELECT id, total, globalDiscount
         FROM delivery_orders
         WHERE status IN ('completed', 'archived')
           AND created_at >= ?
           AND created_at <= ${endDateCondition}`;

      const queryParams = monthEndDate === "CURRENT_TIMESTAMP"
        ? [monthStartDate, monthStartDate, monthStartDate]
        : [monthStartDate, monthLatestEnd, monthStartDate, monthLatestEnd, monthStartDate, monthLatestEnd];

      try {
        const orders = await this.db.all(ordersQuery, queryParams) || [];
        
        // Get shelf sales for this month
        const shelfSalesEndDateCondition = monthEndDate === "CURRENT_TIMESTAMP"
          ? "CURRENT_TIMESTAMP"
          : "?";
        
        const shelfSalesQueryParams = monthEndDate === "CURRENT_TIMESTAMP"
          ? [monthStartDate]
          : [monthStartDate, monthLatestEnd];

        const shelfSales = await this.db.all(
          `SELECT id, shelf_item_id, quantity, price, created_at,
                  (quantity * price) as total
           FROM shelf_sales
           WHERE created_at >= ? 
             AND created_at < ${shelfSalesEndDateCondition}`,
          shelfSalesQueryParams,
        ) || [];
        
        // Calculate totals for this month
        let totalSales = 0;
        let totalDiscounts = 0;

        orders.forEach((order: any) => {
          let discountAmount = 0;
          if (order.globalDiscount) {
            try {
              const parsedDiscount = typeof order.globalDiscount === 'string'
                ? JSON.parse(order.globalDiscount)
                : order.globalDiscount;
              discountAmount = parsedDiscount?.amount || 0;
            } catch (e) {
              discountAmount = 0;
            }
          }
          totalSales += order.total || 0;
          totalDiscounts += discountAmount;
        });

        shelfSales.forEach((sale: any) => {
          totalSales += sale.total || 0;
        });

        const orderCount = orders.length;
        const averageOrder = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;
        const netProfit = totalSales;

        // Format month label
        const monthStartStr = month.start.toISOString().split('T')[0];
        const monthLabel = formatNumericDate(month.start);

        return {
          id: monthIndex + 1,
          date: monthStartStr,
          day: monthLabel,
          totalSales,
          totalDiscounts,
          netProfit,
          orderCount,
          averageOrder,
        };
      } catch (err) {
        console.error(`Error fetching orders for month ${monthIndex + 1}:`, err);
        const monthStartStr = month.start.toISOString().split('T')[0];
        return {
          id: monthIndex + 1,
          date: monthStartStr,
          day: formatNumericDate(month.start),
          totalSales: 0,
          totalDiscounts: 0,
          netProfit: 0,
          orderCount: 0,
          averageOrder: 0,
        };
      }
    });

    try {
      // Wait for all months to be processed
      const monthData = await Promise.all(monthPromises);
      
      // Filter out any null/undefined results
      const validMonthData = monthData.filter(month => month && month.id !== undefined);

      // Calculate overall summary
      let totalSales = 0;
      let totalDiscounts = 0;
      let totalOrders = 0;

      validMonthData.forEach((month) => {
        totalSales += month.totalSales || 0;
        totalDiscounts += month.totalDiscounts || 0;
        totalOrders += month.orderCount || 0;
      });

      const averageOrder = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;
      const netProfit = totalSales;

      // Generate graph data
      const graphData = validMonthData.map((month) => ({
        label: month.day || month.date,
        value: month.totalSales || 0,
        timestamp: month.date,
      }));

      // Verify we're returning DailyAggregate structure, not OrderReport
      const sampleItem = validMonthData[0];
      if (sampleItem) {
        const hasOrderReportFields = 'openTime' in sampleItem || 'closeTime' in sampleItem || 'totalAmount' in sampleItem;
        if (hasOrderReportFields) {
          console.error('ERROR: processYearlyMonths is returning OrderReport structure!');
          console.error('Sample item:', JSON.stringify(sampleItem, null, 2));
          throw new Error('processYearlyMonths returned wrong data structure (OrderReport instead of DailyAggregate)');
        }
      }

      return {
        summary: {
          totalSales,
          orderCount: totalOrders,
          averageOrder,
          discounts: totalDiscounts,
          cancellations: 0,
          netProfit,
        },
        graphData,
        itemsPerformance: [],
        unsoldMenuItems: [],
        employeeSummary: [],
        orders: validMonthData, // Return monthly aggregates - MUST be DailyAggregate[]
      };
    } catch (err) {
      console.error('Error processing yearly months:', err);
      // Return empty result instead of throwing to prevent frontend crash
      return {
        summary: {
          totalSales: 0,
          orderCount: 0,
          averageOrder: 0,
          discounts: 0,
          cancellations: 0,
          netProfit: 0,
        },
        graphData: [],
        itemsPerformance: [],
        unsoldMenuItems: [],
        employeeSummary: [],
        orders: [],
      };
    }
  }

  private async fetchOrdersAndProcess(
    period: 'daily' | 'weekly' | 'monthly' | 'yearly',
    startDate: string,
    endDate: string,
  ): Promise<any> {
    // Weekly reports should never reach here - they use processWeeklyBusinessDays instead
    if (period === 'weekly') {
      console.error('ERROR: fetchOrdersAndProcess called for weekly report! This should not happen.');
      throw new Error('Weekly reports must use processWeeklyBusinessDays, not fetchOrdersAndProcess');
    }
    
    // Validate startDate
    if (!startDate) {
      console.error('[REPORTS] fetchOrdersAndProcess: startDate is undefined or null');
      return {
        summary: {
          totalSales: 0,
          orderCount: 0,
          averageOrder: 0,
          discounts: 0,
          cancellations: 0,
          netProfit: 0,
        },
        graphData: [],
        itemsPerformance: [],
        unsoldMenuItems: [],
        employeeSummary: [],
        orders: [],
        ...(period === 'daily' ? {
          cashDrawer: {
            openingBalance: 0,
            cashIn: 0,
            cashOut: 0,
            closingBalance: 0,
            variance: 0,
          },
        } : {}),
      };
    }
    
    // Build query with proper date handling
    // Use parameterized queries for both startDate and endDate
    const endDateCondition = endDate === "CURRENT_TIMESTAMP" 
      ? "CURRENT_TIMESTAMP" 
      : "?";
    
    // Prepare query parameters - need startDate and endDate for each UNION query
    const queryParams = endDate === "CURRENT_TIMESTAMP"
      ? [startDate, startDate, startDate]
      : [startDate, endDate, startDate, endDate, startDate, endDate];

    console.log('[REPORTS] fetchOrdersAndProcess - query params:', {
      period,
      startDate,
      endDate,
      endDateCondition,
      queryParamsCount: queryParams.length,
    });

    // Get shelf sales (direct sales, not through orders)
    // IMPORTANT: Uses the same date range as orders (business day range for daily reports, calendar dates for others)
    const shelfSalesEndDateCondition = endDate === "CURRENT_TIMESTAMP" 
      ? "CURRENT_TIMESTAMP" 
      : "?";
    
    const shelfSalesQueryParams = endDate === "CURRENT_TIMESTAMP"
      ? [startDate]
      : [startDate, endDate];

    const shelfSales = await this.db.all(
      `SELECT id, shelf_item_id, quantity, price, created_at,
              (quantity * price) as total
       FROM shelf_sales
       WHERE created_at >= ? 
         AND created_at < ${shelfSalesEndDateCondition}`,
      shelfSalesQueryParams,
    ) || [];

    console.log('[REPORTS] fetchOrdersAndProcess - shelf sales found:', shelfSales.length, 'using date range:', startDate, 'to', endDate);

    // Get all orders from pickup, dine-in, and delivery tables
    const orders = await this.db.all(
      `SELECT id, NULL as table_id, 'pickup' as order_type, status, total, globalDiscount,
              created_at, updated_at, NULL as customer_name, NULL as customer_phone, NULL as customer_location,
              created_by_user_id
       FROM pickup_orders
       WHERE status IN ('completed', 'archived')
         AND created_at >= ? 
         AND created_at < ${endDateCondition}
       UNION ALL
       SELECT id, table_id, 'dine-in' as order_type, status, total, globalDiscount,
              created_at, updated_at, NULL as customer_name, NULL as customer_phone, NULL as customer_location,
              created_by_user_id
       FROM dine_in_orders
       WHERE status IN ('completed', 'archived')
         AND created_at >= ? 
         AND created_at < ${endDateCondition}
       UNION ALL
       SELECT id, NULL as table_id, 'delivery' as order_type, status, total, globalDiscount,
              created_at, updated_at, customer_name, customer_phone, customer_address as customer_location,
              created_by_user_id
       FROM delivery_orders
       WHERE status IN ('completed', 'archived')
         AND created_at >= ? 
         AND created_at < ${endDateCondition}`,
      queryParams,
    ) || [];

    console.log('[REPORTS] fetchOrdersAndProcess - orders found:', orders.length);

    // Return empty report if no orders and no shelf sales found
    if (orders.length === 0 && shelfSales.length === 0) {
      // Return empty report structure
      return {
        summary: {
          totalSales: 0,
          orderCount: 0,
          averageOrder: 0,
          discounts: 0,
          cancellations: 0,
          netProfit: 0,
        },
        graphData: [],
        itemsPerformance: [],
        unsoldMenuItems: [],
        employeeSummary: [],
        orders: [],
        ...(period === 'daily' ? {
          cashDrawer: {
            openingBalance: 0,
            cashIn: 0,
            cashOut: 0,
            closingBalance: 0,
            variance: 0,
          },
        } : {}),
      };
    }

    const orderIds = orders.map((o) => o.id);

    // Get order items (handle empty order list)
    // Only return empty if there are no orders AND no shelf sales
    if (orderIds.length === 0 && shelfSales.length === 0) {
      return {
        summary: {
          totalSales: 0,
          orderCount: 0,
          averageOrder: 0,
          discounts: 0,
          cancellations: 0,
          netProfit: 0,
        },
        graphData: [],
        itemsPerformance: [],
        unsoldMenuItems: [],
        employeeSummary: [],
        orders: [],
        ...(period === 'daily' ? {
          cashDrawer: {
            openingBalance: 0,
            cashIn: 0,
            cashOut: 0,
            closingBalance: 0,
            variance: 0,
          },
        } : {}),
      };
    }

    // For weekly reports with no orders, use empty items array
    // Need to match order_items with orders by order_id AND order_type
    // Create a map of order_id -> order_type from the orders we fetched
    const orderTypeMap = new Map<number, string>();
    orders.forEach((o: any) => {
      orderTypeMap.set(o.id, this.orderTypeForItems(o.order_type || 'dine_in'));
    });
    
    // Build query that filters by both order_id and order_type
    let items: any[] = [];
    if (orderIds.length > 0) {
      // Group orders by type and query separately to ensure correct filtering
      const ordersByType = new Map<string, number[]>();
      orders.forEach((o: any) => {
        const type = this.orderTypeForItems(o.order_type || 'dine_in');
        if (!ordersByType.has(type)) {
          ordersByType.set(type, []);
        }
        ordersByType.get(type)!.push(o.id);
      });
      
      // Query items for each order type separately
      const itemPromises = Array.from(ordersByType.entries()).map(async ([orderType, ids]) => {
        if (ids.length === 0) return [];
        const placeholders = ids.map(() => '?').join(',');
        return await this.db.all(
          `SELECT oi.id, oi.order_id, oi.item_id, oi.item_name, oi.quantity, oi.price, oi.kitchen_id
           FROM order_items oi
           WHERE oi.order_id IN (${placeholders}) AND oi.order_type = ?`,
          [...ids, orderType],
        ) || [];
      });
      
      const itemsArrays = await Promise.all(itemPromises);
      items = itemsArrays.flat();
    }

    // Calculate total sales (NET - matches Finance) and discounts for display
    let totalSales = 0;
    let totalDiscounts = 0;

    orders.forEach((order: any) => {
      let discountAmount = 0;
      if (order.globalDiscount) {
        try {
          const globalDiscount = typeof order.globalDiscount === 'string' 
            ? JSON.parse(order.globalDiscount) 
            : order.globalDiscount;
          discountAmount = globalDiscount?.amount || 0;
        } catch (e) {
          discountAmount = 0;
        }
      }
      // order.total is NET (after discount) - use directly to match Finance
      totalSales += order.total || 0;
      totalDiscounts += discountAmount;
    });

    // Add shelf sales (no discounts for direct shelf sales)
    shelfSales.forEach((sale: any) => {
      totalSales += sale.total || 0;
    });

    const orderCount = orders.length;
    const averageOrder = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;
    const cancellations = orders.filter((o) => o.status === 'cancelled').length;
    const netProfit = totalSales; // totalSales is already NET

    // Calculate items performance (regular items + shelf items)
    const itemsMap = new Map<number, { name: string; quantity: number; totalSales: number; isShelfItem: boolean }>();
    
    // Process regular items
    items.forEach((item) => {
      const key = item.item_id;
      const existing = itemsMap.get(key) || { name: item.item_name, quantity: 0, totalSales: 0, isShelfItem: false };
      existing.quantity += item.quantity;
      existing.totalSales += item.price * item.quantity;
      itemsMap.set(key, existing);
    });

    // Process shelf items from order_items (shelf items sold through orders)
    // IMPORTANT: Uses the same date range as orders (business day range for daily reports)
    // Need to query from all order tables
    const shelfEndDateCondition = endDate === "CURRENT_TIMESTAMP" 
      ? "CURRENT_TIMESTAMP" 
      : "?";
    
    const shelfItemsQuery = `SELECT oi.shelf_item_id, oi.item_name, oi.quantity, oi.price
      FROM order_items oi
      INNER JOIN (
        SELECT id FROM pickup_orders WHERE status IN ('completed', 'archived')
          AND created_at >= ? AND created_at <= ${shelfEndDateCondition}
        UNION ALL
        SELECT id FROM dine_in_orders WHERE status IN ('completed', 'archived')
          AND created_at >= ? AND created_at <= ${shelfEndDateCondition}
        UNION ALL
        SELECT id FROM delivery_orders WHERE status IN ('completed', 'archived')
          AND created_at >= ? AND created_at <= ${shelfEndDateCondition}
      ) o ON oi.order_id = o.id
      WHERE oi.shelf_item_id IS NOT NULL`;
    
    let shelfItems: any[] = [];
    try {
      const shelfQueryParams = endDate === "CURRENT_TIMESTAMP"
        ? [startDate, startDate, startDate]
        : [startDate, endDate, startDate, endDate, startDate, endDate];
      
      shelfItems = await this.db.all(shelfItemsQuery, shelfQueryParams) || [];
    } catch (shelfErr) {
      console.error('Error fetching shelf items:', shelfErr);
      // Continue without shelf items
    }

    shelfItems.forEach((shelfItem) => {
      const key = shelfItem.shelf_item_id + 1000000; // Use high ID to avoid conflicts
      const existing = itemsMap.get(key) || { 
        name: shelfItem.item_name, 
        quantity: 0, 
        totalSales: 0, 
        isShelfItem: true 
      };
      existing.quantity += shelfItem.quantity;
      existing.totalSales += shelfItem.price * shelfItem.quantity;
      itemsMap.set(key, existing);
    });

    // Process direct shelf sales (not through orders)
    // Get shelf item names for shelf sales
    const shelfItemIds = [...new Set(shelfSales.map((s: any) => s.shelf_item_id))];
    let shelfItemNames: Map<number, string> = new Map();
    if (shelfItemIds.length > 0) {
      const placeholders = shelfItemIds.map(() => '?').join(',');
      const shelfItemsData = await this.db.all(
        `SELECT id, name FROM shelf_items WHERE id IN (${placeholders})`,
        shelfItemIds,
      ) || [];
      shelfItemsData.forEach((item: any) => {
        shelfItemNames.set(item.id, item.name);
      });
    }

    shelfSales.forEach((sale: any) => {
      const shelfItemName = shelfItemNames.get(sale.shelf_item_id) || 'Unknown Shelf Item';
      const key = sale.shelf_item_id + 1000000; // Use high ID to avoid conflicts
      const existing = itemsMap.get(key) || { 
        name: shelfItemName, 
        quantity: 0, 
        totalSales: 0, 
        isShelfItem: true 
      };
      existing.quantity += sale.quantity;
      existing.totalSales += sale.total || (sale.price * sale.quantity);
      itemsMap.set(key, existing);
    });
    
    // Generate itemsPerformance from combined map
    const itemsPerformance = Array.from(itemsMap.entries()).map(([id, data], index) => {
      const movement = data.totalSales > 3000 ? 'high' : data.totalSales > 1500 ? 'medium' : 'low';
      return {
        id: id || index + 1,
        name: data.isShelfItem ? `[رفوف] ${data.name}` : data.name,
        quantitySold: data.quantity,
        totalSales: data.totalSales,
        movementStatus: movement,
      };
    }).sort((a, b) => b.totalSales - a.totalSales);

    const soldMenuItemIds = Array.from(itemsMap.entries())
      .filter(([, data]) => !data.isShelfItem)
      .map(([id]) => id);
    const unsoldMenuItems = await this.getUnsoldMenuItems(soldMenuItemIds, orders.length);

    // Generate graph data based on period
    const graphData = this.generateGraphData(period, startDate, endDate, orders, shelfSales);

    // Format orders for report (daily, monthly, yearly)
    // Note: Weekly reports should never reach here - they use processWeeklyBusinessDays instead
    // CRITICAL: For daily reports, return DailyAggregate structure, not individual orders
    let ordersReport: any[];
    
    if (period === 'daily') {
      // For daily reports, return a single DailyAggregate object in an array
      const reportDate = new Date(startDate);
      const dateString = reportDate.toISOString().split('T')[0];
      // Format as numeric date (DD/MM/YYYY)
      const day = String(reportDate.getDate()).padStart(2, '0');
      const month = String(reportDate.getMonth() + 1);
      const year = reportDate.getFullYear();
      const dayName = `${day}/${month}/${year}`;
      
      ordersReport = [{
        id: 1,
        date: dateString,
        day: dayName,
        totalSales,
        totalDiscounts: totalDiscounts,
        netProfit: netProfit,
        orderCount,
        averageOrder: averageOrder,
      }];
    } else {
      // For monthly/yearly, we still need to aggregate by day/week/month
      // But for now, return empty array since monthly/yearly should use different methods
      // This should not be reached for monthly/yearly as they use different processing
      ordersReport = [];
    }

    const employeeSummary = await this.buildEmployeeSummaryFromOrders(orders);

    // Cash drawer for daily reports
    let cashDrawer: any = undefined;
    if (period === 'daily') {
      // Calculate cash drawer from completed orders (use net profit after discounts)
      const cashIn = netProfit; // Use net profit (after discounts) as cash in
      const cashOut = 0; // Expenses not tracked in orders
      const openingBalance = 0; // Not tracked yet
      const closingBalance = openingBalance + cashIn - cashOut;
      cashDrawer = {
        openingBalance,
        cashIn,
        cashOut,
        closingBalance,
        variance: 0,
      };
    }

    return {
      summary: {
        totalSales,
        orderCount,
        averageOrder,
        discounts: totalDiscounts,
        cancellations,
        netProfit: netProfit,
      },
      graphData,
      itemsPerformance,
      unsoldMenuItems,
      employeeSummary,
      orders: ordersReport,
      ...(cashDrawer ? { cashDrawer } : {}),
    };
  }

  private generateGraphData(
    period: 'daily' | 'weekly' | 'monthly' | 'yearly',
    startDate: string,
    endDate: string,
    orders: any[],
    shelfSales: any[] = [],
  ): { label: string; value: number; timestamp: string }[] {
    const data: { label: string; value: number; timestamp: string }[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (period === 'daily') {
      // Hourly data (24 hours)
      for (let i = 0; i < 24; i++) {
        const hourStart = new Date(start);
        hourStart.setHours(i, 0, 0, 0);
        const hourEnd = new Date(hourStart);
        hourEnd.setHours(i + 1, 0, 0, 0);
        
        const hourOrders = orders.filter((o) => {
          const orderDate = new Date(o.created_at);
          return orderDate >= hourStart && orderDate < hourEnd;
        });
        
        const hourShelfSales = shelfSales.filter((s: any) => {
          const saleDate = new Date(s.created_at);
          return saleDate >= hourStart && saleDate < hourEnd;
        });
        
        // Graph uses NET sales (order.total) to match Finance
        const ordersValue = hourOrders.reduce((sum, o: any) => sum + (o.total || 0), 0);
        
        const shelfSalesValue = hourShelfSales.reduce((sum, s: any) => {
          return sum + (s.total || (s.price * s.quantity) || 0);
        }, 0);
        
        const value = ordersValue + shelfSalesValue;
        data.push({
          label: `${String(i).padStart(2, '0')}:00`,
          value,
          timestamp: hourStart.toISOString(),
        });
      }
    } else if (period === 'weekly') {
      // Daily data (7 days)
      for (let i = 0; i < 7; i++) {
        const dayStart = new Date(start);
        dayStart.setDate(start.getDate() + i);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayStart.getDate() + 1);
        
        const dayOrders = orders.filter((o) => {
          const orderDate = new Date(o.created_at);
          return orderDate >= dayStart && orderDate < dayEnd;
        });
        
        const dayShelfSales = shelfSales.filter((s: any) => {
          const saleDate = new Date(s.created_at);
          return saleDate >= dayStart && saleDate < dayEnd;
        });
        
        // Graph uses NET sales (order.total) to match Finance
        const ordersValue = dayOrders.reduce((sum, o: any) => sum + (o.total || 0), 0);
        
        const shelfSalesValue = dayShelfSales.reduce((sum, s: any) => {
          return sum + (s.total || (s.price * s.quantity) || 0);
        }, 0);
        
        const value = ordersValue + shelfSalesValue;
        
        // Format as numeric date (DD/MM/YYYY)
        const day = String(dayStart.getDate()).padStart(2, '0');
        const month = String(dayStart.getMonth() + 1);
        const year = dayStart.getFullYear();
        const label = `${day}/${month}/${year}`;
        
        data.push({
          label: label,
          value,
          timestamp: dayStart.toISOString(),
        });
      }
    } else if (period === 'monthly') {
      // Weekly aggregates (4-5 weeks)
      const weeksInMonth = Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
      for (let i = 0; i < weeksInMonth; i++) {
        const weekStart = new Date(start);
        weekStart.setDate(start.getDate() + i * 7);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        
        const weekOrders = orders.filter((o) => {
          const orderDate = new Date(o.created_at);
          return orderDate >= weekStart && orderDate < weekEnd;
        });
        
        const weekShelfSales = shelfSales.filter((s: any) => {
          const saleDate = new Date(s.created_at);
          return saleDate >= weekStart && saleDate < weekEnd;
        });
        
        // Graph uses NET sales (order.total) to match Finance
        const ordersValue = weekOrders.reduce((sum, o: any) => sum + (o.total || 0), 0);
        
        const shelfSalesValue = weekShelfSales.reduce((sum, s: any) => {
          return sum + (s.total || (s.price * s.quantity) || 0);
        }, 0);
        
        const value = ordersValue + shelfSalesValue;
        
        // Format as numeric date (DD/MM/YYYY)
        const day = String(weekStart.getDate()).padStart(2, '0');
        const month = String(weekStart.getMonth() + 1);
        const year = weekStart.getFullYear();
        const label = `${day}/${month}/${year}`;
        
        data.push({
          label: label,
          value,
          timestamp: weekStart.toISOString(),
        });
      }
    } else {
      // Yearly - Monthly aggregates (12 months)
      // Format dates as numbers only (DD/MM/YYYY)
      const formatNumericDate = (d: Date): string => {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1);
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      };
      
      for (let i = 0; i < 12; i++) {
        const monthStart = new Date(start.getFullYear(), i, 1);
        const monthEnd = new Date(start.getFullYear(), i + 1, 1);
        
        const monthOrders = orders.filter((o) => {
          const orderDate = new Date(o.created_at);
          return orderDate >= monthStart && orderDate < monthEnd;
        });
        
        const monthShelfSales = shelfSales.filter((s: any) => {
          const saleDate = new Date(s.created_at);
          return saleDate >= monthStart && saleDate < monthEnd;
        });
        
        // Graph uses NET sales (order.total) to match Finance
        const ordersValue = monthOrders.reduce((sum, o: any) => sum + (o.total || 0), 0);
        
        const shelfSalesValue = monthShelfSales.reduce((sum, s: any) => {
          return sum + (s.total || (s.price * s.quantity) || 0);
        }, 0);
        
        const value = ordersValue + shelfSalesValue;
        data.push({
          label: formatNumericDate(monthStart),
          value,
          timestamp: monthStart.toISOString(),
        });
      }
    }

    return data;
  }

  private generateDailyAggregates(
    orders: any[],
    items: any[],
    weekStartDate: string,
  ): any[] {
    console.log('generateDailyAggregates called with:', {
      ordersCount: orders.length,
      itemsCount: items.length,
      weekStartDate,
    });
    const dailyMap = new Map<string, {
      date: Date;
      dayName: string;
      totalSales: number;
      orderCount: number;
      totalDiscounts: number;
    }>();

    // Initialize all 7 days with zeros
    // Parse the SQLite datetime format (YYYY-MM-DD HH:mm:ss) or ISO format
    let start: Date;
    if (weekStartDate && weekStartDate.includes(' ')) {
      // SQLite format: "YYYY-MM-DD HH:mm:ss"
      const [datePart] = weekStartDate.split(' ');
      const [year, month, day] = datePart.split('-').map(Number);
      start = new Date(year, month - 1, day, 0, 0, 0);
    } else if (weekStartDate) {
      // ISO format or other
      start = new Date(weekStartDate);
    } else {
      // No date provided, use current week
      start = new Date();
      start.setHours(0, 0, 0, 0);
      // Set to start of week (Sunday)
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
    }
    
    // Validate date
    if (isNaN(start.getTime())) {
      // Fallback to current date if parsing fails
      start = new Date();
      start.setHours(0, 0, 0, 0);
    }
    
    // Ensure we start at the beginning of the week (Sunday = 0)
    const dayOfWeek = start.getDay();
    if (dayOfWeek !== 0) {
      start.setDate(start.getDate() - dayOfWeek);
    }
    
    // Generate exactly 7 days
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(start);
      dayDate.setDate(start.getDate() + i);
      dayDate.setHours(0, 0, 0, 0);
      
      // Validate the date before using it
      if (isNaN(dayDate.getTime())) {
        console.error(`Invalid date generated for day ${i}:`, dayDate);
        continue;
      }
      
      const dayKey = dayDate.toISOString().split('T')[0];
      // Format as numeric date (DD/MM/YYYY)
      const day = String(dayDate.getDate()).padStart(2, '0');
      const month = String(dayDate.getMonth() + 1);
      const year = dayDate.getFullYear();
      const dayName = `${day}/${month}/${year}`;
      
      dailyMap.set(dayKey, {
        date: dayDate,
        dayName: dayName,
        totalSales: 0,
        orderCount: 0,
        totalDiscounts: 0,
      });
    }

    // Aggregate orders by day
    orders.forEach((order: any) => {
      const orderDate = new Date(order.created_at);
      const dayKey = orderDate.toISOString().split('T')[0];
      
      let discountAmount = 0;
      if (order.globalDiscount) {
        try {
          const globalDiscount = typeof order.globalDiscount === 'string' 
            ? JSON.parse(order.globalDiscount) 
            : order.globalDiscount;
          discountAmount = globalDiscount?.amount || 0;
        } catch (e) {
          discountAmount = 0;
        }
      }

      const orderNet = order.total || 0;
      
      const dayData = dailyMap.get(dayKey);
      if (dayData) {
        dayData.totalSales += orderNet;
        dayData.orderCount += 1;
        dayData.totalDiscounts += discountAmount;
      }
    });

    // Convert to array and format - ensure exactly 7 days
    const dailyArray = Array.from(dailyMap.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 7) // Ensure max 7 days
      .map((dayData, index) => {
        // Validate date before converting
        let dateString = '';
        try {
          if (dayData.date && !isNaN(dayData.date.getTime())) {
            dateString = dayData.date.toISOString().split('T')[0];
          } else {
            console.error('Invalid date in dayData:', dayData);
            // Create a fallback date
            const fallbackDate = new Date(start);
            fallbackDate.setDate(start.getDate() + index);
            dateString = fallbackDate.toISOString().split('T')[0];
          }
        } catch (e) {
          console.error('Error formatting date:', e);
          dateString = new Date(start.getTime() + index * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        }
        
        // Format day name as numeric date if not already formatted
        let formattedDayName = dayData.dayName;
        if (!formattedDayName || formattedDayName.includes('Day')) {
          const day = String(dayData.date.getDate()).padStart(2, '0');
          const month = String(dayData.date.getMonth() + 1);
          const year = dayData.date.getFullYear();
          formattedDayName = `${day}/${month}/${year}`;
        }
        
        return {
          id: index + 1,
          day: formattedDayName,
          date: dateString,
          totalSales: dayData.totalSales || 0,
          orderCount: dayData.orderCount || 0,
          averageOrder: dayData.orderCount > 0 
            ? Math.round(dayData.totalSales / dayData.orderCount) 
            : 0,
          totalDiscounts: dayData.totalDiscounts || 0,
          netProfit: (dayData.totalSales || 0) - (dayData.totalDiscounts || 0),
        };
      });
    
    // If we have less than 7 days, fill the rest
    while (dailyArray.length < 7) {
      const index = dailyArray.length;
      const dayDate = new Date(start);
      dayDate.setDate(start.getDate() + index);
      dayDate.setHours(0, 0, 0, 0);
      
      // Format as numeric date (DD/MM/YYYY)
      const day = String(dayDate.getDate()).padStart(2, '0');
      const month = String(dayDate.getMonth() + 1);
      const year = dayDate.getFullYear();
      const dayName = `${day}/${month}/${year}`;
      
      dailyArray.push({
        id: index + 1,
        day: dayName,
        date: dayDate.toISOString().split('T')[0],
        totalSales: 0,
        orderCount: 0,
        averageOrder: 0,
        totalDiscounts: 0,
        netProfit: 0,
      });
    }
    
    console.log('generateDailyAggregates returning:', dailyArray.length, 'days');
    return dailyArray;
  }

  private generateBusinessDayAggregates(
    businessDays: any[],
    orders: any[],
    items: any[],
  ): any[] {
    console.log('generateBusinessDayAggregates - Input:', {
      businessDaysCount: businessDays.length,
      ordersCount: orders.length,
      itemsCount: items.length,
    });
    
    // Sort business days by start_at
    const sortedBusinessDays = [...businessDays].sort((a, b) => 
      new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );

    console.log('generateBusinessDayAggregates - Sorted business days:', sortedBusinessDays.map(bd => ({
      id: bd.id,
      start_at: bd.start_at,
      end_at: bd.end_at,
      is_active: bd.is_active,
    })));

    // Ensure we have exactly 7 business days (pad with empty if needed)
    while (sortedBusinessDays.length < 7) {
      sortedBusinessDays.push(null);
    }
    const businessDaysToShow = sortedBusinessDays.slice(0, 7);
    
    console.log('generateBusinessDayAggregates - Processing', businessDaysToShow.length, 'business days');

    const results = businessDaysToShow.map((businessDay, index) => {
      if (!businessDay) {
        // Empty business day slot
        return {
          id: index + 1,
          day: '-',
          date: '',
          totalSales: 0,
          orderCount: 0,
          averageOrder: 0,
          totalDiscounts: 0,
          netProfit: 0,
        };
      }

      // Parse dates properly - handle SQLite datetime format
      let startDate: Date;
      let endDate: Date;
      
      try {
        startDate = new Date(businessDay.start_at);
        if (businessDay.is_active === 1) {
          endDate = new Date();
        } else {
          endDate = businessDay.end_at ? new Date(businessDay.end_at) : new Date();
        }
        
        // Validate dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          console.error('Invalid date in business day:', businessDay);
          startDate = new Date();
          endDate = new Date();
        }
      } catch (e) {
        console.error('Error parsing business day dates:', e, businessDay);
        startDate = new Date();
        endDate = new Date();
      }

      // Get orders for this business day
      // Note: orders.created_at should be between business day start_at and end_at
      const dayOrders = orders.filter((order: any) => {
        try {
          const orderDate = new Date(order.created_at);
          if (isNaN(orderDate.getTime())) {
            return false;
          }
          
          // Check if order was created during this business day using timestamps
          const orderTime = orderDate.getTime();
          const startTime = startDate.getTime();
          const endTime = endDate.getTime();
          
          const isAfterStart = orderTime >= startTime;
          const isBeforeEnd = businessDay.is_active === 1 
            ? orderTime <= endTime  // For active day, include up to now
            : orderTime < endTime;   // For closed day, exclude the end time
          
          return isAfterStart && isBeforeEnd;
        } catch (e) {
          console.error('Error parsing order date:', order.created_at, e);
          return false;
        }
      });


      // Calculate totals for this business day
      let totalSales = 0;
      let totalDiscounts = 0;
      dayOrders.forEach((order: any) => {
        let discountAmount = 0;
        if (order.globalDiscount) {
          try {
            const parsedDiscount = typeof order.globalDiscount === 'string' 
              ? JSON.parse(order.globalDiscount) 
              : order.globalDiscount;
            discountAmount = parsedDiscount?.amount || 0;
          } catch (e) {
            discountAmount = 0;
          }
        }
        totalSales += order.total || 0;
        totalDiscounts += discountAmount;
      });

      const orderCount = dayOrders.length;
      const averageOrder = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;
      const netProfit = totalSales;

      // Format date as numeric (DD/MM/YYYY)
      const dateString = startDate.toISOString().split('T')[0];
      const day = String(startDate.getDate()).padStart(2, '0');
      const month = String(startDate.getMonth() + 1);
      const year = startDate.getFullYear();
      const dayName = `${day}/${month}/${year}`;

      const result = {
        id: index + 1,
        day: dayName,
        date: dateString,
        totalSales,
        orderCount,
        averageOrder,
        totalDiscounts,
        netProfit,
      };
      
      return result;
    });
    
    return results;
  }

  private generateEmptyDailyAggregates(): any[] {
    const today = new Date();
    const result = [];

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(today);
      dayDate.setDate(today.getDate() - (6 - i)); // Last 7 days
      dayDate.setHours(0, 0, 0, 0);
      
      // Format as numeric date (DD/MM/YYYY)
      const day = String(dayDate.getDate()).padStart(2, '0');
      const month = String(dayDate.getMonth() + 1);
      const year = dayDate.getFullYear();
      const dayName = `${day}/${month}/${year}`;
      
      result.push({
        id: i + 1,
        day: dayName,
        date: dayDate.toISOString().split('T')[0],
        totalSales: 0,
        orderCount: 0,
        averageOrder: 0,
        totalDiscounts: 0,
        netProfit: 0,
      });
    }

    return result;
  }

  // ============================================================
  // SHIFT-BASED REPORT METHODS
  // ============================================================

  /**
   * Get report data by shift IDs - this is the core shift-based query
   */
  private async getReportByShiftIds(period: string, shiftIds: number[], dateStr: string): Promise<any> {
    if (shiftIds.length === 0) {
      return {
        summary: { totalSales: 0, orderCount: 0, averageOrder: 0, discounts: 0, cancellations: 0, netProfit: 0 },
        graphData: [],
        itemsPerformance: [],
        unsoldMenuItems: [],
        employeeSummary: [],
        orders: [],
        cashDrawer: { openingBalance: 0, cashIn: 0, cashOut: 0, closingBalance: 0, variance: 0 },
      };
    }

    const placeholders = shiftIds.map(() => '?').join(',');
    
    // Get all orders for these shifts (only completed)
    const orders = await this.db.all(
      `SELECT id, total, globalDiscount, created_at, status, 'dine_in' as order_type, shift_id, created_by_user_id
       FROM dine_in_orders 
       WHERE shift_id IN (${placeholders}) AND status IN ('completed', 'archived')
       UNION ALL
       SELECT id, total, globalDiscount, created_at, status, 'pickup' as order_type, shift_id, created_by_user_id
       FROM pickup_orders 
       WHERE shift_id IN (${placeholders}) AND status IN ('completed', 'archived')
       UNION ALL
       SELECT id, total, globalDiscount, created_at, status, 'delivery' as order_type, shift_id, created_by_user_id
       FROM delivery_orders 
       WHERE shift_id IN (${placeholders}) AND status IN ('completed', 'archived')`,
      [...shiftIds, ...shiftIds, ...shiftIds],
    );

    return this.processOrdersForReport(period, orders, dateStr);
  }

  /** Per-shift sales within a business day (multi mode). */
  private async buildShiftBreakdown(orders: any[], _dateStr: string): Promise<any[]> {
    const definitions = await getShiftDefinitions(true);
    return this.buildShiftBreakdownForOrders(orders, definitions);
  }

  private buildShiftBreakdownForOrders(orders: any[], definitions: any[]): any[] {
    const buckets = new Map<number | 'unassigned', { sales: number; count: number }>();

    for (const order of orders) {
      const key = order.shift_definition_id ?? 'unassigned';
      if (!buckets.has(key)) buckets.set(key, { sales: 0, count: 0 });
      const b = buckets.get(key)!;
      b.sales += order.total || 0;
      b.count += 1;
    }

    const rows: any[] = [];
    for (const def of definitions) {
      const b = buckets.get(def.id) || { sales: 0, count: 0 };
      rows.push({
        shiftId: def.id,
        shiftName: def.name,
        startTime: def.start_time,
        endTime: def.end_time,
        totalSales: b.sales,
        orderCount: b.count,
        averageOrder: b.count > 0 ? Math.round(b.sales / b.count) : 0,
      });
    }

    const unassigned = buckets.get('unassigned');
    if (unassigned && unassigned.count > 0) {
      rows.push({
        shiftId: null,
        shiftName: 'غير محدد',
        startTime: null,
        endTime: null,
        totalSales: unassigned.sales,
        orderCount: unassigned.count,
        averageOrder: unassigned.count > 0 ? Math.round(unassigned.sales / unassigned.count) : 0,
      });
    }

    return rows;
  }

  private async buildShiftBreakdownByDay(orders: any[]): Promise<Record<string, any[]>> {
    const definitions = await getShiftDefinitions(true);
    const byDate = new Map<string, any[]>();
    for (const order of orders) {
      const key = this.orderBusinessDateKey(order);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(order);
    }
    const result: Record<string, any[]> = {};
    for (const [date, dayOrders] of byDate) {
      result[date] = this.buildShiftBreakdownForOrders(dayOrders, definitions);
    }
    return result;
  }

  private async buildShiftBreakdownByMonth(orders: any[]): Promise<Record<string, Record<string, any[]>>> {
    const byDay = await this.buildShiftBreakdownByDay(orders);
    const result: Record<string, Record<string, any[]>> = {};
    for (const [date, rows] of Object.entries(byDay)) {
      const monthKey = date.slice(0, 7);
      if (!result[monthKey]) result[monthKey] = {};
      result[monthKey][date] = rows;
    }
    return result;
  }

  private monthBusinessDatePrefix(year: number, monthIndex: number): string {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-`;
  }

  private filterOrdersByBusinessMonth(orders: any[], year: number, monthIndex: number): any[] {
    const prefix = this.monthBusinessDatePrefix(year, monthIndex);
    return orders.filter((o) => this.orderBusinessDateKey(o).startsWith(prefix));
  }

  private async attachMultiShiftFields(result: any, orders: any[]): Promise<any> {
    const config = await getShiftConfig();
    if (config.shift_mode !== 'multi') return result;
    result.shiftBreakdownByDay = await this.buildShiftBreakdownByDay(orders);
    result.shiftBreakdownTotals = await this.buildShiftBreakdown(orders, '');
    return result;
  }

  /**
   * Process orders array into report format
   */
  private async processOrdersForReport(period: string, orders: any[], dateStr: string): Promise<any> {
    let totalSales = 0;
    let totalDiscounts = 0;
    const salesByType = { dineIn: 0, pickup: 0, delivery: 0 };
    const orderCount = orders.length;

    orders.forEach((order: any) => {
      let discountAmount = 0;
      if (order.globalDiscount) {
        try {
          const globalDiscount = typeof order.globalDiscount === 'string'
            ? JSON.parse(order.globalDiscount)
            : order.globalDiscount;
          discountAmount = globalDiscount?.amount || 0;
        } catch (e) {
          discountAmount = 0;
        }
      }
      // order.total is NET (after discount) - use directly to match Finance
      const orderNet = order.total || 0;
      totalSales += orderNet;
      totalDiscounts += discountAmount;
      const type = (order.order_type || 'dine_in').replace('-', '_');
      if (type === 'dine_in') salesByType.dineIn += orderNet;
      else if (type === 'pickup') salesByType.pickup += orderNet;
      else if (type === 'delivery') salesByType.delivery += orderNet;
    });

    const averageOrder = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;
    const netProfit = totalSales; // totalSales is already NET

    const { itemsPerformance, unsoldMenuItems } = await this.attachItemsReportFromOrders(orders);
    const employeeSummary = await this.buildEmployeeSummaryFromOrders(orders);

    // Build graph data by hour for daily
    const graphData = this.buildGraphDataFromOrders(orders, period);

    // For daily report, return DailyAggregate[] so Reports page table shows day summary, not raw orders
    const reportDate = new Date(dateStr);
    const dayNum = String(reportDate.getDate()).padStart(2, '0');
    const monthNum = String(reportDate.getMonth() + 1);
    const yearNum = reportDate.getFullYear();
    const dayLabel = `${dayNum}/${monthNum}/${yearNum}`;
    const ordersReport =
      period === 'daily'
        ? [
            {
              id: 1,
              date: dateStr,
              day: dayLabel,
              totalSales,
              totalDiscounts,
              netProfit,
              orderCount,
              averageOrder,
            },
          ]
        : orders.map((o) => ({
            id: o.id,
            total: o.total,
            status: o.status,
            created_at: o.created_at,
            order_type: o.order_type,
          }));

    return {
      summary: {
        totalSales,
        orderCount,
        averageOrder,
        discounts: totalDiscounts,
        cancellations: 0,
        netProfit,
        salesByType,
      },
      graphData,
      itemsPerformance,
      unsoldMenuItems,
      employeeSummary,
      orders: ordersReport,
      cashDrawer: {
        openingBalance: 0,
        cashIn: netProfit,
        cashOut: 0,
        closingBalance: netProfit,
        variance: 0,
      },
    };
  }

  /**
   * Staff-only (excludes role customer): orders attributed via created_by_user_id on domain order tables.
   */
  private async buildEmployeeSummaryFromOrders(orders: any[]): Promise<
    Array<{
      id: number;
      name: string;
      ordersHandled: number;
      totalSales: number;
      cancellations: number;
      avgOrderValue: number;
    }>
  > {
    if (!orders?.length) return [];
    const agg = new Map<number, { orders: number; sales: number }>();
    for (const o of orders) {
      const uid = o.created_by_user_id;
      if (uid == null || uid === 0) continue;
      const net = Number(o.total) || 0;
      const cur = agg.get(uid) || { orders: 0, sales: 0 };
      cur.orders += 1;
      cur.sales += net;
      agg.set(uid, cur);
    }
    if (agg.size === 0) return [];
    const ids = Array.from(agg.keys());
    const placeholders = ids.map(() => '?').join(',');
    let userRows: Array<{ id: number; username: string; role: string }> = [];
    try {
      const raw =
        (await this.db.all(
          `SELECT id, username, role FROM users WHERE id IN (${placeholders})`,
          ids,
        )) || [];
      userRows = raw as Array<{ id: number; username: string; role: string }>;
    } catch {
      return [];
    }
    const out: Array<{
      id: number;
      name: string;
      ordersHandled: number;
      totalSales: number;
      cancellations: number;
      avgOrderValue: number;
    }> = [];
    for (const [id, v] of agg.entries()) {
      const u = userRows.find((x) => x.id === id);
      if (u?.role === 'customer') continue;
      out.push({
        id,
        name: u?.username || `مستخدم #${id}`,
        ordersHandled: v.orders,
        totalSales: v.sales,
        cancellations: 0,
        avgOrderValue: v.orders > 0 ? Math.round(v.sales / v.orders) : 0,
      });
    }
    return out.sort((a, b) => b.totalSales - a.totalSales);
  }

  /** Aggregates menu item sales + list of menu items with zero sales in period (visible items only). */
  private async attachItemsReportFromOrders(orders: any[]): Promise<{
    itemsPerformance: Array<{
      id: number;
      name: string;
      quantitySold: number;
      totalSales: number;
      movementStatus: 'high' | 'medium' | 'low';
    }>;
    unsoldMenuItems: Array<{ id: number; name: string }>;
  }> {
    const { items, soldItemIds } = await this.getItemsPerformanceFromOrders(orders);
    const unsoldMenuItems = await this.getUnsoldMenuItems(soldItemIds, orders.length);
    return { itemsPerformance: items, unsoldMenuItems };
  }

  /** Menu items shown on POS that had no sales in the report period. */
  private async getUnsoldMenuItems(
    soldItemIds: number[],
    orderCount: number,
  ): Promise<Array<{ id: number; name: string }>> {
    if (orderCount === 0) return [];
    try {
      if (soldItemIds.length === 0) {
        const rows =
          (await this.db.all(
            `SELECT id, name FROM items WHERE COALESCE(hidden_from_menu, 0) = 0 ORDER BY name COLLATE NOCASE`,
          )) || [];
        return rows as Array<{ id: number; name: string }>;
      }
      const placeholders = soldItemIds.map(() => '?').join(',');
      const rows =
        (await this.db.all(
          `SELECT id, name FROM items WHERE COALESCE(hidden_from_menu, 0) = 0 AND id NOT IN (${placeholders}) ORDER BY name COLLATE NOCASE`,
          soldItemIds,
        )) || [];
      return rows as Array<{ id: number; name: string }>;
    } catch {
      return [];
    }
  }

  /**
   * Get items performance from orders (all sold SKUs, sorted by revenue desc).
   */
  private async getItemsPerformanceFromOrders(orders: any[]): Promise<{
    items: Array<{
      id: number;
      name: string;
      quantitySold: number;
      totalSales: number;
      movementStatus: 'high' | 'medium' | 'low';
    }>;
    soldItemIds: number[];
  }> {
    if (orders.length === 0) {
      return { items: [], soldItemIds: [] };
    }

    const dineInIds = orders.filter((o) => this.orderTypeForItems(o.order_type) === 'dine_in').map((o) => o.id);
    const pickupIds = orders.filter((o) => o.order_type === 'pickup').map((o) => o.id);
    const deliveryIds = orders.filter((o) => o.order_type === 'delivery').map((o) => o.id);

    let allItems: any[] = [];

    if (dineInIds.length > 0) {
      const items = await this.db.all(
        `SELECT item_id, item_name, SUM(quantity) as quantity, SUM(price * quantity) as revenue
         FROM order_items 
         WHERE order_id IN (${dineInIds.join(',')}) AND order_type = 'dine_in'
         GROUP BY item_id, item_name`,
      );
      allItems = allItems.concat(items);
    }

    if (pickupIds.length > 0) {
      const items = await this.db.all(
        `SELECT item_id, item_name, SUM(quantity) as quantity, SUM(price * quantity) as revenue
         FROM order_items 
         WHERE order_id IN (${pickupIds.join(',')}) AND order_type = 'pickup'
         GROUP BY item_id, item_name`,
      );
      allItems = allItems.concat(items);
    }

    if (deliveryIds.length > 0) {
      const items = await this.db.all(
        `SELECT item_id, item_name, SUM(quantity) as quantity, SUM(price * quantity) as revenue
         FROM order_items 
         WHERE order_id IN (${deliveryIds.join(',')}) AND order_type = 'delivery'
         GROUP BY item_id, item_name`,
      );
      allItems = allItems.concat(items);
    }

    const itemMap = new Map<number, { name: string; quantity: number; revenue: number }>();
    allItems.forEach((item) => {
      const key = item.item_id;
      if (key == null) return;
      const existing = itemMap.get(key);
      if (existing) {
        existing.quantity += item.quantity || 0;
        existing.revenue += item.revenue || 0;
      } else {
        itemMap.set(key, {
          name: item.item_name,
          quantity: item.quantity || 0,
          revenue: item.revenue || 0,
        });
      }
    });

    const items = Array.from(itemMap.entries())
      .map(([id, data], index) => {
        const totalSales = data.revenue;
        const movementStatus: 'high' | 'medium' | 'low' =
          totalSales > 3000 ? 'high' : totalSales > 1500 ? 'medium' : 'low';
        return {
          id: id || index + 1,
          name: data.name,
          quantitySold: data.quantity,
          totalSales,
          movementStatus,
        };
      })
      .sort((a, b) => b.totalSales - a.totalSales);

    const soldItemIds = items.map((i) => i.id);
    return { items, soldItemIds };
  }

  /**
   * Build graph data from orders by hour (for daily) or by period
   */
  private buildGraphDataFromOrders(orders: any[], period: string): any[] {
    if (period === 'daily') {
      // Group by hour
      const hourMap = new Map<number, { sales: number; orders: number }>();
      for (let h = 0; h < 24; h++) {
        hourMap.set(h, { sales: 0, orders: 0 });
      }

      orders.forEach(order => {
        try {
          const hour = new Date(order.created_at).getHours();
          const data = hourMap.get(hour)!;
          data.orders++;
          data.sales += order.total || 0;
        } catch (e) {
          // Skip invalid dates
        }
      });

      return Array.from(hourMap.entries()).map(([hour, data]) => ({
        label: `${hour}:00`,
        sales: data.sales,
        orders: data.orders,
      }));
    }

    return [];
  }

  /**
   * Process weekly shifts into report format
   */
  private async processWeeklyShifts(shifts: any[]): Promise<any> {
    const shiftIds = shifts.map(s => s.id);
    
    // Get all orders for all shifts
    const orders = await this.getOrdersByShiftIds(shiftIds);

    // Calculate summary
    let totalSales = 0;
    let totalDiscounts = 0;
    
    orders.forEach((order: any) => {
      let discountAmount = 0;
      if (order.globalDiscount) {
        try {
          const globalDiscount = typeof order.globalDiscount === 'string'
            ? JSON.parse(order.globalDiscount)
            : order.globalDiscount;
          discountAmount = globalDiscount?.amount || 0;
        } catch (e) {
          discountAmount = 0;
        }
      }
      totalSales += order.total || 0;
      totalDiscounts += discountAmount;
    });

    const orderCount = orders.length;
    const averageOrder = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;

    // Build graph data by shift
    const graphData = shifts.map((shift, index) => {
      const shiftOrders = orders.filter((o: any) => o.shift_id === shift.id);
      const sales = shiftOrders.reduce((sum, o: any) => sum + (o.total || 0), 0);

      const shiftDate = new Date(shift.start_time);
      const day = String(shiftDate.getDate()).padStart(2, '0');
      const month = String(shiftDate.getMonth() + 1);

      return {
        id: index + 1,
        day: `${day}/${month}`,
        date: shiftDate.toISOString().split('T')[0],
        totalSales: sales,
        orderCount: shiftOrders.length,
        averageOrder: shiftOrders.length > 0 ? Math.round(sales / shiftOrders.length) : 0,
      };
    });

    const { itemsPerformance, unsoldMenuItems } = await this.attachItemsReportFromOrders(orders);
    const employeeSummary = await this.buildEmployeeSummaryFromOrders(orders);

    return {
      summary: {
        totalSales,
        orderCount,
        averageOrder,
        discounts: totalDiscounts,
        cancellations: 0,
        netProfit: totalSales,
      },
      graphData,
      itemsPerformance,
      unsoldMenuItems,
      employeeSummary,
      orders: [],
    };
  }

  /**
   * Process monthly shifts grouped into weeks
   */
  private async processMonthlyShifts(shifts: any[], monthStart: Date): Promise<any> {
    const shiftIds = shifts.map(s => s.id);
    const orders = await this.getOrdersByShiftIds(shiftIds);

    // Calculate summary
    let totalSales = 0;
    let totalDiscounts = 0;
    
    orders.forEach((order: any) => {
      let discountAmount = 0;
      if (order.globalDiscount) {
        try {
          const globalDiscount = typeof order.globalDiscount === 'string'
            ? JSON.parse(order.globalDiscount)
            : order.globalDiscount;
          discountAmount = globalDiscount?.amount || 0;
        } catch (e) {
          discountAmount = 0;
        }
      }
      totalSales += order.total || 0;
      totalDiscounts += discountAmount;
    });

    const orderCount = orders.length;
    const averageOrder = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;

    // Group shifts into 4 weeks
    const weeklyData: any[] = [];
    for (let week = 0; week < 4; week++) {
      const weekStart = new Date(monthStart);
      weekStart.setDate(weekStart.getDate() + (week * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekShiftIds = shifts
        .filter(s => {
          const shiftDate = new Date(s.start_time);
          return shiftDate >= weekStart && shiftDate < weekEnd;
        })
        .map(s => s.id);

      const weekOrders = orders.filter((o: any) => weekShiftIds.includes(o.shift_id));
      const weekSales = weekOrders.reduce((sum, o: any) => sum + (o.total || 0), 0);

      weeklyData.push({
        id: week + 1,
        week: `أسبوع ${week + 1}`,
        totalSales: weekSales,
        orderCount: weekOrders.length,
        averageOrder: weekOrders.length > 0 ? Math.round(weekSales / weekOrders.length) : 0,
      });
    }

    const { itemsPerformance, unsoldMenuItems } = await this.attachItemsReportFromOrders(orders);
    const employeeSummary = await this.buildEmployeeSummaryFromOrders(orders);

    return {
      summary: {
        totalSales,
        orderCount,
        averageOrder,
        discounts: totalDiscounts,
        cancellations: 0,
        netProfit: totalSales,
      },
      graphData: weeklyData,
      itemsPerformance,
      unsoldMenuItems,
      employeeSummary,
      orders: [],
    };
  }

  /**
   * Process yearly shifts grouped into months
   */
  private async processYearlyShifts(shifts: any[], year: number): Promise<any> {
    const shiftIds = shifts.map(s => s.id);
    const orders = await this.getOrdersByShiftIds(shiftIds);

    // Calculate summary
    let totalSales = 0;
    let totalDiscounts = 0;
    
    orders.forEach((order: any) => {
      let discountAmount = 0;
      if (order.globalDiscount) {
        try {
          const globalDiscount = typeof order.globalDiscount === 'string'
            ? JSON.parse(order.globalDiscount)
            : order.globalDiscount;
          discountAmount = globalDiscount?.amount || 0;
        } catch (e) {
          discountAmount = 0;
        }
      }
      totalSales += order.total || 0;
      totalDiscounts += discountAmount;
    });

    const orderCount = orders.length;
    const averageOrder = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;

    // Group shifts into 12 months
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    
    const monthlyData: any[] = [];
    for (let month = 0; month < 12; month++) {
      const monthShiftIds = shifts
        .filter(s => new Date(s.start_time).getMonth() === month)
        .map(s => s.id);

      const monthOrders = orders.filter((o: any) => monthShiftIds.includes(o.shift_id));
      const monthSales = monthOrders.reduce((sum, o: any) => sum + (o.total || 0), 0);

      monthlyData.push({
        id: month + 1,
        month: monthNames[month],
        totalSales: monthSales,
        orderCount: monthOrders.length,
        averageOrder: monthOrders.length > 0 ? Math.round(monthSales / monthOrders.length) : 0,
      });
    }

    const { itemsPerformance, unsoldMenuItems } = await this.attachItemsReportFromOrders(orders);
    const employeeSummary = await this.buildEmployeeSummaryFromOrders(orders);

    return {
      summary: {
        totalSales,
        orderCount,
        averageOrder,
        discounts: totalDiscounts,
        cancellations: 0,
        netProfit: totalSales,
      },
      graphData: monthlyData,
      itemsPerformance,
      unsoldMenuItems,
      employeeSummary,
      orders: [],
    };
  }

  /** Group orders by date - returns NET sales (order.total) to match Finance. */
  private getOrderSales(order: any): number {
    return order.total || 0;
  }

  /** Process weekly report from orders (group by day). */
  private async processWeeklyFromOrders(orders: any[], dateStr: string): Promise<any> {
    let totalSales = 0;
    let totalDiscounts = 0;
    const salesByType = { dineIn: 0, pickup: 0, delivery: 0 };
    orders.forEach((o: any) => {
      const sales = this.getOrderSales(o);
      totalSales += sales;
      try {
        totalDiscounts += (typeof o.globalDiscount === 'string' ? JSON.parse(o.globalDiscount) : o.globalDiscount)?.amount || 0;
      } catch (e) {}
      const type = (o.order_type || 'dine_in').replace('-', '_');
      if (type === 'dine_in') salesByType.dineIn += sales;
      else if (type === 'pickup') salesByType.pickup += sales;
      else if (type === 'delivery') salesByType.delivery += sales;
    });
    const orderCount = orders.length;
    const averageOrder = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;

    const byDate = new Map<string, { sales: number; orders: any[] }>();
    orders.forEach((o: any) => {
      const key = this.orderBusinessDateKey(o);
      if (!byDate.has(key)) byDate.set(key, { sales: 0, orders: [] });
      const entry = byDate.get(key)!;
      entry.sales += this.getOrderSales(o);
      entry.orders.push(o);
    });

    const weekEnd = new Date(`${dateStr}T12:00:00`);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    const pad = (n: number) => String(n).padStart(2, '0');
    const allDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      allDates.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    }

    const graphData = allDates.map((key, i) => {
      const entry = byDate.get(key) || { sales: 0, orders: [] };
      const d = new Date(`${key}T12:00:00`);
      return {
        id: i + 1,
        day: String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'),
        date: key,
        totalSales: entry.sales,
        orderCount: entry.orders.length,
        averageOrder: entry.orders.length > 0 ? Math.round(entry.sales / entry.orders.length) : 0,
      };
    });

    // Populate orders for "Days Summary" table (DailyAggregate shape)
    const dayDiscounts = new Map<string, number>();
    orders.forEach((o: any) => {
      try {
        const amt = (typeof o.globalDiscount === 'string' ? JSON.parse(o.globalDiscount) : o.globalDiscount)?.amount || 0;
        if (amt) {
          const key = this.orderBusinessDateKey(o);
          dayDiscounts.set(key, (dayDiscounts.get(key) || 0) + amt);
        }
      } catch (e) {}
    });
    const ordersReport = graphData.map((row) => ({
      id: row.id,
      day: row.day,
      date: row.date,
      totalSales: row.totalSales,
      orderCount: row.orderCount,
      averageOrder: row.averageOrder,
      totalDiscounts: dayDiscounts.get(row.date) || 0,
      netProfit: row.totalSales,
    }));

    const { itemsPerformance, unsoldMenuItems } = await this.attachItemsReportFromOrders(orders);
    const employeeSummary = await this.buildEmployeeSummaryFromOrders(orders);
    const result = {
      summary: { totalSales, orderCount, averageOrder, discounts: totalDiscounts, cancellations: 0, netProfit: totalSales, salesByType },
      graphData,
      itemsPerformance,
      unsoldMenuItems,
      employeeSummary,
      orders: ordersReport,
    };
    return this.attachMultiShiftFields(result, orders);
  }

  /** Process monthly report grouped by business day (multi shift mode). */
  private async processMonthlyDaysFromOrders(orders: any[], monthStart: Date): Promise<any> {
    let totalSales = 0;
    let totalDiscounts = 0;
    const salesByType = { dineIn: 0, pickup: 0, delivery: 0 };
    orders.forEach((o: any) => {
      const sales = this.getOrderSales(o);
      totalSales += sales;
      try {
        totalDiscounts += (typeof o.globalDiscount === 'string' ? JSON.parse(o.globalDiscount) : o.globalDiscount)?.amount || 0;
      } catch (e) {}
      const type = (o.order_type || 'dine_in').replace('-', '_');
      if (type === 'dine_in') salesByType.dineIn += sales;
      else if (type === 'pickup') salesByType.pickup += sales;
      else if (type === 'delivery') salesByType.delivery += sales;
    });
    const orderCount = orders.length;
    const averageOrder = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;

    const byDate = new Map<string, { sales: number; orders: any[] }>();
    orders.forEach((o: any) => {
      const key = this.orderBusinessDateKey(o);
      if (!byDate.has(key)) byDate.set(key, { sales: 0, orders: [] });
      const entry = byDate.get(key)!;
      entry.sales += this.getOrderSales(o);
      entry.orders.push(o);
    });

    const pad = (n: number) => String(n).padStart(2, '0');
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const graphData: any[] = [];
    const ordersReport: any[] = [];
    const dayDiscounts = new Map<string, number>();
    orders.forEach((o: any) => {
      try {
        const amt = (typeof o.globalDiscount === 'string' ? JSON.parse(o.globalDiscount) : o.globalDiscount)?.amount || 0;
        if (amt) {
          const key = this.orderBusinessDateKey(o);
          dayDiscounts.set(key, (dayDiscounts.get(key) || 0) + amt);
        }
      } catch (e) {}
    });

    let id = 1;
    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const entry = byDate.get(key) || { sales: 0, orders: [] };
      const dayLabel = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
      graphData.push({
        id,
        day: dayLabel,
        date: key,
        totalSales: entry.sales,
        orderCount: entry.orders.length,
        averageOrder: entry.orders.length > 0 ? Math.round(entry.sales / entry.orders.length) : 0,
      });
      ordersReport.push({
        id,
        day: dayLabel,
        date: key,
        totalSales: entry.sales,
        orderCount: entry.orders.length,
        averageOrder: entry.orders.length > 0 ? Math.round(entry.sales / entry.orders.length) : 0,
        totalDiscounts: dayDiscounts.get(key) || 0,
        netProfit: entry.sales,
      });
      id += 1;
    }

    const { itemsPerformance, unsoldMenuItems } = await this.attachItemsReportFromOrders(orders);
    const employeeSummary = await this.buildEmployeeSummaryFromOrders(orders);
    const result = {
      summary: { totalSales, orderCount, averageOrder, discounts: totalDiscounts, cancellations: 0, netProfit: totalSales, salesByType },
      graphData,
      itemsPerformance,
      unsoldMenuItems,
      employeeSummary,
      orders: ordersReport,
    };
    return this.attachMultiShiftFields(result, orders);
  }

  /** Process yearly report in multi shift mode (months → days → shifts). */
  private async processYearlyMultiFromOrders(orders: any[], year: number): Promise<any> {
    let totalSales = 0;
    let totalDiscounts = 0;
    const salesByType = { dineIn: 0, pickup: 0, delivery: 0 };
    orders.forEach((o: any) => {
      const sales = this.getOrderSales(o);
      totalSales += sales;
      try {
        totalDiscounts += (typeof o.globalDiscount === 'string' ? JSON.parse(o.globalDiscount) : o.globalDiscount)?.amount || 0;
      } catch (e) {}
      const type = (o.order_type || 'dine_in').replace('-', '_');
      if (type === 'dine_in') salesByType.dineIn += sales;
      else if (type === 'pickup') salesByType.pickup += sales;
      else if (type === 'delivery') salesByType.delivery += sales;
    });
    const orderCount = orders.length;
    const averageOrder = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const graphData: any[] = [];
    const ordersReport: any[] = [];

    for (let month = 0; month < 12; month++) {
      const monthOrders = this.filterOrdersByBusinessMonth(orders, year, month);
      let monthSales = 0;
      monthOrders.forEach((o: any) => { monthSales += this.getOrderSales(o); });
      const monthStartStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      graphData.push({
        id: month + 1,
        month: monthNames[month],
        date: monthStartStr,
        totalSales: monthSales,
        orderCount: monthOrders.length,
        averageOrder: monthOrders.length > 0 ? Math.round(monthSales / monthOrders.length) : 0,
      });
      ordersReport.push({
        id: month + 1,
        day: monthNames[month],
        date: monthStartStr,
        monthKey: `${year}-${String(month + 1).padStart(2, '0')}`,
        totalSales: monthSales,
        orderCount: monthOrders.length,
        averageOrder: monthOrders.length > 0 ? Math.round(monthSales / monthOrders.length) : 0,
        totalDiscounts: 0,
        netProfit: monthSales,
      });
    }

    const { itemsPerformance, unsoldMenuItems } = await this.attachItemsReportFromOrders(orders);
    const employeeSummary = await this.buildEmployeeSummaryFromOrders(orders);
    const shiftBreakdownByMonth = await this.buildShiftBreakdownByMonth(orders);
    const shiftBreakdownTotals = await this.buildShiftBreakdown(orders, '');
    return {
      summary: { totalSales, orderCount, averageOrder, discounts: totalDiscounts, cancellations: 0, netProfit: totalSales, salesByType },
      graphData,
      itemsPerformance,
      unsoldMenuItems,
      employeeSummary,
      orders: ordersReport,
      shiftBreakdownByMonth,
      shiftBreakdownTotals,
    };
  }

  /** Process monthly report from orders (group by week). */
  private async processMonthlyFromOrders(orders: any[], monthStart: Date): Promise<any> {
    let totalSales = 0;
    let totalDiscounts = 0;
    const salesByType = { dineIn: 0, pickup: 0, delivery: 0 };
    orders.forEach((o: any) => {
      const sales = this.getOrderSales(o);
      totalSales += sales;
      try {
        totalDiscounts += (typeof o.globalDiscount === 'string' ? JSON.parse(o.globalDiscount) : o.globalDiscount)?.amount || 0;
      } catch (e) {}
      const type = (o.order_type || 'dine_in').replace('-', '_');
      if (type === 'dine_in') salesByType.dineIn += sales;
      else if (type === 'pickup') salesByType.pickup += sales;
      else if (type === 'delivery') salesByType.delivery += sales;
    });
    const orderCount = orders.length;
    const averageOrder = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;

    const weeklyData: any[] = [];
    const pad = (n: number) => String(n).padStart(2, '0');
    for (let week = 0; week < 4; week++) {
      const weekStart = new Date(monthStart);
      weekStart.setDate(weekStart.getDate() + (week * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const weekStartStr = `${weekStart.getFullYear()}-${pad(weekStart.getMonth() + 1)}-${pad(weekStart.getDate())}`;
      const weekEndStr = `${weekEnd.getFullYear()}-${pad(weekEnd.getMonth() + 1)}-${pad(weekEnd.getDate())}`;
      const weekOrders = orders.filter((o: any) => {
        const key = this.orderBusinessDateKey(o);
        return key >= weekStartStr && key < weekEndStr;
      });
      let weekSales = 0;
      weekOrders.forEach((o: any) => { weekSales += this.getOrderSales(o); });
      weeklyData.push({
        id: week + 1,
        week: `أسبوع ${week + 1}`,
        date: weekStartStr,
        totalSales: weekSales,
        orderCount: weekOrders.length,
        averageOrder: weekOrders.length > 0 ? Math.round(weekSales / weekOrders.length) : 0,
      });
    }
    // Populate orders for "Days Summary" table (DailyAggregate shape: day = week label)
    const ordersReport = weeklyData.map((row) => ({
      id: row.id,
      day: row.week,
      date: row.date,
      totalSales: row.totalSales,
      orderCount: row.orderCount,
      averageOrder: row.averageOrder,
      totalDiscounts: 0,
      netProfit: row.totalSales,
    }));
    const { itemsPerformance, unsoldMenuItems } = await this.attachItemsReportFromOrders(orders);
    const employeeSummary = await this.buildEmployeeSummaryFromOrders(orders);
    return {
      summary: { totalSales, orderCount, averageOrder, discounts: totalDiscounts, cancellations: 0, netProfit: totalSales, salesByType },
      graphData: weeklyData,
      itemsPerformance,
      unsoldMenuItems,
      employeeSummary,
      orders: ordersReport,
    };
  }

  /** Process yearly report from orders (group by month). */
  private async processYearlyFromOrders(orders: any[], year: number): Promise<any> {
    let totalSales = 0;
    let totalDiscounts = 0;
    const salesByType = { dineIn: 0, pickup: 0, delivery: 0 };
    orders.forEach((o: any) => {
      const sales = this.getOrderSales(o);
      totalSales += sales;
      try {
        totalDiscounts += (typeof o.globalDiscount === 'string' ? JSON.parse(o.globalDiscount) : o.globalDiscount)?.amount || 0;
      } catch (e) {}
      const type = (o.order_type || 'dine_in').replace('-', '_');
      if (type === 'dine_in') salesByType.dineIn += sales;
      else if (type === 'pickup') salesByType.pickup += sales;
      else if (type === 'delivery') salesByType.delivery += sales;
    });
    const orderCount = orders.length;
    const averageOrder = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const monthlyData: any[] = [];
    for (let month = 0; month < 12; month++) {
      const monthOrders = this.filterOrdersByBusinessMonth(orders, year, month);
      let monthSales = 0;
      monthOrders.forEach((o: any) => { monthSales += this.getOrderSales(o); });
      const monthStartStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      monthlyData.push({
        id: month + 1,
        month: monthNames[month],
        date: monthStartStr,
        totalSales: monthSales,
        orderCount: monthOrders.length,
        averageOrder: monthOrders.length > 0 ? Math.round(monthSales / monthOrders.length) : 0,
      });
    }
    // Populate orders for "Days Summary" table (DailyAggregate shape: day = month name)
    const ordersReport = monthlyData.map((row) => ({
      id: row.id,
      day: row.month,
      date: row.date,
      totalSales: row.totalSales,
      orderCount: row.orderCount,
      averageOrder: row.averageOrder,
      totalDiscounts: 0,
      netProfit: row.totalSales,
    }));
    const { itemsPerformance, unsoldMenuItems } = await this.attachItemsReportFromOrders(orders);
    const employeeSummary = await this.buildEmployeeSummaryFromOrders(orders);
    return {
      summary: { totalSales, orderCount, averageOrder, discounts: totalDiscounts, cancellations: 0, netProfit: totalSales, salesByType },
      graphData: monthlyData,
      itemsPerformance,
      unsoldMenuItems,
      employeeSummary,
      orders: ordersReport,
    };
  }

  /**
   * Get orders by shift IDs (kept for legacy/history; reports now use date range)
   */
  private async getOrdersByShiftIds(shiftIds: number[]): Promise<any[]> {
    if (shiftIds.length === 0) return [];

    const placeholders = shiftIds.map(() => '?').join(',');
    
    return this.db.all(
      `SELECT id, total, globalDiscount, created_at, status, 'dine_in' as order_type, shift_id, created_by_user_id
       FROM dine_in_orders 
       WHERE shift_id IN (${placeholders}) AND status IN ('completed', 'archived')
       UNION ALL
       SELECT id, total, globalDiscount, created_at, status, 'pickup' as order_type, shift_id, created_by_user_id
       FROM pickup_orders 
       WHERE shift_id IN (${placeholders}) AND status IN ('completed', 'archived')
       UNION ALL
       SELECT id, total, globalDiscount, created_at, status, 'delivery' as order_type, shift_id, created_by_user_id
       FROM delivery_orders 
       WHERE shift_id IN (${placeholders}) AND status IN ('completed', 'archived')`,
      [...shiftIds, ...shiftIds, ...shiftIds],
    );
  }
}

let reportsInstance: ReportsService | null = null;

export function initializeReports(db: DatabaseService): void {
  reportsInstance = new ReportsService(db);
}

function requireReports(): ReportsService {
  if (!reportsInstance) {
    throw new Error('Reports not initialized');
  }
  return reportsInstance;
}

export async function getDailySummary(): Promise<{
  totalSales: number;
  ordersCount: number;
  occupiedTables: number;
  emptyTables: number;
  printerStatus: 'success' | 'error';
}> {
  return requireReports().getDailySummary();
}

export async function getReportData(
  period: 'daily' | 'weekly' | 'monthly' | 'yearly',
  dateStr: string,
): Promise<any> {
  return requireReports().getReportData(period, dateStr);
}

export async function generateExcel(dto: ExportPdfDto): Promise<Buffer> {
  return requireReports().generateExcel(dto);
}

