'use client';

import { useTranslation } from 'react-i18next';
import { useOrderLocale } from '../../hooks/useOrderLocale';
import { formatDate, formatCurrency } from '../../lib/finance/utils';
import type { Expense } from '../../lib/finance/types';
import { tExpenseCategory } from '../../lib/finance/expense-i18n';

interface FinancePageExpenseTableRowProps {
  exp: Expense;
  users: Array<{ id: number; username: string; role: string }>;
  onEdit: (expense: Expense) => void;
  onDelete: (id: number) => void;
}

export default function FinancePageExpenseTableRow({
  exp,
  users,
  onEdit,
  onDelete,
}: FinancePageExpenseTableRowProps) {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();

  return (
    <tr className="border-b border-black/5 hover:bg-cloud-soft-white/50">
      <td className="px-4 py-3 text-[15px] text-obsidian">{formatDate(exp.date)}</td>
      <td className="px-4 py-3 text-[15px] text-obsidian">
        <div className="flex flex-wrap items-center gap-2">
          <span>
            {tExpenseCategory(exp.category, t)}
            {exp.category === 'Salaries' && exp.user_id && (
              <span className="mr-2 text-[13px] text-obsidian/60">
                ({users.find((u) => u.id === exp.user_id)?.username || `ID: ${exp.user_id}`})
              </span>
            )}
          </span>
          {exp.is_recurring && (
            <span className="flex items-center gap-1 rounded-full bg-cyber-aqua/10 px-2 py-0.5 text-[12px] text-cyber-aqua">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {t('finance.recurringBadge')}
            </span>
          )}
        </div>
        {exp.is_recurring && exp.next_occurrence_date && (
          <div className="mt-1 text-[12px] text-obsidian/50">
            {t('finance.nextOccurrence', { date: formatDate(exp.next_occurrence_date) })}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-[15px] font-bold tabular-nums text-obsidian">
        {formatCurrency(exp.amount, numberLocale)}
      </td>
      <td className="px-4 py-3 text-[15px] text-obsidian/60">{exp.notes?.trim() ? exp.notes : '—'}</td>
      <td className="px-4 py-3 text-[15px]">
        <button type="button" onClick={() => onEdit(exp)} className="text-cyber-aqua hover:underline">
          {t('finance.edit')}
        </button>
        <span className="mx-2 text-obsidian/20">|</span>
        <button type="button" onClick={() => onDelete(exp.id)} className="text-red-600 hover:underline">
          {t('finance.delete')}
        </button>
      </td>
    </tr>
  );
}
