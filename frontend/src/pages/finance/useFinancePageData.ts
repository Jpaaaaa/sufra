import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getServerUrl, fetchJson } from '../../utils';
import { showToast } from '../../components/ui/Toast';
import {
  Revenue,
  Expense,
  ProfitSummary,
  FinanceFilters,
} from '../../lib/finance/types';
import {
  fetchRevenues,
  fetchExpenses,
  fetchProfitAndLoss,
  formatDate,
} from '../../lib/finance/utils';

const DEFAULT_FILTERS: FinanceFilters = {
  from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  to: new Date().toISOString().split('T')[0],
};

export function useFinancePageData() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<FinanceFilters>(DEFAULT_FILTERS);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [profit, setProfit] = useState<ProfitSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAutoSynced, setHasAutoSynced] = useState(false);
  const [users, setUsers] = useState<Array<{ id: number; username: string; role: string }>>([]);

  const loadData = useCallback(
    async (range: FinanceFilters) => {
      setIsLoading(true);
      try {
        const to = range.to || range.from || new Date().toISOString().split('T')[0];
        const fullRange = { ...range, to };
        const [revenuesData, expensesData, profitData] = await Promise.all([
          fetchRevenues(fullRange),
          fetchExpenses(fullRange),
          fetchProfitAndLoss(fullRange),
        ]);
        setRevenues(revenuesData);
        setExpenses(expensesData);
        setProfit(profitData);
      } catch (error) {
        console.error('Failed to load finance data:', error);
        showToast(t('finance.toastLoadFailed'), 'error');
      } finally {
        setIsLoading(false);
      }
    },
    [t],
  );

  const loadUsers = useCallback(async () => {
    try {
      const usersData = await fetchJson<Array<{ id: number; username: string; role: string }>>(
        `${getServerUrl()}/users`,
      );
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }, []);

  useEffect(() => {
    void loadData(filters);
  }, [filters, loadData]);

  useEffect(() => {
    void loadUsers();
  }, []);

  const totalRevenue = useMemo(() => revenues.reduce((sum, r) => sum + r.amount, 0), [revenues]);
  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);
  const netProfit = useMemo(() => totalRevenue - totalExpenses, [totalRevenue, totalExpenses]);

  const chartData = useMemo(
    () =>
      revenues.map((rev) => ({
        label: formatDate(rev.date),
        value: rev.amount,
        timestamp: rev.date,
      })),
    [revenues],
  );

  return {
    filters,
    setFilters,
    revenues,
    setRevenues,
    expenses,
    setExpenses,
    profit,
    isLoading,
    hasAutoSynced,
    setHasAutoSynced,
    users,
    loadData,
    loadUsers,
    totalRevenue,
    totalExpenses,
    netProfit,
    chartData,
  };
}
