export type FinancePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Revenue {
  id: number;
  date: string; // Calendar date (YYYY-MM-DD)
  type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'extra';
  amount: number;
  notes?: string | null;
  /** From order sync; manual rows often omit */
  order_count?: number | null;
  created_at: string;
}

export interface Expense {
  id: number;
  date: string; // Calendar date (YYYY-MM-DD)
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

export interface CashFlow {
  id: number;
  date: string; // Calendar date (YYYY-MM-DD)
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

export interface FinanceFilters {
  from?: string;
  to?: string;
  type?: string;
  category?: string;
}

export const EXPENSE_CATEGORIES = [
  'Salaries',
  'Rent',
  'Electricity',
  'Water',
  'Internet',
  'Ingredients',
  'Packaging',
  'Cleaning supplies',
  'Maintenance',
  'Marketing',
  'Other',
] as const;

/** English fallbacks; UI uses `tExpenseCategory` + `finance.expenseCategory.*` */
export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  Salaries: 'Salaries',
  Rent: 'Rent',
  Electricity: 'Electricity',
  Water: 'Water',
  Internet: 'Internet',
  Ingredients: 'Ingredients',
  Packaging: 'Packaging',
  'Cleaning supplies': 'Cleaning supplies',
  Maintenance: 'Maintenance',
  Marketing: 'Marketing',
  Other: 'Other',
};

export const REVENUE_TYPE_LABELS: Record<string, string> = {
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
  yearly: 'yearly',
  extra: 'extra',
};

