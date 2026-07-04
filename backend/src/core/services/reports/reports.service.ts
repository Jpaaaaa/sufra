import { BadRequestException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';
import { BusinessDayService } from '../shared/business-day.service';
import { ExportPdfDto } from '../../types/reports/export-pdf.dto';
import { generateReportPDF } from './generate-report-pdf';
import { generateReportExcel } from './generate-report-excel';

export class ReportsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly businessDayService: BusinessDayService,
  ) {}

  async getDailySummary(): Promise<{
    totalSales: number;
    ordersCount: number;
    occupiedTables: number;
    emptyTables: number;
    printerStatus: 'success' | 'error';
  }> {
    const businessDayStart = await this.businessDayService.getBusinessDayStartTime();

    if (!businessDayStart) {
      // Fallback if no business day exists
      return {
        totalSales: 0,
        ordersCount: 0,
        occupiedTables: 0,
        emptyTables: 0,
        printerStatus: 'success',
      };
    }

    // Get all completed orders for current business day to calculate discounts properly
    const orders = await this.db.all(
      `SELECT total, globalDiscount 
       FROM orders 
       WHERE created_at >= ? AND created_at < datetime('now') AND status = 'completed'`,
      [businessDayStart],
    );

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

      // Total sales = order total + discounts (to get original amount)
      totalSales += (order.total || 0) + discountAmount;
    });

    // Get table counts (exclude virtual tables + orphan tables whose hall was deleted)
    const tableRows = await this.db.all(
      `SELECT t.id, COUNT(o.id) as orderCount
       FROM tables t
       INNER JOIN halls h ON t.hall_id = h.id
       LEFT JOIN orders o ON t.id = o.table_id 
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

  async generatePDF(dto: ExportPdfDto): Promise<Buffer> {
    try {
      console.log('[Service] generatePDF called with type:', dto.type);
      
      // Validate data structure before generating PDF
      if (!dto.data) {
        throw new BadRequestException('Data is required for PDF generation');
      }

      // Ensure summary exists and has safe defaults
      if (!dto.data.summary) {
        console.warn('[Service] No summary provided, using empty summary');
        dto.data.summary = {
          totalSales: 0,
          orderCount: 0,
          averageOrder: 0,
          discounts: 0,
          cancellations: 0,
          netProfit: 0,
        };
      }

      // Ensure orders array exists
      if (!Array.isArray(dto.data.orders)) {
        console.warn('[Service] Orders is not an array, converting to empty array');
        dto.data.orders = [];
      }

      // Sanitize orders - ensure all numeric fields are numbers
      dto.data.orders = dto.data.orders
        .map((order: any, index: number) => {
          if (!order || typeof order !== 'object') {
            console.warn(`[Service] Order ${index} is invalid, skipping`);
            return null;
          }

          // Ensure all numeric fields are valid numbers
          return {
            id: Number(order.id || 0),
            date: String(order.date || '-'),
            day: String(order.day || order.date || '-'),
            totalSales: Number(order.totalSales || 0),
            totalDiscounts: Number(order.totalDiscounts || 0),
            netProfit: Number(order.netProfit || 0),
            orderCount: Number(order.orderCount || 0),
            averageOrder: Number(order.averageOrder || 0),
          };
        })
        .filter((order: any): order is any => order !== null);

      // Sanitize summary - ensure all fields are numbers
      dto.data.summary = {
        totalSales: Number(dto.data.summary.totalSales || 0),
        orderCount: Number(dto.data.summary.orderCount || 0),
        averageOrder: Number(dto.data.summary.averageOrder || 0),
        discounts: Number(dto.data.summary.discounts || 0),
        cancellations: Number(dto.data.summary.cancellations || 0),
        netProfit: dto.data.summary.netProfit !== undefined ? Number(dto.data.summary.netProfit || 0) : undefined,
      };

      console.log('[Service] Data sanitized, calling generateReportPDF...');
      return await generateReportPDF(dto);
    } catch (error) {
      console.error('[Service] Error in generatePDF:', error);
      console.error('[Service] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack',
        dtoType: dto?.type,
      });
      throw error;
    }
  }

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

    // For daily reports, use business_day ranges; for others use calendar dates
    if (period === 'daily') {
      // Find business day that contains or matches the selected date
      // Get business day where start_at is on or before the selected date
      const businessDay = await this.db.get(
        `SELECT id, start_at, end_at, is_active 
         FROM business_days 
         WHERE DATE(start_at) = DATE(?) 
         ORDER BY start_at DESC 
         LIMIT 1`,
        [dateStr],
      );

      if (!businessDay || !businessDay.start_at) {
        // No business day found for this date - return empty
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
          employeeSummary: [],
          orders: [],
          cashDrawer: {
            openingBalance: 0,
            cashIn: 0,
            cashOut: 0,
            closingBalance: 0,
            variance: 0,
          },
        };
      }

      // Use business day start and end (or datetime('now') if still active)
      const startDate = businessDay.start_at;
      const endDate = businessDay.is_active === 1
        ? "datetime('now')"
        : (businessDay.end_at || "datetime('now')");

      // Get all completed orders in business day range
      return await this.fetchOrdersAndProcess(period, startDate, endDate);
    } else {
      // For weekly/monthly/yearly, use calendar date ranges
      const formatSQLiteDate = (d: Date): string => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      };

      if (period === 'weekly') {
        // For weekly reports, use business days instead of calendar dates
        // Get the last 7 business days (most recent first, then we'll reverse to show oldest first)
        const businessDays = await this.db.all(
          `SELECT id, start_at, end_at, is_active 
           FROM business_days 
           ORDER BY start_at DESC 
           LIMIT 7`,
        );

        if (!businessDays || businessDays.length === 0) {
          // No business days found - return empty report
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
            employeeSummary: [],
            orders: [], // Return empty array, not fake calendar days
          };
        }

        // Sort business days by start_at (oldest first) and limit to last 7
        const sortedBusinessDays = [...businessDays]
          .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
          .slice(-7); // Get last 7 business days

        // Process each business day and get its orders
        return this.processWeeklyBusinessDays(sortedBusinessDays);
      } else if (period === 'monthly') {
        // For monthly reports, use business days grouped into 4 weeks
        // Get all business days for the selected month
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1);
        monthEnd.setHours(0, 0, 0, 0);

        const monthStartStr = formatSQLiteDate(monthStart);
        const monthEndStr = formatSQLiteDate(monthEnd);

        const businessDays = await this.db.all(
          `SELECT id, start_at, end_at, is_active 
           FROM business_days 
           WHERE start_at >= ? AND start_at < ?
           ORDER BY start_at ASC`,
          [monthStartStr, monthEndStr],
        );

        if (!businessDays || businessDays.length === 0) {
          // No business days found - return empty report
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
            employeeSummary: [],
            orders: [],
          };
        }

        // Process business days and group them into 4 weeks
        return await this.processMonthlyWeeks(businessDays, monthStart);
      } else {
        // yearly - use business days grouped into 12 months
        const yearStart = new Date(date.getFullYear(), 0, 1);
        yearStart.setHours(0, 0, 0, 0);
        const yearEnd = new Date(date.getFullYear() + 1, 0, 1);
        yearEnd.setHours(0, 0, 0, 0);

        const yearStartStr = formatSQLiteDate(yearStart);
        const yearEndStr = formatSQLiteDate(yearEnd);

        const businessDays = await this.db.all(
          `SELECT id, start_at, end_at, is_active 
           FROM business_days 
           WHERE start_at >= ? AND start_at < ?
           ORDER BY start_at ASC`,
          [yearStartStr, yearEndStr],
        );

        if (!businessDays || businessDays.length === 0) {
          // No business days found - return empty report
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
            employeeSummary: [],
            orders: [],
          };
        }

        // Process business days and group them into 12 months
        return await this.processYearlyMonths(businessDays, date.getFullYear());
      }
    }
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
        employeeSummary: [],
        orders: [],
      };
    }

    // Process each business day and get its orders
    const businessDayData = await Promise.all(businessDays.map(async (businessDay) => {
      try {
        // For active business day, use datetime('now') as end, otherwise use end_at
        const endDate = businessDay.is_active === 1
          ? "datetime('now')"
          : (businessDay.end_at || "datetime('now')");

        // Query orders for this specific business day
        // Use parameterized query for start_at, but end_at might be datetime('now')
        const endDateCondition = endDate === "datetime('now')"
          ? "datetime('now')"
          : "?";

        const ordersQuery = `SELECT o.id, o.table_id, o.order_type, o.status, o.total, o.globalDiscount, 
              o.created_at, o.updated_at
           FROM orders o
           WHERE o.status = 'completed' 
             AND o.created_at >= ?
             AND o.created_at <= ${endDateCondition}`;

        const queryParams = endDate === "datetime('now')"
          ? [businessDay.start_at]
          : [businessDay.start_at, businessDay.end_at];

        console.log(`Querying orders for business day ${businessDay.id}:`, {
          start_at: businessDay.start_at,
          end_at: endDate,
          query: ordersQuery,
          params: queryParams,
        });

        const orders = await this.db.all(ordersQuery, queryParams);
        const ordersArray = orders || [];

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
          const orderTotalBeforeDiscount = (order.total || 0) + discountAmount;
          totalSales += orderTotalBeforeDiscount;
          totalDiscounts += discountAmount;
        });

        const orderCount = ordersArray.length;
        const averageOrder = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;
        const netProfit = totalSales - totalDiscounts;

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
          totalSales: Number(totalSales || 0),
          totalDiscounts: Number(totalDiscounts || 0),
          netProfit: Number(netProfit || 0),
          orderCount: Number(orderCount || 0),
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
    const netProfit = totalSales - totalDiscounts;

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
        ? "datetime('now')" 
        : (weekLatestEnd || "datetime('now')");

      const endDateCondition = weekEndDate === "datetime('now')"
        ? "datetime('now')"
        : "?";

      const ordersQuery = `SELECT o.id, o.total, o.globalDiscount
         FROM orders o
         WHERE o.status = 'completed' 
           AND o.created_at >= ?
           AND o.created_at <= ${endDateCondition}`;

      const queryParams = weekEndDate === "datetime('now')"
        ? [weekStartDate]
        : [weekStartDate, weekLatestEnd];

      try {
        const orders = await this.db.all(ordersQuery, queryParams) || [];
        
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
          const orderTotalBeforeDiscount = (order.total || 0) + discountAmount;
          totalSales += orderTotalBeforeDiscount;
          totalDiscounts += discountAmount;
        });

        const orderCount = orders.length;
        const averageOrder = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;
        const netProfit = totalSales - totalDiscounts;

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
      const netProfit = totalSales - totalDiscounts;

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
        ? "datetime('now')" 
        : (monthLatestEnd || "datetime('now')");

      const endDateCondition = monthEndDate === "datetime('now')"
        ? "datetime('now')"
        : "?";

      const ordersQuery = `SELECT o.id, o.total, o.globalDiscount
         FROM orders o
         WHERE o.status = 'completed' 
           AND o.created_at >= ?
           AND o.created_at <= ${endDateCondition}`;

      const queryParams = monthEndDate === "datetime('now')"
        ? [monthStartDate]
        : [monthStartDate, monthLatestEnd];

      try {
        const orders = await this.db.all(ordersQuery, queryParams) || [];
        
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
          const orderTotalBeforeDiscount = (order.total || 0) + discountAmount;
          totalSales += orderTotalBeforeDiscount;
          totalDiscounts += discountAmount;
        });

        const orderCount = orders.length;
        const averageOrder = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;
        const netProfit = totalSales - totalDiscounts;

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
      const netProfit = totalSales - totalDiscounts;

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
    const endDateCondition = endDate === "datetime('now')" 
      ? "datetime('now')" 
      : `'${endDate}'`;

    // Get all completed orders in date range
    // IMPORTANT: Select discount and globalDiscount columns for proper calculation
    const orders = await this.db.all(
      `SELECT o.id, o.table_id, o.order_type, o.status, o.total, o.globalDiscount, 
              o.created_at, o.updated_at, o.customer_name, o.customer_phone, o.customer_location
       FROM orders o
       WHERE o.status = 'completed' 
         AND o.created_at >= ? 
         AND o.created_at < ${endDateCondition}`,
      [startDate],
    ) || [];

    // Return empty report if no orders found
    if (orders.length === 0) {
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
    if (orderIds.length === 0) {
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
    const itemsQuery = orderIds.length > 0
      ? `SELECT oi.id, oi.order_id, oi.item_id, oi.item_name, oi.quantity, oi.price, oi.kitchen_id
         FROM order_items oi
         WHERE oi.order_id IN (${orderIds.join(',')})`
      : 'SELECT NULL as id, NULL as order_id, NULL as item_id, NULL as item_name, 0 as quantity, 0 as price, NULL as kitchen_id WHERE 1=0';

    const items = await this.db.all(itemsQuery) || [];

    // Calculate total sales and discounts properly
    // Use simplified logic: globalDiscount?.amount || 0
    let totalSalesBeforeDiscount = 0;
    let totalDiscounts = 0;

    orders.forEach((order: any) => {
      // Get discount amount from globalDiscount only
      let discountAmount = 0;
      
      if (order.globalDiscount) {
        try {
          const globalDiscount = typeof order.globalDiscount === 'string' 
            ? JSON.parse(order.globalDiscount) 
            : order.globalDiscount;
          discountAmount = globalDiscount?.amount || 0;
        } catch (e) {
          // Invalid JSON, skip
          discountAmount = 0;
        }
      }

      // Total sales = order.total + discountAmount (to get original amount before discount)
      const orderTotalBeforeDiscount = (order.total || 0) + discountAmount;
      totalSalesBeforeDiscount += orderTotalBeforeDiscount;
      totalDiscounts += discountAmount;
    });

    const orderCount = orders.length;
    const averageOrder = orderCount > 0 ? Math.round(totalSalesBeforeDiscount / orderCount) : 0;
    const cancellations = orders.filter((o) => o.status === 'cancelled').length;
    const netProfit = totalSalesBeforeDiscount - totalDiscounts;

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

    // Process shelf items from order_items
    const shelfItemsQuery = `SELECT oi.shelf_item_id, oi.item_name, oi.quantity, oi.price
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'completed'
        AND o.created_at >= ?
        AND o.created_at <= ?
        AND oi.shelf_item_id IS NOT NULL`;
    
    let shelfItems: any[] = [];
    try {
      shelfItems = await this.db.all(shelfItemsQuery, [startDate, endDate]) || [];
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

    // Generate graph data based on period
    const graphData = this.generateGraphData(period, startDate, endDate, orders);

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
        totalSales: totalSalesBeforeDiscount,
        totalDiscounts: totalDiscounts,
        netProfit: netProfit,
        orderCount: orderCount,
        averageOrder: averageOrder,
      }];
    } else {
      // For monthly/yearly, we still need to aggregate by day/week/month
      // But for now, return empty array since monthly/yearly should use different methods
      // This should not be reached for monthly/yearly as they use different processing
      ordersReport = [];
    }

    // Employee summary (placeholder - no employee tracking yet)
    const employeeSummary: any[] = [];

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
        totalSales: totalSalesBeforeDiscount,
        orderCount,
        averageOrder,
        discounts: totalDiscounts,
        cancellations,
        netProfit: netProfit,
      },
      graphData,
      itemsPerformance,
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
        
        // Calculate total sales including discounts for graph
        const value = hourOrders.reduce((sum, o: any) => {
          let discountAmount = 0;
          if (o.globalDiscount) {
            try {
              const globalDiscount = typeof o.globalDiscount === 'string' 
                ? JSON.parse(o.globalDiscount) 
                : o.globalDiscount;
              discountAmount = globalDiscount?.amount || 0;
            } catch (e) {
              // Invalid JSON
              discountAmount = 0;
            }
          }
          return sum + (o.total || 0) + discountAmount;
        }, 0);
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
        
        // Calculate total sales including discounts for graph
        const value = dayOrders.reduce((sum, o: any) => {
          let discountAmount = 0;
          if (o.globalDiscount) {
            try {
              const globalDiscount = typeof o.globalDiscount === 'string' 
                ? JSON.parse(o.globalDiscount) 
                : o.globalDiscount;
              discountAmount = globalDiscount?.amount || 0;
            } catch (e) {
              // Invalid JSON
              discountAmount = 0;
            }
          }
          return sum + (o.total || 0) + discountAmount;
        }, 0);
        
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
        
        // Calculate total sales including discounts for graph
        const value = weekOrders.reduce((sum, o: any) => {
          let discountAmount = 0;
          if (o.globalDiscount) {
            try {
              const globalDiscount = typeof o.globalDiscount === 'string' 
                ? JSON.parse(o.globalDiscount) 
                : o.globalDiscount;
              discountAmount = globalDiscount?.amount || 0;
            } catch (e) {
              // Invalid JSON
              discountAmount = 0;
            }
          }
          return sum + (o.total || 0) + discountAmount;
        }, 0);
        
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
        
        // Calculate total sales including discounts for graph
        const value = monthOrders.reduce((sum, o: any) => {
          let discountAmount = 0;
          if (o.globalDiscount) {
            try {
              const globalDiscount = typeof o.globalDiscount === 'string' 
                ? JSON.parse(o.globalDiscount) 
                : o.globalDiscount;
              discountAmount = globalDiscount?.amount || 0;
            } catch (e) {
              // Invalid JSON
              discountAmount = 0;
            }
          }
          return sum + (o.total || 0) + discountAmount;
        }, 0);
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

      const orderTotalBeforeDiscount = (order.total || 0) + discountAmount;
      
      const dayData = dailyMap.get(dayKey);
      if (dayData) {
        dayData.totalSales += orderTotalBeforeDiscount;
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
        const orderTotalBeforeDiscount = (order.total || 0) + discountAmount;
        totalSales += orderTotalBeforeDiscount;
        totalDiscounts += discountAmount;
      });

      const orderCount = dayOrders.length;
      const averageOrder = orderCount > 0 ? Math.round(totalSales / orderCount) : 0;
      const netProfit = totalSales - totalDiscounts;

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
}



