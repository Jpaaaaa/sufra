import type { TFunction } from 'i18next';
import type { ExpenseGroup } from './expense-groups';

/** Maps API category codes to nested i18n keys (no spaces). */
const CATEGORY_KEY: Record<string, string> = {
  Salaries: 'Salaries',
  Rent: 'Rent',
  Electricity: 'Electricity',
  Water: 'Water',
  Internet: 'Internet',
  Ingredients: 'Ingredients',
  Packaging: 'Packaging',
  'Cleaning supplies': 'CleaningSupplies',
  Maintenance: 'Maintenance',
  Marketing: 'Marketing',
  Other: 'Other',
};

export function tExpenseCategory(cat: string, t: TFunction): string {
  const slug = CATEGORY_KEY[cat] ?? cat;
  return t(`finance.expenseCategory.${slug}`, cat);
}

export function tExpenseGroup(group: ExpenseGroup, t: TFunction): string {
  return t(`finance.expenseGroup.${group}`);
}
