/**
 * Reports HTTP routes.
 */
import { getService } from '../../init/backend-loader';
import { ReportsService } from '../../init/backend-loader';
import type { RouteContext } from '../types';

export function registerReportsRoutes(ctx: RouteContext) {
  const { app, asyncHandler } = ctx;

  app.get('/api/reports/daily-summary', asyncHandler(async (req, res) => {
    const reportsService = getService(ReportsService);
    const summary = await reportsService.getDailySummary();
    res.json(summary);
  }));

  app.get('/api/reports/:period/:date', asyncHandler(async (req, res) => {
    const reportsService = getService(ReportsService);
    const report = await reportsService.getReportData(
      req.params.period as 'daily' | 'weekly' | 'monthly' | 'yearly',
      req.params.date
    );
    res.json(report);
  }));
}
