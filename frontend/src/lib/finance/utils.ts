import {
  Revenue,
  Expense,
  CashFlow,
  ProfitSummary,
  FinanceFilters,
  FinancePeriod,
} from './types';

import { getServerUrl } from '../server-config';
import { fetchJson } from '../../utils';

// ============ REVENUE ============

export async function fetchRevenues(filters?: FinanceFilters): Promise<Revenue[]> {
  const params = new URLSearchParams();
  if (filters?.from) params.append('from', filters.from);
  if (filters?.to) params.append('to', filters.to);
  if (filters?.type) params.append('type', filters.type);

  const serverUrl = getServerUrl();
  return fetchJson<Revenue[]>(`${serverUrl}/finance/revenue?${params.toString()}`);
}

export async function createRevenue(data: {
  date: string;
  type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'extra';
  amount: number;
  notes?: string | null;
}): Promise<Revenue> {
  const serverUrl = getServerUrl();
  return fetchJson<Revenue>(`${serverUrl}/finance/revenue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function syncRevenue(date?: string): Promise<Revenue | null> {
  const serverUrl = getServerUrl();
  const dateVal = date ?? new Date().toISOString().split('T')[0];
  return fetchJson<Revenue | null>(`${serverUrl}/finance/revenue/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: dateVal }),
  });
}

// ============ EXPENSES ============

export async function fetchExpenses(filters?: FinanceFilters): Promise<Expense[]> {
  const params = new URLSearchParams();
  if (filters?.from) params.append('from', filters.from);
  if (filters?.to) params.append('to', filters.to);
  if (filters?.category) params.append('category', filters.category);

  const serverUrl = getServerUrl();
  return fetchJson<Expense[]>(`${serverUrl}/finance/expenses?${params.toString()}`);
}

export async function createExpense(data: {
  date: string;
  category: string;
  amount: number;
  notes?: string | null;
  user_id?: number | null;
}): Promise<Expense> {
  const serverUrl = getServerUrl();
  return fetchJson<Expense>(`${serverUrl}/finance/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateExpense(
  id: number,
  data: {
    date?: string;
    category?: string;
    amount?: number;
    notes?: string | null;
    user_id?: number | null;
  },
): Promise<Expense> {
  const serverUrl = getServerUrl();
  return fetchJson<Expense>(`${serverUrl}/finance/expenses/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteExpense(id: number): Promise<void> {
  const serverUrl = getServerUrl();
  await fetchJson<void>(`${serverUrl}/finance/expenses/${id}`, {
    method: 'DELETE',
  });
}

// ============ CASH FLOW ============

export async function fetchCashFlow(filters?: FinanceFilters): Promise<CashFlow[]> {
  const params = new URLSearchParams();
  if (filters?.from) params.append('from', filters.from);
  if (filters?.to) params.append('to', filters.to);
  if (filters?.type) params.append('type', filters.type);

  const serverUrl = getServerUrl();
  return fetchJson<CashFlow[]>(`${serverUrl}/finance/cashflow?${params.toString()}`);
}

export async function createCashFlow(data: {
  date: string;
  type: 'in' | 'out';
  reason: string;
  amount: number;
  linked_order_id?: number | null;
}): Promise<CashFlow> {
  const serverUrl = getServerUrl();
  return fetchJson<CashFlow>(`${serverUrl}/finance/cashflow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function syncCashFlow(date?: string): Promise<void> {
  const serverUrl = getServerUrl();
  const dateVal = date ?? new Date().toISOString().split('T')[0];
  await fetchJson<void>(`${serverUrl}/finance/cashflow/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: dateVal }),
  });
}

// ============ PROFIT & LOSS ============

export async function fetchProfitAndLoss(filters?: {
  from?: string;
  to?: string;
}): Promise<ProfitSummary> {
  const params = new URLSearchParams();
  if (filters?.from) params.append('from', filters.from);
  if (filters?.to) params.append('to', filters.to);

  const serverUrl = getServerUrl();
  return fetchJson<ProfitSummary>(`${serverUrl}/finance/profit?${params.toString()}`);
}

// ============ EXPORT ============

export async function exportFinancePDF(data: {
  type: FinancePeriod;
  from: string;
  to: string;
  data: {
    revenues: Revenue[];
    expenses: Expense[];
    cashFlow: CashFlow[];
    profit: ProfitSummary;
  };
}): Promise<Blob> {
  const serverUrl = getServerUrl();
  const token = typeof window !== 'undefined' ? localStorage.getItem('sufra_auth_token') : null;
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${serverUrl}/finance/export/pdf`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to export PDF');
  return response.blob();
}

export async function exportFinanceExcel(data: {
  type: FinancePeriod;
  from: string;
  to: string;
  data: {
    revenues: Revenue[];
    expenses: Expense[];
    cashFlow: CashFlow[];
    profit: ProfitSummary;
  };
}): Promise<Blob> {
  const serverUrl = getServerUrl();
  const token = typeof window !== 'undefined' ? localStorage.getItem('sufra_auth_token') : null;
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${serverUrl}/finance/export/excel`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to export Excel');
  return response.blob();
}

// ============ FORMATTING ============

export function formatCurrency(amount: number, locale: string = 'ar-IQ'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'IQD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  // Format as numeric date (DD/MM/YYYY)
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

