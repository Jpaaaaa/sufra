import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import FinanceTabs, { FinanceTabKey } from '../../components/tabs/FinanceTabs';
import FinanceSummaryCard from '../../components/finance/FinanceSummaryCard';
import TabTransition from '../../components/ui/TabTransition';
import { showToast } from '../../components/ui/Toast';
import { useOrderLocale } from '../../hooks/useOrderLocale';
import { buildFinanceDailyRows } from '../../lib/finance/daily-rows';
import { buildFinanceGeneralPdfHtml, saveFinanceHtmlPdf } from '../../lib/finance/export-general-pdf';
import { APP_BRAND_NAME } from '../../lib/brand';
import { useFinancePageData } from './useFinancePageData';
import { useFinancePageHandlers } from './useFinancePageHandlers';
import FinancePageFiltersSection from './FinancePageFiltersSection';
import FinancePageGeneralSection from './FinancePageGeneralSection';
import FinancePageRevenueSection from './FinancePageRevenueSection';
import FinancePageExpensesSection from './FinancePageExpensesSection';
import FinancePageRecurringSection from './FinancePageRecurringSection';
import FinancePageExpenseForm from './FinancePageExpenseForm';

export default function FinancePage() {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();
  const [activeTab, setActiveTab] = useState<FinanceTabKey>('general');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const data = useFinancePageData();
  const {
    filters,
    setFilters,
    revenues,
    expenses,
    recurringExpenses,
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
    handleStopRecurring,
    openExpenseForm,
    closeExpenseForm,
    autoSyncIfNeeded,
  } = handlers;

  useEffect(() => {
    if (!hasAutoSynced) {
      void autoSyncIfNeeded(hasAutoSynced);
    }
  }, []);

  const handleExportPdf = useCallback(async () => {
    const rows = buildFinanceDailyRows(revenues, expenses, t);
    if (rows.length === 0) {
      showToast(t('finance.toastPdfNoData'), 'warning');
      return;
    }

    setIsExportingPdf(true);
    try {
      const html = buildFinanceGeneralPdfHtml({
        brandName: APP_BRAND_NAME,
        title: t('finance.generalTableTitle'),
        from: filters.from || '',
        to: filters.to || '',
        rows,
        labels: {
          date: t('finance.colDate'),
          details: t('finance.colDetails'),
          revenue: t('finance.colRevenue'),
          expenses: t('finance.colExpenses'),
          rowTotal: t('finance.colRowTotal'),
          total: t('finance.totalRow'),
          period: t('finance.pdfPeriod'),
        },
        numberLocale,
      });
      const fileName = `sufra-finance-${filters.from || 'from'}-${filters.to || 'to'}.pdf`;
      const result = await saveFinanceHtmlPdf(html, fileName);
      if (result.fileName) {
        showToast(
          t('finance.toastPdfSaved', {
            defaultValue: `تم حفظ PDF: ${result.fileName}`,
            fileName: result.fileName,
          }),
          'success',
        );
      } else {
        showToast(t('finance.toastPdfOpened'), 'success');
      }
    } catch (error: any) {
      console.error('Failed to export finance PDF:', error);
      if (error?.message === 'POPUP_BLOCKED') {
        showToast(t('finance.toastPdfPopupBlocked'), 'error');
      } else {
        showToast(t('finance.toastPdfFailed'), 'error');
      }
    } finally {
      setIsExportingPdf(false);
    }
  }, [revenues, expenses, t, filters.from, filters.to, numberLocale]);

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
                {activeTab === 'general' && (
                  <FinancePageGeneralSection
                    revenues={revenues}
                    expenses={expenses}
                    onOpenExpenseForm={openExpenseForm}
                    onExportPdf={handleExportPdf}
                    isExportingPdf={isExportingPdf}
                  />
                )}

                {activeTab === 'expenses' && (
                  <FinancePageExpensesSection
                    expenses={expenses}
                    users={users}
                    onEditExpense={handleEditExpense}
                    onDeleteExpense={handleDeleteExpense}
                    onOpenExpenseForm={openExpenseForm}
                  />
                )}

                {activeTab === 'recurring' && (
                  <FinancePageRecurringSection
                    expenses={recurringExpenses}
                    users={users}
                    onEditExpense={handleEditExpense}
                    onDeleteExpense={handleDeleteExpense}
                    onStopRecurring={handleStopRecurring}
                    onOpenExpenseForm={() => openExpenseForm({ recurring: true })}
                  />
                )}

                {activeTab === 'revenue' && (
                  <FinancePageRevenueSection revenues={revenues} chartData={chartData} />
                )}
              </TabTransition>
            </>
          )}
        </section>
      </main>

      <Footer />

      {isExpenseFormOpen && (
        <FinancePageExpenseForm
          formState={expenseFormState}
          setFormState={setExpenseFormState}
          users={users}
          isSubmitting={isSubmittingExpense}
          onSubmit={handleExpenseSubmit}
          onCancel={closeExpenseForm}
        />
      )}
    </div>
  );
}
