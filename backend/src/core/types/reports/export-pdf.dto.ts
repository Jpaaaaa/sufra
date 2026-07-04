export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ReportSummary {
  totalSales: number;
  orderCount: number;
  averageOrder: number;
  discounts: number;
  cancellations: number;
  netProfit?: number;
}

export interface ItemPerformance {
  id: number;
  name: string;
  quantitySold: number;
  totalSales: number;
  movementStatus: 'high' | 'medium' | 'low';
}

export interface EmployeeSummary {
  id: number;
  name: string;
  ordersHandled: number;
  totalSales: number;
  cancellations: number;
  avgOrderValue: number;
}

// OLD OrderReport structure - DEPRECATED, use DailyAggregate instead
export interface OrderReport {
  id: number;
  openTime: string;
  closeTime: string | null;
  itemCount: number;
  totalAmount: number;
  status: 'pending' | 'printed' | 'completed' | 'cancelled';
  employee: string;
}

// NEW DailyAggregate structure - used for daily/weekly/monthly/yearly reports
export interface DailyAggregate {
  id: number;
  date: string;
  day: string;
  totalSales: number;
  totalDiscounts: number;
  netProfit: number;
  orderCount: number;
  averageOrder: number;
}

export interface CashDrawerData {
  openingBalance: number;
  cashIn: number;
  cashOut: number;
  closingBalance: number;
  variance: number;
}

export interface ReportData {
  summary: ReportSummary;
  items: ItemPerformance[];
  employees: EmployeeSummary[];
  orders: DailyAggregate[]; // Changed from OrderReport[] to DailyAggregate[]
  drawer?: CashDrawerData;
}

export class ExportPdfDto {
  type!: ReportPeriod;
  date!: string;
  data!: ReportData;
}

