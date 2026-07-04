import type { Expense } from './types';

/** Group codes: labels come from i18n `finance.expenseGroup.*` */
export type ExpenseGroup = 'operational' | 'materials' | 'administration';

/** Display order in the grouped expense table */
export const EXPENSE_GROUP_ORDER: ExpenseGroup[] = ['operational', 'materials', 'administration'];

const MATERIALS = new Set(['Ingredients', 'Packaging']);
const ADMIN = new Set(['Salaries', 'Rent', 'Marketing', 'Other']);

export function getExpenseGroup(category: string): ExpenseGroup {
  if (MATERIALS.has(category)) return 'materials';
  if (ADMIN.has(category)) return 'administration';
  return 'operational';
}

export interface ExpenseTableFiltersState {
  category: string;
  month: string;
  amountMin: string;
  amountMax: string;
  recurring: 'all' | 'yes' | 'no';
}

export const DEFAULT_EXPENSE_TABLE_FILTERS: ExpenseTableFiltersState = {
  category: '',
  month: '',
  amountMin: '',
  amountMax: '',
  recurring: 'all',
};

export function filterExpensesForTable(
  expenses: Expense[],
  f: ExpenseTableFiltersState,
): Expense[] {
  return expenses.filter((exp) => {
    if (f.category && exp.category !== f.category) return false;
    if (f.month && !exp.date.startsWith(f.month)) return false;
    const amt = Number(exp.amount);
    if (f.amountMin !== '' && !Number.isNaN(Number(f.amountMin)) && amt < Number(f.amountMin)) {
      return false;
    }
    if (f.amountMax !== '' && !Number.isNaN(Number(f.amountMax)) && amt > Number(f.amountMax)) {
      return false;
    }
    if (f.recurring === 'yes' && !exp.is_recurring) return false;
    if (f.recurring === 'no' && exp.is_recurring) return false;
    return true;
  });
}

export function groupExpensesByGroup(expenses: Expense[]): Map<ExpenseGroup, Expense[]> {
  const map = new Map<ExpenseGroup, Expense[]>();
  for (const g of EXPENSE_GROUP_ORDER) map.set(g, []);
  for (const exp of expenses) {
    const g = getExpenseGroup(exp.category);
    map.get(g)!.push(exp);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  }
  return map;
}
