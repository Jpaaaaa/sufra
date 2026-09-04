/**
 * Finance and business-day routes
 */
import {
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
import type { FastifyRouteContext } from '../types';
import { sendRouteError } from '../errors';

type DateRangeQuery = { Querystring: { startDate?: string; endDate?: string } };

function parseId(value: string): number {
  return parseInt(value, 10);
}

function dateRange(query: { startDate?: string; endDate?: string }) {
  return { from: query.startDate, to: query.endDate };
}

function parseUsername(body: unknown): string | undefined {
  const record = body as { username?: string } | string;
  if (typeof record === 'string') {
    return record;
  }
  return typeof record?.username === 'string' ? record.username : undefined;
}

export function registerFinanceRoutes(ctx: FastifyRouteContext): void {
  const { app } = ctx;

  app.get<DateRangeQuery>('/api/finance/cash-flow', async (request, reply) => {
    try {
      return await financeGetCashFlow(dateRange(request.query));
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post('/api/finance/cash-flow', async (request, reply) => {
    try {
      return await financeCreateCashFlow(request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post<{ Body: { date?: string } }>(
    '/api/finance/cash-flow/sync',
    async (request, reply) => {
      try {
        await financeSyncCashFlowFromOrders(request.body?.date);
        return { success: true };
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.get<DateRangeQuery>('/api/finance/revenues', async (request, reply) => {
    try {
      return await financeGetRevenues(dateRange(request.query));
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post('/api/finance/revenues', async (request, reply) => {
    try {
      return await financeCreateRevenue(request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post<{ Body: { date?: string } }>(
    '/api/finance/revenues/sync',
    async (request, reply) => {
      try {
        return await financeSyncRevenueFromOrders(request.body?.date);
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.get<DateRangeQuery>('/api/finance/expenses', async (request, reply) => {
    try {
      return await financeGetExpenses(dateRange(request.query));
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post('/api/finance/expenses', async (request, reply) => {
    try {
      return await financeCreateExpense(request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.put<{ Params: { id: string } }>(
    '/api/finance/expenses/:id',
    async (request, reply) => {
      try {
        return await financeUpdateExpense(
          parseId(request.params.id),
          request.body,
        );
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/finance/expenses/:id',
    async (request, reply) => {
      try {
        await financeDeleteExpense(parseId(request.params.id));
        return { success: true };
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.get<DateRangeQuery>('/api/finance/profit', async (request, reply) => {
    try {
      return await financeGetProfitAndLoss(dateRange(request.query));
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post('/api/finance/export', async (request, reply) => {
    try {
      return await generateReportsExcel(request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get('/api/business-day/current', async (request, reply) => {
    try {
      return await businessDayGetCurrentBusinessDay();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post('/api/business-day/start', async (request, reply) => {
    try {
      return await businessDayStartNewBusinessDay(
        parseUsername(request.body),
      );
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post('/api/business-day/reset', async (request, reply) => {
    try {
      return await businessDayStartNewBusinessDay(
        parseUsername(request.body),
      );
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post('/api/business-day/ensure', async (request, reply) => {
    try {
      return await businessDayEnsureBusinessDayExists();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post('/business-day/ensure', async (request, reply) => {
    try {
      return await businessDayEnsureBusinessDayExists();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });
}
