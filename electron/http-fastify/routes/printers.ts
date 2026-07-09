/**
 * Printers routes — migrated from electron/http/routes/printers.ts
 */
import {
  printersGetAllSettings,
  printersSaveSetting,
} from '../../init/backend-loader';
import { printPngToPrinter, getAvailablePrinters } from '../../print/printer';
import { getIpcHandler } from '../ipc-handlers';
import type { FastifyRouteContext } from '../types';
import { sendRouteError } from '../errors';

type PrinterTestBody = {
  printer_ip?: string;
  printer_port?: number;
};

const TEST_PRINT_DATA = {
  orderId: 999,
  table: 1,
  hall: 'اختبار',
  items: [
    {
      id: 1,
      item_name: 'طباعة تجريبية - SUFRA POS',
      quantity: 1,
      price: 0,
    },
  ],
  totals: { total: 0 },
  timestamp: new Date().toISOString(),
  restaurantName: 'سفرة',
};

async function runTestPrint(data: PrinterTestBody, reply: import('fastify').FastifyReply) {
  if (!data?.printer_ip || data.printer_ip.trim() === '') {
    return reply
      .status(400)
      .send({ success: false, error: 'Printer IP address is required' });
  }

  const { renderOrderToPng } = await import('../../print/render-kitchen-receipt');
  const png = await renderOrderToPng(TEST_PRINT_DATA);
  if (!png || png.length < 100) {
    return reply
      .status(500)
      .send({ success: false, error: 'Failed to generate test PNG' });
  }

  const port = data.printer_port || 9100;
  const printResult = await printPngToPrinter(png, data.printer_ip, port);
  if (printResult.success) {
    return { success: true, message: 'Test print sent successfully' };
  }
  return reply.status(500).send({
    success: false,
    error: printResult.error || 'Failed to send test print',
  });
}

export function registerPrintersRoutes(ctx: FastifyRouteContext): void {
  const { app } = ctx;

  app.get('/api/printers/settings', async (request, reply) => {
    try {
      return await printersGetAllSettings();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get('/api/printers/available', async (request, reply) => {
    try {
      return await getAvailablePrinters();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post('/api/printers/settings', async (request, reply) => {
    try {
      return await printersSaveSetting(request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get('/printers/settings', async (request, reply) => {
    try {
      const handler = getIpcHandler('printers:getSettings');
      if (handler) {
        return await handler({});
      }
      return await printersGetAllSettings();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to get printer settings';
      return reply.status(500).send({ success: false, error: message });
    }
  });

  app.get('/printers/available', async (request, reply) => {
    try {
      const handler = getIpcHandler('printers:available');
      if (handler) {
        return await handler({});
      }
      return await getAvailablePrinters();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to get available printers';
      return reply.status(500).send({ success: false, error: message });
    }
  });

  app.post('/printers/settings', async (request, reply) => {
    try {
      const handler = getIpcHandler('printers:saveSettings');
      if (handler) {
        return await handler({}, request.body);
      }
      return await printersSaveSetting(request.body);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save printer settings';
      return reply.status(500).send({ success: false, error: message });
    }
  });

  app.post<{ Body: PrinterTestBody }>('/printers/test', async (request, reply) => {
    try {
      const handler = getIpcHandler('printers:test');
      if (handler) {
        return await handler({}, request.body);
      }
      return await runTestPrint(request.body, reply);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to test printer';
      return reply.status(500).send({ success: false, error: message });
    }
  });

  app.post<{ Body: PrinterTestBody }>(
    '/api/printers/test',
    async (request, reply) => {
      try {
        return await runTestPrint(request.body, reply);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to test printer';
        return reply.status(500).send({ success: false, error: message });
      }
    },
  );
}
