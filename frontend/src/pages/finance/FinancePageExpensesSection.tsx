'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrderLocale } from '../../hooks/useOrderLocale';
import { formatCurrency } from '../../lib/finance/utils';
import type { Expense } from '../../lib/finance/types';
import FinancePageExpensesFilters from './FinancePageExpensesFilters';
import FinancePageExpenseTableRow from './FinancePageExpenseTableRow';
import {
  DEFAULT_EXPENSE_TABLE_FILTERS,
  EXPENSE_GROUP_ORDER,
  filterExpensesForTable,
  groupExpensesByGroup,
  type ExpenseTableFiltersState,
} from '../../lib/finance/expense-groups';
import { tExpenseGroup } from '../../lib/finance/expense-i18n';

interface FinancePageExpensesSectionProps {
  expenses: Expense[];
  users: Array<{ id: number; username: string; role: string }>;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: number) => void;
  onOpenExpenseForm: () => void;
}

export default function FinancePageExpensesSection({
  expenses,
  users,
  onEditExpense,
  onDeleteExpense,
  onOpenExpenseForm,
}: FinancePageExpensesSectionProps) {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();
  const [tableFilters, setTableFilters] = useState<ExpenseTableFiltersState>(DEFAULT_EXPENSE_TABLE_FILTERS);

  const filtered = useMemo(() => filterExpensesForTable(expenses, tableFilters), [expenses, tableFilters]);
  const grouped = useMemo(() => groupExpensesByGroup(filtered), [filtered]);

  const filteredTotal = useMemo(() => filtered.reduce((s, e) => s + (Number(e.amount) || 0), 0), [filtered]);

  const tableHead = (
    <thead>
      <tr className="border-b border-black/10 bg-slate-100/90">
        <th className="px-4 py-3 text-right text-[15px] font-bold text-obsidian">{t('finance.colDate')}</th>
        <th className="px-4 py-3 text-right text-[15px] font-bold text-obsidian">{t('finance.tableCategory')}</th>
        <th className="px-4 py-3 text-right text-[15px] font-bold text-obsidian">{t('finance.tableAmount')}</th>
        <th className="px-4 py-3 text-right text-[15px] font-bold text-obsidian">{t('finance.tableNotes')}</th>
        <th className="px-4 py-3 text-right text-[15px] font-bold text-obsidian">{t('finance.tableActions')}</th>
      </tr>
    </thead>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[20px] font-semibold text-obsidian">{t('finance.expensesSectionTitle')}</h3>
          <button type="button" onClick={onOpenExpenseForm} className="btn-primary">
            {t('finance.addExpense')}
          </button>
        </div>

        <FinancePageExpensesFilters filters={tableFilters} onChange={setTableFilters} />

        {expenses.length > 0 && (
          <p className="mb-4 text-[14px] text-obsidian/65">
            {t('finance.expensesShowCount', { filtered: filtered.length, total: expenses.length })}
            {filtered.length > 0 &&
              t('finance.expensesFilteredTotal', { amount: formatCurrency(filteredTotal, numberLocale) })}
          </p>
        )}

        {expenses.length === 0 ? (
          <div className="rounded-lg border border-black/10 py-12 text-center text-[15px] text-obsidian/60">
            {t('finance.noDataShort')}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 py-10 text-center text-[15px] text-amber-900/90">
            {t('finance.noExpensesMatchFilter')}
          </div>
        ) : (
          <div className="space-y-8">
            {EXPENSE_GROUP_ORDER.map((group) => {
              const rows = grouped.get(group) ?? [];
              const subtotal = rows.reduce((s, e) => s + (Number(e.amount) || 0), 0);
              if (rows.length === 0) return null;

              return (
                <div key={group} className="overflow-hidden rounded-xl border border-black/10">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 bg-cloud-soft-white px-4 py-3">
                    <h4 className="text-[17px] font-bold text-obsidian">{tExpenseGroup(group, t)}</h4>
                    <span className="text-[14px] text-obsidian/70">
                      {t('finance.expenseGroupSubtotal', {
                        count: rows.length,
                        amount: formatCurrency(subtotal, numberLocale),
                      })}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px]">
                      {tableHead}
                      <tbody>
                        {rows.map((exp) => (
                          <FinancePageExpenseTableRow
                            key={exp.id}
                            exp={exp}
                            users={users}
                            onEdit={onEditExpense}
                            onDelete={onDeleteExpense}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
