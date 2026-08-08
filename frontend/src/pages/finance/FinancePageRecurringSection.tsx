'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrderLocale } from '../../hooks/useOrderLocale';
import { formatCurrency, formatDate } from '../../lib/finance/utils';
import type { Expense } from '../../lib/finance/types';
import { tExpenseCategory } from '../../lib/finance/expense-i18n';

interface FinancePageRecurringSectionProps {
  expenses: Expense[];
  users: Array<{ id: number; username: string; role: string }>;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: number) => void;
  onStopRecurring: (expense: Expense) => void;
  onOpenExpenseForm: () => void;
}

function recurrenceLabel(
  exp: Expense,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const typeKey =
    exp.recurrence_type === 'daily'
      ? 'finance.recurrenceDaily'
      : exp.recurrence_type === 'weekly'
        ? 'finance.recurrenceWeekly'
        : exp.recurrence_type === 'monthly'
          ? 'finance.recurrenceMonthly'
          : exp.recurrence_type === 'yearly'
            ? 'finance.recurrenceYearly'
            : null;
  const typeLabel = typeKey ? t(typeKey) : '—';
  const interval = Number(exp.recurrence_interval) > 0 ? Number(exp.recurrence_interval) : 1;
  if (interval === 1) return typeLabel;
  return t('finance.recurrenceEveryN', { count: interval, type: typeLabel });
}

export default function FinancePageRecurringSection({
  expenses,
  users,
  onEditExpense,
  onDeleteExpense,
  onStopRecurring,
  onOpenExpenseForm,
}: FinancePageRecurringSectionProps) {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();

  const total = useMemo(
    () => expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [expenses],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[20px] font-semibold text-obsidian">
              {t('finance.recurringSectionTitle')}
            </h3>
            <p className="mt-1 text-[14px] text-obsidian/60">{t('finance.recurringSectionHint')}</p>
          </div>
          <button type="button" onClick={onOpenExpenseForm} className="btn-primary">
            {t('finance.addRecurringExpense')}
          </button>
        </div>

        {expenses.length > 0 && (
          <p className="mb-4 text-[14px] text-obsidian/65">
            {t('finance.recurringShowCount', { count: expenses.length })}
            {t('finance.recurringMonthlyLikeTotal', {
              amount: formatCurrency(total, numberLocale),
            })}
          </p>
        )}

        {expenses.length === 0 ? (
          <div className="rounded-lg border border-black/10 py-12 text-center text-[15px] text-obsidian/60">
            {t('finance.recurringEmpty')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/10">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-black/10 bg-slate-100/90">
                  <th className="px-4 py-3 text-right text-[15px] font-bold text-obsidian">
                    {t('finance.tableCategory')}
                  </th>
                  <th className="px-4 py-3 text-right text-[15px] font-bold text-obsidian">
                    {t('finance.tableAmount')}
                  </th>
                  <th className="px-4 py-3 text-right text-[15px] font-bold text-obsidian">
                    {t('finance.formRecurrenceType')}
                  </th>
                  <th className="px-4 py-3 text-right text-[15px] font-bold text-obsidian">
                    {t('finance.colNextOccurrence')}
                  </th>
                  <th className="px-4 py-3 text-right text-[15px] font-bold text-obsidian">
                    {t('finance.tableNotes')}
                  </th>
                  <th className="px-4 py-3 text-right text-[15px] font-bold text-obsidian">
                    {t('finance.tableActions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id} className="border-b border-black/5 hover:bg-cloud-soft-white/50">
                    <td className="px-4 py-3 text-[15px] text-obsidian">
                      {tExpenseCategory(exp.category, t)}
                      {exp.category === 'Salaries' && exp.user_id && (
                        <span className="mr-2 text-[13px] text-obsidian/60">
                          ({users.find((u) => u.id === exp.user_id)?.username || `ID: ${exp.user_id}`})
                        </span>
                      )}
                      <div className="mt-0.5 text-[12px] text-obsidian/45">
                        {t('finance.recurringStarted', { date: formatDate(exp.date) })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[15px] font-bold tabular-nums text-obsidian">
                      {formatCurrency(exp.amount, numberLocale)}
                    </td>
                    <td className="px-4 py-3 text-[15px] text-obsidian">{recurrenceLabel(exp, t)}</td>
                    <td className="px-4 py-3 text-[15px] text-obsidian">
                      {exp.next_occurrence_date ? formatDate(exp.next_occurrence_date) : '—'}
                    </td>
                    <td className="px-4 py-3 text-[15px] text-obsidian/60">
                      {exp.notes?.trim() ? exp.notes : '—'}
                    </td>
                    <td className="px-4 py-3 text-[14px]">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <button
                          type="button"
                          onClick={() => onEditExpense(exp)}
                          className="text-cyber-aqua hover:underline"
                        >
                          {t('finance.edit')}
                        </button>
                        <span className="text-obsidian/20">|</span>
                        <button
                          type="button"
                          onClick={() => onStopRecurring(exp)}
                          className="text-amber-700 hover:underline"
                        >
                          {t('finance.stopRecurring')}
                        </button>
                        <span className="text-obsidian/20">|</span>
                        <button
                          type="button"
                          onClick={() => onDeleteExpense(exp.id)}
                          className="text-red-600 hover:underline"
                        >
                          {t('finance.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
