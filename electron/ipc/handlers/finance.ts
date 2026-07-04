/**
 * IPC handlers: reports, finance, business-day, api:request.
 */
import { ipcMain } from 'electron';
import { getService, ReportsService, FinanceService, BusinessDayService } from '../../init/backend-loader';

export function registerFinanceHandlers() {
  ipcMain.handle('reports:dailySummary', async () => getService(ReportsService).getDailySummary());
  ipcMain.handle('reports:getReport', async (_, period: string, date: string) => {
    return await getService(ReportsService).getReportData(period as 'daily' | 'weekly' | 'monthly' | 'yearly', date);
  });

  ipcMain.handle('finance:cashFlow', async (_, startDate?: string, endDate?: string) => {
    return await getService(FinanceService).getCashFlow({ from: startDate, to: endDate });
  });
  ipcMain.handle('finance:createCashFlow', async (_, data: any) => getService(FinanceService).createCashFlow(data));
  ipcMain.handle('finance:syncCashFlow', async (_, date: string) => {
    await getService(FinanceService).syncCashFlowFromOrders(date);
    return { success: true };
  });
  ipcMain.handle('finance:revenues', async (_, startDate?: string, endDate?: string) => {
    return await getService(FinanceService).getRevenues({ from: startDate, to: endDate });
  });
  ipcMain.handle('finance:createRevenue', async (_, data: any) => getService(FinanceService).createRevenue(data));
  ipcMain.handle('finance:syncRevenue', async (_, date: string) => {
    return await getService(FinanceService).syncRevenueFromOrders(date);
  });
  ipcMain.handle('finance:expenses', async (_, startDate?: string, endDate?: string) => {
    return await getService(FinanceService).getExpenses({ from: startDate, to: endDate });
  });
  ipcMain.handle('finance:profit', async (_, startDate?: string, endDate?: string) => {
    return await getService(FinanceService).getProfitAndLoss({ from: startDate, to: endDate });
  });
  ipcMain.handle('finance:createExpense', async (_, data: any) => getService(FinanceService).createExpense(data));
  ipcMain.handle('finance:updateExpense', async (_, id: number, data: any) => getService(FinanceService).updateExpense(id, data));
  ipcMain.handle('finance:deleteExpense', async (_, id: number) => getService(FinanceService).deleteExpense(id));
  ipcMain.handle('finance:export', async (_, data: any) => getService(ReportsService).generateExcel(data));

  ipcMain.handle('business-day:getCurrent', async () => getService(BusinessDayService).getCurrentBusinessDay());
  ipcMain.handle('business-day:start', async (_, data: any) => {
    const username = data?.username || data;
    return await getService(BusinessDayService).startNewBusinessDay(typeof username === 'string' ? username : undefined);
  });
  ipcMain.handle('business-day:reset', async (_, data: any) => {
    const username = data?.username || data;
    return await getService(BusinessDayService).startNewBusinessDay(typeof username === 'string' ? username : undefined);
  });

  ipcMain.handle('api:request', async (_, payload: { endpoint: string; method: string; body?: any }) => {
    const { endpoint, method, body } = payload || {};
    const endpointPath = (endpoint || '').replace(/^\//, '').replace(/\/$/, '').toLowerCase().replace(/^api\//, '');
    if (method === 'POST' && (endpointPath === 'finance/revenue/sync' || endpointPath.endsWith('/finance/revenue/sync'))) {
      const financeService = getService(FinanceService);
      const date = body?.date ?? new Date().toISOString().split('T')[0];
      return await financeService.syncRevenueFromOrders(date);
    }
    if (method === 'POST' && (endpointPath === 'finance/cashflow/sync' || endpointPath.endsWith('/finance/cashflow/sync'))) {
      const financeService = getService(FinanceService);
      const date = body?.date ?? new Date().toISOString().split('T')[0];
      await financeService.syncCashFlowFromOrders(date);
      return { success: true };
    }
    return null;
  });
}
