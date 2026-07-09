export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface SalesByType {
  dineIn: number;
  pickup: number;
  delivery: number;
}

export interface ReportSummary {
  totalSales: number;
  orderCount: number;
  averageOrder: number;
  discounts: number;
  cancellations: number;
  netProfit?: number;
  salesByType?: SalesByType;
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

export interface OrderReport {
  id: number;
  openTime: string;
  closeTime: string | null;
  itemCount: number;
  totalAmount: number;
  status: 'pending' | 'printed' | 'completed' | 'cancelled';
  employee: string;
}

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
  orders: DailyAggregate[];
  drawer?: CashDrawerData;
}

export class ExportPdfDto {
  type!: ReportPeriod;
  date!: string;
  data!: ReportData;
  branchName?: string;
  userName?: string;
  comparedToYesterday?: number;
}
