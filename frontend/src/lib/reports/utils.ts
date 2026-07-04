import { ReportPeriod, ReportData, ReportFilters } from './types';
import { getServerUrl, fetchJson } from '../../utils';

/**
 * Fetch real reports data from backend API
 */
export async function fetchReports(
  period: ReportPeriod,
  date: Date,
  _filters?: ReportFilters,
): Promise<ReportData> {
  try {
    const serverUrl = getServerUrl();
    // Use local date (not UTC) so daily report matches user's timezone
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    const data = await fetchJson<ReportData>(
      `${serverUrl}/reports/data?period=${period}&date=${dateStr}`
    );

    return data;
  } catch (error) {
    console.error('Failed to fetch reports:', error);
    // Return empty data structure on error
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
}


/**
 * Format number as currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ar-IQ', {
    style: 'currency',
    currency: 'IQD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date based on period - numeric format only (DD/MM/YYYY)
 */
export function formatDateForPeriod(date: Date, period: ReportPeriod): string {
  // Format as numeric date (DD/MM/YYYY)
  const formatNumericDate = (d: Date): string => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1);
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };
  
  if (period === 'daily') {
    return formatNumericDate(date);
  } else if (period === 'weekly') {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `${formatNumericDate(weekStart)} - ${formatNumericDate(weekEnd)}`;
  } else if (period === 'monthly') {
    // For monthly, show month number and year
    const month = String(date.getMonth() + 1);
    const year = date.getFullYear();
    return `${month}/${year}`;
  } else {
    // For yearly, just show year
    return String(date.getFullYear());
  }
}

