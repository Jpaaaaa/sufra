/**
 * IPC handlers: reports, finance, business-day, api:request.
 */
import { ipcMain } from 'electron';
import {
  getReportsDailySummary,
  getReportsReportData,
  generateReportsExcel,
  businessDayGetCurrentBusinessDay,
  businessDayStartNewBusinessDay,
  businessDayEnsureBusinessDayExists,
  financeGetCashFlow,
  financeCreateCashFlow,
  financeSyncCashFlowFromOrders,
  financeGetRevenues,
  financeCreateRevenue,
  financeSyncRevenueFromOrders,
  financeGetExpenses,
  financeCreateExpense,
  financeUpdateExpense,
  financeDeleteExpense,
  financeGetProfitAndLoss,
} from '../../init/backend-loader';

export function registerFinanceHandlers() {
  ipcMain.handle('reports:dailySummary', async () => getReportsDailySummary());
  ipcMain.handle('reports:getReport', async (_, period: string, date: string) => {
    return await getReportsReportData(period as 'daily' | 'weekly' | 'monthly' | 'yearly', date);
  });

  ipcMain.handle('finance:cashFlow', async (_, startDate?: string, endDate?: string) => {
    return await financeGetCashFlow({ from: startDate, to: endDate });
  });
  ipcMain.handle('finance:createCashFlow', async (_, data: any) => financeCreateCashFlow(data));
  ipcMain.handle('finance:syncCashFlow', async (_, date: string) => {
    await financeSyncCashFlowFromOrders(date);
    return { success: true };
  });
  ipcMain.handle('finance:revenues', async (_, startDate?: string, endDate?: string) => {
    return await financeGetRevenues({ from: startDate, to: endDate });
  });
  ipcMain.handle('finance:createRevenue', async (_, data: any) => financeCreateRevenue(data));
  ipcMain.handle('finance:syncRevenue', async (_, date: string) => {
    return await financeSyncRevenueFromOrders(date);
  });
  ipcMain.handle('finance:expenses', async (_, startDate?: string, endDate?: string) => {
    return await financeGetExpenses({ from: startDate, to: endDate });
  });
  ipcMain.handle('finance:profit', async (_, startDate?: string, endDate?: string) => {
    return await financeGetProfitAndLoss({ from: startDate, to: endDate });
  });
  ipcMain.handle('finance:createExpense', async (_, data: any) => financeCreateExpense(data));
  ipcMain.handle('finance:updateExpense', async (_, id: number, data: any) =>
    financeUpdateExpense(id, data),
  );
  ipcMain.handle('finance:deleteExpense', async (_, id: number) => financeDeleteExpense(id));
  ipcMain.handle('finance:export', async (_, data: any) => generateReportsExcel(data));

  ipcMain.handle('business-day:getCurrent', async () => businessDayGetCurrentBusinessDay());
  ipcMain.handle('business-day:start', async (_, data: any) => {
    const username = data?.username || data;
    return businessDayStartNewBusinessDay(typeof username === 'string' ? username : undefined);
  });
  ipcMain.handle('business-day:reset', async (_, data: any) => {
    const username = data?.username || data;
    return businessDayStartNewBusinessDay(typeof username === 'string' ? username : undefined);
  });
  ipcMain.handle('business-day:ensure', async () => businessDayEnsureBusinessDayExists());

  ipcMain.handle('api:request', async (_, payload: { endpoint: string; method: string; body?: any }) => {
    const { endpoint, method, body } = payload || {};
    const endpointPath = (endpoint || '').replace(/^\//, '').replace(/\/$/, '').toLowerCase().replace(/^api\//, '');
    if (method === 'POST' && (endpointPath === 'finance/revenue/sync' || endpointPath.endsWith('/finance/revenue/sync'))) {
      const date = body?.date ?? new Date().toISOString().split('T')[0];
      return await financeSyncRevenueFromOrders(date);
    }
    if (method === 'POST' && (endpointPath === 'finance/cashflow/sync' || endpointPath.endsWith('/finance/cashflow/sync'))) {
      const date = body?.date ?? new Date().toISOString().split('T')[0];
      await financeSyncCashFlowFromOrders(date);
      return { success: true };
    }
    return null;
  });
}
