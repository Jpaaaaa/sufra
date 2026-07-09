/**
 * Reports routes
 */
import {
  getReportsDailySummary,
  getReportsReportData,
} from '../../init/backend-loader';
import type { FastifyRouteContext } from '../types';
import { sendRouteError } from '../errors';

type ReportPeriodParams = {
  Params: { period: string; date: string };
};

export function registerReportsRoutes(ctx: FastifyRouteContext): void {
  const { app } = ctx;

  app.get('/api/reports/daily-summary', async (request, reply) => {
    try {
      return await getReportsDailySummary();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get<ReportPeriodParams>(
    '/api/reports/:period/:date',
    async (request, reply) => {
      try {
        return await getReportsReportData(
          request.params.period as 'daily' | 'weekly' | 'monthly' | 'yearly',
          request.params.date,
        );
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );
}
