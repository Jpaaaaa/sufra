import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import FinanceTabs, { FinanceTabKey } from '../../components/tabs/FinanceTabs';
import FinanceSummaryCard from '../../components/finance/FinanceSummaryCard';
import TabTransition from '../../components/ui/TabTransition';
import { useFinancePageData } from './useFinancePageData';
import { useFinancePageHandlers } from './useFinancePageHandlers';
import FinancePageFiltersSection from './FinancePageFiltersSection';
import FinancePageRevenueSection from './FinancePageRevenueSection';
import FinancePageExpensesSection from './FinancePageExpensesSection';
import FinancePageProfitSection from './FinancePageProfitSection';

export default function FinancePage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<FinanceTabKey>('revenue');

  const data = useFinancePageData();
  const {
    filters,
    setFilters,
    revenues,
    expenses,
    profit,
    isLoading,
    hasAutoSynced,
    setHasAutoSynced,
    users,
    loadData,
    totalRevenue,
    totalExpenses,
    netProfit,
    chartData,
  } = data;

  const handlers = useFinancePageHandlers(filters, loadData, setHasAutoSynced);
  const {
    isSyncing,
    isExpenseFormOpen,
    expenseFormState,
    setExpenseFormState,
    isSubmittingExpense,
    handleSyncCurrent,
    handleSync,
    handleExpenseSubmit,
    handleEditExpense,
    handleDeleteExpense,
    openExpenseForm,
    closeExpenseForm,
    autoSyncIfNeeded,
  } = handlers;

  useEffect(() => {
    if (!hasAutoSynced) {
      void autoSyncIfNeeded(hasAutoSynced);
    }
  }, []);

  return (
    <div className="flex flex-1 flex-col bg-cloud-soft-white">
      <Header title={t('nav.finance')} />

      <main className="flex-1 p-6">
        <section className="mx-auto max-w-7xl">
          <FinanceTabs activeTab={activeTab} onTabChange={setActiveTab} />

          <FinancePageFiltersSection
            filters={filters}
            setFilters={setFilters}
            isSyncing={isSyncing}
            onSyncCurrent={handleSyncCurrent}
            onSync={handleSync}
          />

          {isLoading ? (
            <div className="flex h-64 items-center justify-center rounded-soft-xl border border-black/5 bg-white">
              <div className="text-center">
                <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-cyber-aqua border-t-transparent"></div>
                <p className="text-[15px] leading-normal text-obsidian/60">{t('finance.loading')}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <FinanceSummaryCard label={t('finance.summaryTotalRevenue')} value={totalRevenue} variant="default" />
                <FinanceSummaryCard label={t('finance.summaryTotalExpenses')} value={totalExpenses} variant="default" />
                <FinanceSummaryCard
                  label={t('finance.summaryNetProfit')}
                  value={netProfit}
                  variant={netProfit >= 0 ? 'positive' : 'negative'}
                />
              </div>

              <TabTransition activeTab={activeTab}>
                {activeTab === 'revenue' && (
                  <FinancePageRevenueSection revenues={revenues} chartData={chartData} />
                )}

                {activeTab === 'expenses' && (
                  <FinancePageExpensesSection
                    expenses={expenses}
                    users={users}
                    isExpenseFormOpen={isExpenseFormOpen}
                    expenseFormState={expenseFormState}
                    setExpenseFormState={setExpenseFormState}
                    isSubmittingExpense={isSubmittingExpense}
                    onExpenseSubmit={handleExpenseSubmit}
                    onEditExpense={handleEditExpense}
                    onDeleteExpense={handleDeleteExpense}
                    onOpenExpenseForm={openExpenseForm}
                    onCloseExpenseForm={closeExpenseForm}
                  />
                )}

                {activeTab === 'profit' && profit && (
                  <FinancePageProfitSection
                    profit={profit}
                    revenues={revenues}
                    chartData={chartData}
                  />
                )}

              </TabTransition>
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
