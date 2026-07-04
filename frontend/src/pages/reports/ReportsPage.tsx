import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import ReportsTabs from '../../components/tabs/ReportsTabs';
import ReportsControls from '../../components/reports/ReportsControls';
import { ReportSummaryCards } from '../../components/reports/ReportSummaryCard';
import ReportGraph from '../../components/reports/ReportGraph';
import ItemsSalesReportSection from '../../components/reports/ItemsSalesReportSection';
import EmployeesBestReportSection from '../../components/reports/EmployeesBestReportSection';
import OrdersTable from '../../components/reports/OrdersTable';
import DailySummaryTable from '../../components/reports/DailySummaryTable';
import CashDrawer from '../../components/reports/CashDrawer';
import TabTransition from '../../components/ui/TabTransition';
import {
  ReportPeriod,
  ReportData,
  ReportFilters,
  DailyAggregate,
  OrderReport,
} from '../../lib/reports/types';
import { fetchReports } from '../../lib/reports/utils';
import { showAlert } from '../../components/ui/AlertDialog';
import { getServerUrl } from '../../utils';
import { useAuth } from '../../contexts/AuthContext';

export default function ReportsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ReportPeriod>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filters, setFilters] = useState<ReportFilters>({});
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadReports();
  }, [activeTab, selectedDate, filters]);

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const data = await fetchReports(activeTab, selectedDate, filters);
      setReportData(data);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    if (!reportData) {
      await showAlert({
        message: t('reports.alertNoExportData'),
        type: 'warning',
      });
      return;
    }

    if (isExporting) {
      return;
    }

    setIsExporting(true);

    try {
      let comparedToYesterday: number | undefined;
      if (format === 'pdf' && activeTab === 'daily') {
        try {
          const yesterday = new Date(selectedDate);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayData = await fetchReports('daily', yesterday, filters);
          const yesterdaySales = yesterdayData.summary?.totalSales ?? 0;
          const todaySales = reportData.summary?.totalSales ?? 0;
          if (yesterdaySales > 0) {
            comparedToYesterday = Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 100);
          }
        } catch {
          /* ignore */
        }
      }

      const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
      const exportData = {
        type: activeTab,
        date: dateStr,
        data: {
          summary: reportData.summary,
          items: reportData.itemsPerformance,
          employees: reportData.employeeSummary,
          orders: reportData.orders,
          ...(activeTab === 'daily' && reportData.cashDrawer
            ? { drawer: reportData.cashDrawer }
            : {}),
        },
        branchName: '',
        userName: user?.username,
        ...(comparedToYesterday !== undefined ? { comparedToYesterday } : {}),
      };

      const isElectron = typeof window !== 'undefined' &&
        typeof navigator !== 'undefined' &&
        navigator.userAgent.includes('Electron');

      const hasSufraExport = typeof window !== 'undefined' &&
        typeof (window as any).sufra !== 'undefined' &&
        typeof (window as any).sufra.export !== 'undefined' &&
        typeof (window as any).sufra.export.pdf === 'function';

      if (format === 'pdf' && isElectron && hasSufraExport) {
        try {
          const result = await (window as any).sufra.export.pdf(exportData);

          if (result && result.success) {
            await showAlert({
              message: t('reports.exportPdfSuccessBody', {
                path: result.fileName || t('reports.exportPdfDownloadsFolder'),
              }),
              type: 'success',
              title: t('reports.exportSuccessTitle'),
            });
            return;
          } else {
            const errorMsg = result?.error || t('reports.exportPdfFailed');
            throw new Error(errorMsg);
          }
        } catch (ipcError: any) {
          const errorMsg = ipcError?.message || ipcError?.toString() || t('reports.exportPdfFailedIpc');
          throw new Error(errorMsg);
        }
      } else if (format === 'pdf') {
        if (isElectron && !hasSufraExport) {
          throw new Error(t('reports.exportPdfIpcUnavailable'));
        } else {
          throw new Error(t('reports.exportPdfOnlyElectron'));
        }
      }

      if (format === 'excel') {
        const serverUrl = getServerUrl();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

        const token = typeof window !== 'undefined' ? localStorage.getItem('sufra_auth_token') : null;

        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        let response: Response;
        try {
          response = await fetch(`${serverUrl}/reports/export/excel`, {
            method: 'POST',
            headers,
            body: JSON.stringify(exportData),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            throw new Error('Request timeout - the file might be too large');
          }
          throw fetchError;
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`Failed to generate Excel: ${response.status} ${errorText}`);
        }

        const blob = await response.blob();

        if (!blob || blob.size === 0) {
          throw new Error('Received empty file from server');
        }

        const maxSize = 50 * 1024 * 1024;
        if (blob.size > maxSize) {
          throw new Error(`File too large (${(blob.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 50MB.`);
        }

        const fileName = `report-${activeTab}-${dateStr}.xlsx`;

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.setAttribute('download', fileName);

        document.body.appendChild(link);
        await new Promise(resolve => setTimeout(resolve, 50));
        link.click();

        setTimeout(() => {
          try {
            document.body.removeChild(link);
          } catch {
            /* ignore */
          }
        }, 100);

        setTimeout(() => {
          try {
            URL.revokeObjectURL(url);
          } catch {
            /* ignore */
          }
        }, 3000);

        await showAlert({
          message: t('reports.exportExcelSuccessBody'),
          type: 'success',
          title: t('reports.exportSuccessTitle'),
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const formatLabel = format === 'pdf' ? t('reports.exportPdf') : t('reports.exportExcel');
      await showAlert({
        message: t('reports.exportFailedBody', { format: formatLabel, message: errorMessage }),
        type: 'error',
        title: t('reports.exportFailedTitle'),
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-cloud-soft-white">
      <Header title={t('nav.reports')} />

      <main className="flex-1 p-6">
        <section className="mx-auto max-w-7xl">
          <ReportsTabs activeTab={activeTab} onTabChange={setActiveTab} />

          <ReportsControls
            period={activeTab}
            date={selectedDate}
            onDateChange={setSelectedDate}
            filters={filters}
            onFiltersChange={setFilters}
            onExport={handleExport}
            isExporting={isExporting}
          />

          {isLoading ? (
            <div className="flex h-64 items-center justify-center rounded-soft-xl border border-black/5 bg-cloud-soft-white">
              <div className="text-center">
                <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-cyber-aqua border-t-transparent"></div>
                <p className="text-[15px] leading-normal text-graphite">{t('reports.loadingData')}</p>
              </div>
            </div>
          ) : reportData ? (
            <TabTransition activeTab={activeTab}>
              <div className="space-y-6">
                <ReportSummaryCards summary={reportData.summary} />

                <ReportGraph data={reportData.graphData} period={activeTab} />

                <ItemsSalesReportSection
                  items={reportData.itemsPerformance}
                  unsoldMenuItems={reportData.unsoldMenuItems}
                />

                <EmployeesBestReportSection employees={reportData.employeeSummary} />

                {activeTab === 'daily' && reportData.cashDrawer && (
                  <CashDrawer data={reportData.cashDrawer} />
                )}

                {activeTab === 'daily' || activeTab === 'weekly' || activeTab === 'monthly' || activeTab === 'yearly' ? (
                  <DailySummaryTable data={reportData.orders as DailyAggregate[]} />
                ) : (
                  <OrdersTable data={reportData.orders as OrderReport[]} />
                )}
              </div>
            </TabTransition>
          ) : (
            <div className="rounded-soft-xl border border-black/5 bg-cloud-soft-white p-6 text-center">
              <p className="text-[15px] leading-normal text-graphite">{t('reports.noData')}</p>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
