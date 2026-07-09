export type FinancePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RevenueData {
  id: number;
  business_day_id?: number | null;
  date: string;
  type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'extra';
  amount: number;
  notes?: string | null;
  order_count?: number | null;
  created_at: string;
}

export interface ExpenseData {
  id: number;
  business_day_id?: number | null;
  date: string;
  category: string;
  amount: number;
  notes?: string | null;
  user_id?: number | null;
  is_recurring?: boolean;
  recurrence_type?: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  recurrence_interval?: number | null;
  next_occurrence_date?: string | null;
  created_at: string;
}

export interface CashFlowData {
  id: number;
  business_day_id?: number | null;
  date: string;
  type: 'in' | 'out';
  reason: string;
  amount: number;
  linked_order_id?: number | null;
  created_at: string;
}

export interface ProfitSummary {
  period: FinancePeriod;
  from: string;
  to: string;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
}

export interface FinanceExportData {
  period: FinancePeriod;
  from: string;
  to: string;
  revenues: RevenueData[];
  expenses: ExpenseData[];
  cashFlow: CashFlowData[];
  profit: ProfitSummary;
}

export class ExportFinanceDto {
  type!: FinancePeriod;
  from!: string;
  to!: string;
  data!: FinanceExportData;
}
