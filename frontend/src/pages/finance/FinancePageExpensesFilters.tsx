'use client';

import { useTranslation } from 'react-i18next';
import { EXPENSE_CATEGORIES } from '../../lib/finance/types';
import {
  EXPENSE_GROUP_ORDER,
  getExpenseGroup,
  type ExpenseGroup,
  type ExpenseTableFiltersState,
} from '../../lib/finance/expense-groups';
import { tExpenseCategory, tExpenseGroup } from '../../lib/finance/expense-i18n';
import { useGlobalNumericField } from '../../contexts/GlobalNumericKeypadContext';

interface FinancePageExpensesFiltersProps {
  filters: ExpenseTableFiltersState;
  onChange: (next: ExpenseTableFiltersState) => void;
}

function categoriesForGroup(group: ExpenseGroup): readonly string[] {
  return EXPENSE_CATEGORIES.filter((c) => getExpenseGroup(c) === group);
}

export default function FinancePageExpensesFilters({ filters, onChange }: FinancePageExpensesFiltersProps) {
  const { t } = useTranslation();
  const patch = (partial: Partial<ExpenseTableFiltersState>) => onChange({ ...filters, ...partial });

  const amountMinField = useGlobalNumericField(filters.amountMin, (next) =>
    patch({ amountMin: next.replace(/[^0-9.]/g, '') }),
  );
  const amountMaxField = useGlobalNumericField(filters.amountMax, (next) =>
    patch({ amountMax: next.replace(/[^0-9.]/g, '') }),
  );

  return (
    <div className="mb-6 rounded-soft-lg border border-black/10 bg-slate-50/80 p-4">
      <p className="mb-3 text-[14px] font-semibold text-obsidian">{t('finance.filterTableTitle')}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div>
          <label className="mb-1 block text-[13px] text-obsidian/70">{t('finance.filterCategory')}</label>
          <select
            value={filters.category}
            onChange={(e) => patch({ category: e.target.value })}
            className="input-soft w-full text-[14px]"
          >
            <option value="">{t('finance.filterAllCategories')}</option>
            {EXPENSE_GROUP_ORDER.map((g) => (
              <optgroup key={g} label={tExpenseGroup(g, t)}>
                {categoriesForGroup(g).map((cat) => (
                  <option key={cat} value={cat}>
                    {tExpenseCategory(cat, t)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[13px] text-obsidian/70">{t('finance.filterMonth')}</label>
          <input
            type="month"
            value={filters.month}
            onChange={(e) => patch({ month: e.target.value })}
            className="input-soft w-full text-[14px]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] text-obsidian/70">{t('finance.filterAmountFrom')}</label>
          <input
            type="text"
            inputMode="decimal"
            value={filters.amountMin}
            onChange={(e) => patch({ amountMin: e.target.value.replace(/[^0-9.]/g, '') })}
            onFocus={amountMinField.onFocus}
            placeholder="0"
            className="input-soft w-full text-[14px]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] text-obsidian/70">{t('finance.filterAmountTo')}</label>
          <input
            type="text"
            inputMode="decimal"
            value={filters.amountMax}
            onChange={(e) => patch({ amountMax: e.target.value.replace(/[^0-9.]/g, '') })}
            onFocus={amountMaxField.onFocus}
            placeholder="∞"
            className="input-soft w-full text-[14px]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] text-obsidian/70">{t('finance.filterRecurring')}</label>
          <select
            value={filters.recurring}
            onChange={(e) => patch({ recurring: e.target.value as ExpenseTableFiltersState['recurring'] })}
            className="input-soft w-full text-[14px]"
          >
            <option value="all">{t('finance.filterRecurringAll')}</option>
            <option value="yes">{t('finance.filterRecurringYes')}</option>
            <option value="no">{t('finance.filterRecurringNo')}</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => onChange({ category: '', month: '', amountMin: '', amountMax: '', recurring: 'all' })}
            className="w-full rounded-soft border border-black/10 bg-white px-3 py-2 text-[14px] text-obsidian hover:bg-cloud-soft-white"
          >
            {t('finance.clearFilters')}
          </button>
        </div>
      </div>
    </div>
  );
}
