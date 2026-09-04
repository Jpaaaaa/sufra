'use client';

import { useTranslation } from 'react-i18next';
import { EXPENSE_CATEGORIES } from '../../lib/finance/types';
import { EXPENSE_GROUP_ORDER, getExpenseGroup, type ExpenseGroup } from '../../lib/finance/expense-groups';
import { tExpenseCategory, tExpenseGroup } from '../../lib/finance/expense-i18n';
import type { ExpenseFormState } from './useFinancePageHandlers';
import { useGlobalNumericField } from '../../contexts/GlobalNumericKeypadContext';

function categoriesInGroup(group: ExpenseGroup): readonly string[] {
  return EXPENSE_CATEGORIES.filter((c) => getExpenseGroup(c) === group);
}

interface FinancePageExpenseFormProps {
  formState: ExpenseFormState;
  setFormState: React.Dispatch<React.SetStateAction<ExpenseFormState>>;
  users: Array<{ id: number; username: string; role: string }>;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export default function FinancePageExpenseForm({
  formState,
  setFormState,
  users,
  isSubmitting,
  onSubmit,
  onCancel,
}: FinancePageExpenseFormProps) {
  const { t } = useTranslation();
  const amountField = useGlobalNumericField(formState.amount, (next) => {
    const val = next.replace(/[^0-9.]/g, '');
    setFormState((prev) => ({ ...prev, amount: val }));
  });
  const recurrenceIntervalField = useGlobalNumericField(formState.recurrence_interval, (next) => {
    const val = next.replace(/[^0-9]/g, '');
    setFormState((prev) => ({ ...prev, recurrence_interval: val || '1' }));
  });

  const recurrenceUnit =
    formState.recurrence_type === 'daily'
      ? t('finance.recurrenceUnitDay')
      : formState.recurrence_type === 'weekly'
        ? t('finance.recurrenceUnitWeek')
        : formState.recurrence_type === 'monthly'
          ? t('finance.recurrenceUnitMonth')
          : formState.recurrence_type === 'yearly'
            ? t('finance.recurrenceUnitYear')
            : t('finance.recurrenceUnitGeneric');

  const heading = formState.id ? t('finance.editExpenseTitle') : t('finance.addExpenseTitle');

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-obsidian/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="finance-expense-form-title"
      onClick={onCancel}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-soft-xl border border-black/5 bg-white shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/5 bg-white px-6 py-4">
          <h2 id="finance-expense-form-title" className="text-[20px] leading-tight font-semibold text-obsidian">
            {heading}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-soft-lg p-2 text-obsidian/60 hover:bg-cloud-soft-white hover:text-obsidian"
            aria-label={t('finance.cancel')}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-[15px] leading-normal font-medium text-obsidian">
            {t('finance.formDate')} <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            required
            value={formState.date}
            onChange={(e) => setFormState({ ...formState, date: e.target.value })}
            className="input-soft w-full"
          />
        </div>
        <div>
          <label className="mb-2 block text-[15px] leading-normal font-medium text-obsidian">
            {t('finance.formCategory')} <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formState.category}
            onChange={(e) => {
              const newCategory = e.target.value;
              setFormState({
                ...formState,
                category: newCategory,
                user_id: newCategory === 'Salaries' ? formState.user_id : '',
              });
            }}
            className="input-soft w-full"
          >
            <option value="">{t('finance.selectCategory')}</option>
            {EXPENSE_GROUP_ORDER.map((g) => (
              <optgroup key={g} label={tExpenseGroup(g, t)}>
                {categoriesInGroup(g).map((cat) => (
                  <option key={cat} value={cat}>
                    {tExpenseCategory(cat, t)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-[15px] leading-normal font-medium text-obsidian">
            {t('finance.formAmount')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            inputMode="decimal"
            required
            value={formState.amount}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9.]/g, '');
              setFormState({ ...formState, amount: val });
            }}
            onFocus={amountField.onFocus}
            className="input-soft w-full"
            placeholder={t('finance.amountPlaceholder')}
          />
        </div>
        {formState.category === 'Salaries' && (
          <div>
            <label className="mb-2 block text-[15px] leading-normal font-medium text-obsidian">{t('finance.formEmployee')}</label>
            <select
              value={formState.user_id}
              onChange={(e) => setFormState({ ...formState, user_id: e.target.value })}
              className="input-soft w-full"
            >
              <option value="">{t('finance.selectEmployeeOptional')}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id.toString()}>
                  {user.username} ({user.role})
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="md:col-span-2">
          <label className="mb-2 flex items-center gap-2 text-[15px] leading-normal font-medium text-obsidian">
            <input
              type="checkbox"
              checked={formState.is_recurring}
              onChange={(e) =>
                setFormState({
                  ...formState,
                  is_recurring: e.target.checked,
                  recurrence_type: e.target.checked ? formState.recurrence_type || 'monthly' : '',
                })
              }
              className="h-4 w-4 rounded border-black/20 text-cyber-aqua focus:ring-cyber-aqua"
            />
            <span>{t('finance.formRecurringCheckbox')}</span>
          </label>
        </div>
        {formState.is_recurring && (
          <>
            <div>
              <label className="mb-2 block text-[15px] leading-normal font-medium text-obsidian">
                {t('finance.formRecurrenceType')} <span className="text-red-500">*</span>
              </label>
              <select
                required={formState.is_recurring}
                value={formState.recurrence_type}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    recurrence_type: e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly' | '',
                  })
                }
                className="input-soft w-full"
              >
                <option value="">{t('finance.selectRecurrenceType')}</option>
                <option value="daily">{t('finance.recurrenceDaily')}</option>
                <option value="weekly">{t('finance.recurrenceWeekly')}</option>
                <option value="monthly">{t('finance.recurrenceMonthly')}</option>
                <option value="yearly">{t('finance.recurrenceYearly')}</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-[15px] leading-normal font-medium text-obsidian">
                {t('finance.everyHowMany', { unit: recurrenceUnit })}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formState.recurrence_interval}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setFormState({ ...formState, recurrence_interval: val || '1' });
                }}
                onFocus={recurrenceIntervalField.onFocus}
                className="input-soft w-full"
                placeholder="1"
              />
            </div>
          </>
        )}
        <div className="md:col-span-2">
          <label className="mb-2 block text-[15px] leading-normal font-medium text-obsidian">{t('finance.formNotes')}</label>
          <textarea
            inputMode="text"
            value={formState.notes}
            onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
            className="input-soft w-full"
            rows={3}
            placeholder={t('finance.notesPlaceholder')}
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2 border-t border-black/5 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-soft-lg border border-black/10 bg-white px-4 py-2 text-[15px] leading-normal font-medium text-obsidian hover:bg-cloud-soft-white"
        >
          {t('finance.cancel')}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? t('finance.saving') : formState.id ? t('finance.update') : t('finance.save')}
        </button>
      </div>
        </form>
      </div>
    </div>
  );
}
