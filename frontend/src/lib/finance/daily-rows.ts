import type { TFunction } from 'i18next';
import type { Expense, Revenue } from './types';
import { tExpenseCategory } from './expense-i18n';

export interface FinanceDailyRow {
  date: string;
  details: string;
  revenue: number;
  expenses: number;
  total: number;
}

function dateKey(value: string): string {
  return (value || '').slice(0, 10);
}

function buildDetails(
  dayRevenues: Revenue[],
  dayExpenses: Expense[],
  t: TFunction,
): string {
  const parts: string[] = [];

  const revenueNotes = [
    ...new Set(
      dayRevenues
        .map((r) => r.notes?.trim())
        .filter((n): n is string => Boolean(n)),
    ),
  ];
  if (revenueNotes.length > 0) {
    parts.push(revenueNotes.join('، '));
  } else if (dayRevenues.some((r) => (Number(r.amount) || 0) > 0)) {
    parts.push(t('finance.detailsFromOrders'));
  }

  const categories = [
    ...new Set(dayExpenses.map((e) => tExpenseCategory(e.category, t))),
  ];
  if (categories.length > 0) {
    parts.push(categories.join('، '));
  }

  return parts.length > 0 ? parts.join(' · ') : '—';
}

/** One row per calendar day: sum revenues & expenses, net total. */
export function buildFinanceDailyRows(
  revenues: Revenue[],
  expenses: Expense[],
  t: TFunction,
): FinanceDailyRow[] {
  const dates = new Set<string>();
  for (const r of revenues) {
    const key = dateKey(r.date);
    if (key) dates.add(key);
  }
  for (const e of expenses) {
    const key = dateKey(e.date);
    if (key) dates.add(key);
  }

  const sorted = [...dates].sort((a, b) => b.localeCompare(a));

  return sorted.map((date) => {
    const dayRevenues = revenues.filter((r) => dateKey(r.date) === date);
    const dayExpenses = expenses.filter((e) => dateKey(e.date) === date);
    const revenue = dayRevenues.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const expenseTotal = dayExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    return {
      date,
      details: buildDetails(dayRevenues, dayExpenses, t),
      revenue,
      expenses: expenseTotal,
      total: revenue - expenseTotal,
    };
  });
}
