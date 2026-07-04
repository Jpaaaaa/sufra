/**
 * Finance and business-day HTTP routes.
 */
import { getService } from '../../init/backend-loader';
import { FinanceService, ReportsService, BusinessDayService } from '../../init/backend-loader';
import type { RouteContext } from '../types';

export function registerFinanceRoutes(ctx: RouteContext) {
  const { app, asyncHandler } = ctx;

  app.get('/api/finance/cash-flow', asyncHandler(async (req, res) => {
    res.json(await getService(FinanceService).getCashFlow({
      from: req.query.startDate as string,
      to: req.query.endDate as string,
    }));
  }));
  app.post('/api/finance/cash-flow', asyncHandler(async (req, res) => {
    res.json(await getService(FinanceService).createCashFlow(req.body));
  }));
  app.post('/api/finance/cash-flow/sync', asyncHandler(async (req, res) => {
    await getService(FinanceService).syncCashFlowFromOrders(req.body.date);
    res.json({ success: true });
  }));
  app.get('/api/finance/revenues', asyncHandler(async (req, res) => {
    res.json(await getService(FinanceService).getRevenues({
      from: req.query.startDate as string,
      to: req.query.endDate as string,
    }));
  }));
  app.post('/api/finance/revenues', asyncHandler(async (req, res) => {
    res.json(await getService(FinanceService).createRevenue(req.body));
  }));
  app.post('/api/finance/revenues/sync', asyncHandler(async (req, res) => {
    res.json(await getService(FinanceService).syncRevenueFromOrders(req.body.date));
  }));
  app.get('/api/finance/expenses', asyncHandler(async (req, res) => {
    res.json(await getService(FinanceService).getExpenses({
      from: req.query.startDate as string,
      to: req.query.endDate as string,
    }));
  }));
  app.post('/api/finance/expenses', asyncHandler(async (req, res) => {
    res.json(await getService(FinanceService).createExpense(req.body));
  }));
  app.put('/api/finance/expenses/:id', asyncHandler(async (req, res) => {
    res.json(await getService(FinanceService).updateExpense(parseInt(req.params.id), req.body));
  }));
  app.delete('/api/finance/expenses/:id', asyncHandler(async (req, res) => {
    await getService(FinanceService).deleteExpense(parseInt(req.params.id));
    res.json({ success: true });
  }));
  app.get('/api/finance/profit', asyncHandler(async (req, res) => {
    res.json(await getService(FinanceService).getProfitAndLoss({
      from: req.query.startDate as string,
      to: req.query.endDate as string,
    }));
  }));
  app.post('/api/finance/export', asyncHandler(async (req, res) => {
    res.json(await getService(ReportsService).generateExcel(req.body));
  }));

  app.get('/api/business-day/current', asyncHandler(async (req, res) => {
    res.json(await getService(BusinessDayService).getCurrentBusinessDay());
  }));
  app.post('/api/business-day/start', asyncHandler(async (req, res) => {
    const username = req.body?.username || req.body;
    res.json(await getService(BusinessDayService).startNewBusinessDay(
      typeof username === 'string' ? username : undefined
    ));
  }));
  app.post('/api/business-day/reset', asyncHandler(async (req, res) => {
    const username = req.body?.username || req.body;
    res.json(await getService(BusinessDayService).startNewBusinessDay(
      typeof username === 'string' ? username : undefined
    ));
  }));
}
