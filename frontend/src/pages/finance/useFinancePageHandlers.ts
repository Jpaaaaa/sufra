import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrderLocale } from '../../hooks/useOrderLocale';
import { showToast } from '../../components/ui/Toast';
import { showConfirm } from '../../components/ui/ConfirmDialog';
import type { Expense, FinanceFilters } from '../../lib/finance/types';
import {
  fetchRevenues,
  syncRevenue,
  syncCashFlow,
  createExpense,
  updateExpense,
  deleteExpense,
  formatCurrency,
} from '../../lib/finance/utils';

export interface ExpenseFormState {
  id?: number;
  date: string;
  category: string;
  amount: string;
  notes: string;
  user_id: string;
  is_recurring: boolean;
  recurrence_type: 'daily' | 'weekly' | 'monthly' | 'yearly' | '';
  recurrence_interval: string;
}

const INITIAL_EXPENSE_FORM: ExpenseFormState = {
  date: new Date().toISOString().split('T')[0],
  category: '',
  amount: '',
  notes: '',
  user_id: '',
  is_recurring: false,
  recurrence_type: '',
  recurrence_interval: '1',
};

export function useFinancePageHandlers(
  filters: FinanceFilters,
  loadData: (range: FinanceFilters) => Promise<void>,
  setHasAutoSynced: (v: boolean) => void,
) {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [expenseFormState, setExpenseFormState] = useState<ExpenseFormState>(INITIAL_EXPENSE_FORM);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  const resetExpenseForm = useCallback(() => {
    setExpenseFormState(INITIAL_EXPENSE_FORM);
  }, []);

  const handleSync = useCallback(async () => {
    if (!filters.from || !filters.to) {
      showToast(t('finance.toastSelectDateRange'), 'warning');
      return;
    }

    setIsSyncing(true);
    try {
      const fromDate = new Date(filters.from);
      const toDate = new Date(filters.to);
      const datesToSync: string[] = [];
      const currentDate = new Date(fromDate);

      while (currentDate <= toDate) {
        datesToSync.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      let syncedCount = 0;
      let hasDataCount = 0;

      await Promise.all(
        datesToSync.map(async (date) => {
          try {
            const [revenueResult] = await Promise.all([
              syncRevenue(date).catch(() => null),
              syncCashFlow(date).catch(() => null),
            ]);
            syncedCount++;
            if (revenueResult && revenueResult.amount > 0) hasDataCount++;
          } catch (error) {
            console.error(`Failed to sync date ${date}:`, error);
            syncedCount++;
          }
        }),
      );

      if (hasDataCount > 0) {
        showToast(
          t('finance.toastSyncRangeSuccessWithData', { days: syncedCount, withData: hasDataCount }),
          'success',
        );
      } else {
        showToast(t('finance.toastSyncRangeNoOrders', { days: syncedCount }), 'warning');
      }

      await loadData(filters);
      setHasAutoSynced(true);
    } catch (error) {
      console.error('Failed to sync finance data:', error);
      showToast(t('finance.toastSyncFailed'), 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [filters, loadData, setHasAutoSynced, t]);

  const autoSyncIfNeeded = useCallback(
    async (alreadySynced: boolean) => {
      if (!filters.from || !filters.to || alreadySynced) return;
      try {
        const revenuesData = await fetchRevenues(filters);
        if (revenuesData.length === 0) {
          await handleSync();
        }
        setHasAutoSynced(true);
      } catch (error) {
        console.error('Auto-sync check failed:', error);
        setHasAutoSynced(true);
      }
    },
    [filters, handleSync, setHasAutoSynced],
  );

  const handleSyncCurrent = useCallback(async () => {
    setIsSyncing(true);
    try {
      const [revenueResult] = await Promise.all([
        syncRevenue().catch(() => null),
        syncCashFlow().catch(() => null),
      ]);

      if (revenueResult && revenueResult.amount > 0) {
        showToast(
          t('finance.toastSyncTodaySuccess', { amount: formatCurrency(revenueResult.amount, numberLocale) }),
          'success',
        );
      } else {
        showToast(t('finance.toastSyncTodayNoOrders'), 'warning');
      }

      await loadData(filters);
      setHasAutoSynced(true);
    } catch (error) {
      console.error('Failed to sync finance data:', error);
      showToast(t('finance.toastSyncFailed'), 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [filters, loadData, setHasAutoSynced, numberLocale, t]);

  const handleExpenseSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!expenseFormState.date || !expenseFormState.category || !expenseFormState.amount) {
        showToast(t('finance.toastExpenseFillRequired'), 'warning');
        return;
      }

      const amount = parseFloat(expenseFormState.amount);
      if (isNaN(amount) || amount <= 0) {
        showToast(t('finance.toastExpenseInvalidAmount'), 'warning');
        return;
      }

      setIsSubmittingExpense(true);
      try {
        const expenseData = {
          date: expenseFormState.date,
          category: expenseFormState.category,
          amount,
          notes: expenseFormState.notes || null,
          user_id: expenseFormState.user_id ? parseInt(expenseFormState.user_id) : null,
          is_recurring: expenseFormState.is_recurring,
          recurrence_type:
            expenseFormState.is_recurring && expenseFormState.recurrence_type
              ? (expenseFormState.recurrence_type as 'daily' | 'weekly' | 'monthly' | 'yearly')
              : null,
          recurrence_interval:
            expenseFormState.is_recurring && expenseFormState.recurrence_interval
              ? parseInt(expenseFormState.recurrence_interval)
              : null,
        } as any;

        if (expenseFormState.id) {
          await updateExpense(expenseFormState.id, expenseData);
          showToast(t('finance.toastExpenseUpdated'), 'success');
        } else {
          await createExpense(expenseData);
          showToast(t('finance.toastExpenseAdded'), 'success');
        }

        setIsExpenseFormOpen(false);
        resetExpenseForm();
        await loadData(filters);
      } catch (error) {
        console.error('Failed to save expense:', error);
        showToast(t('finance.toastExpenseSaveFailed'), 'error');
      } finally {
        setIsSubmittingExpense(false);
      }
    },
    [expenseFormState, filters, loadData, resetExpenseForm, t],
  );

  const handleEditExpense = useCallback((expense: Expense) => {
    setExpenseFormState({
      id: expense.id,
      date: expense.date,
      category: expense.category,
      amount: expense.amount.toString(),
      notes: expense.notes || '',
      user_id: expense.user_id ? expense.user_id.toString() : '',
      is_recurring: expense.is_recurring || false,
      recurrence_type: expense.recurrence_type || '',
      recurrence_interval: expense.recurrence_interval ? expense.recurrence_interval.toString() : '1',
    });
    setIsExpenseFormOpen(true);
  }, []);

  const handleDeleteExpense = useCallback(
    async (id: number) => {
      if (!(await showConfirm({ message: t('finance.confirmDeleteExpense') }))) return;

      try {
        await deleteExpense(id);
        showToast(t('finance.toastExpenseDeleted'), 'success');
        await loadData(filters);
      } catch (error) {
        console.error('Failed to delete expense:', error);
        showToast(t('finance.toastExpenseDeleteFailed'), 'error');
      }
    },
    [filters, loadData, t],
  );

  const handleStopRecurring = useCallback(
    async (expense: Expense) => {
      if (!(await showConfirm({ message: t('finance.confirmStopRecurring') }))) return;

      try {
        await updateExpense(expense.id, {
          is_recurring: false,
          recurrence_type: null,
          recurrence_interval: null,
        });
        showToast(t('finance.toastRecurringStopped'), 'success');
        await loadData(filters);
      } catch (error) {
        console.error('Failed to stop recurring expense:', error);
        showToast(t('finance.toastRecurringStopFailed'), 'error');
      }
    },
    [filters, loadData, t],
  );

  const openExpenseForm = useCallback((opts?: { recurring?: boolean }) => {
    setExpenseFormState({
      ...INITIAL_EXPENSE_FORM,
      date: new Date().toISOString().split('T')[0],
      is_recurring: Boolean(opts?.recurring),
      recurrence_type: opts?.recurring ? 'monthly' : '',
      recurrence_interval: '1',
    });
    setIsExpenseFormOpen(true);
  }, []);

  const closeExpenseForm = useCallback(() => {
    setIsExpenseFormOpen(false);
    resetExpenseForm();
  }, [resetExpenseForm]);

  return {
    isSyncing,
    isExpenseFormOpen,
    setIsExpenseFormOpen,
    expenseFormState,
    setExpenseFormState,
    isSubmittingExpense,
    resetExpenseForm,
    autoSyncIfNeeded,
    handleSyncCurrent,
    handleSync,
    handleExpenseSubmit,
    handleEditExpense,
    handleDeleteExpense,
    handleStopRecurring,
    openExpenseForm,
    closeExpenseForm,
  };
}
