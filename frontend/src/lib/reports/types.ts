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
  /** Sales broken down by order type (dine-in, pickup, delivery) */
  salesByType?: SalesByType;
}

export interface GraphDataPoint {
  label: string;
  value: number;
  timestamp: string;
}

export interface ItemPerformance {
  id: number;
  name: string;
  quantitySold: number;
  totalSales: number;
  movementStatus: 'high' | 'medium' | 'low';
}

/** أصناف القائمة الظاهرة في نقطة البيع ولم تُبع في الفترة */
export interface UnsoldMenuItem {
  id: number;
  name: string;
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
  day: string;
  date: string;
  totalSales: number;
  orderCount: number;
  averageOrder: number;
  totalDiscounts: number;
  netProfit: number;
}

export interface CashDrawerData {
  openingBalance: number;
  cashIn: number;
  cashOut: number;
  closingBalance: number;
  variance: number;
}

export interface ReportFilters {
  employeeId?: number;
  itemId?: number;
  orderStatus?: 'pending' | 'printed' | 'completed' | 'cancelled';
}

export interface ShiftBreakdownRow {
  shiftId: number | null;
  shiftName: string;
  startTime: string | null;
  endTime: string | null;
  totalSales: number;
  orderCount: number;
  averageOrder: number;
}

export interface ReportData {
  summary: ReportSummary;
  graphData: GraphDataPoint[];
  itemsPerformance: ItemPerformance[];
  /** أصناف القائمة بدون أي مبيعات في نفس الفترة (غير المخفية من القائمة) */
  unsoldMenuItems?: UnsoldMenuItem[];
  employeeSummary: EmployeeSummary[];
  orders: OrderReport[] | DailyAggregate[];
  cashDrawer?: CashDrawerData;
  /** Per-shift totals when shift_mode is multi (daily reports) */
  shiftBreakdown?: ShiftBreakdownRow[];
  /** Per-day shift breakdown for daily/weekly/monthly multi mode */
  shiftBreakdownByDay?: Record<string, ShiftBreakdownRow[]>;
  /** Per-month → per-day shift breakdown for yearly multi mode */
  shiftBreakdownByMonth?: Record<string, Record<string, ShiftBreakdownRow[]>>;
  /** Shift totals across the whole report period */
  shiftBreakdownTotals?: ShiftBreakdownRow[];
}

