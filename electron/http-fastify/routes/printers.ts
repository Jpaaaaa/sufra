/**
 * Printers routes — migrated from electron/http/routes/printers.ts
 */
import {
  printersGetAllSettings,
  printersSaveSetting,
} from '../../init/backend-loader';
import {
  getAvailablePrinters,
  isPrinterConfigured,
  printPngUsingSetting,
} from '../../print/printer';
import {
  customerTestReceiptData,
  kitchenTestPrintData,
} from '../../print/printer-test-samples';
import { getIpcHandler } from '../ipc-handlers';
import type { FastifyRouteContext } from '../types';
import { sendRouteError } from '../errors';

type PrinterTestBody = {
  connection_type?: 'network' | 'windows_spooler';
  printer_ip?: string | null;
  printer_port?: number;
  printer_name?: string | null;
  kitchen_id?: number | null;
  kind?: 'customer' | 'kitchen';
  kitchen_name?: string;
  use_saved?: boolean;
};

async function renderSamplePng(
  kind: 'customer' | 'kitchen',
  kitchenName?: string,
): Promise<Buffer> {
  if (kind === 'customer') {
    const { renderReceiptToPng } = await import('../../print/render-customer-receipt');
    const { mergeCustomerReceiptBranding } = await import('../../recipe-print-branding-store');
    const merged = await mergeCustomerReceiptBranding(customerTestReceiptData());
    return renderReceiptToPng(merged);
  }
  const { renderOrderToPng } = await import('../../print/render-kitchen-receipt');
  return renderOrderToPng(kitchenTestPrintData(kitchenName));
}

async function runTestPrint(data: PrinterTestBody, reply: import('fastify').FastifyReply) {
  let setting: {
    connection_type?: string;
    printer_ip?: string | null;
    printer_port?: number;
    printer_name?: string | null;
    printer_type?: string;
  } | null = null;

  if (
    data.use_saved ||
    (data.kitchen_id !== undefined &&
      data.printer_ip === undefined &&
      data.printer_name === undefined &&
      !data.connection_type)
  ) {
    const settings = await printersGetAllSettings();
    const kitchenId = data.kitchen_id ?? null;
    setting =
      settings.find((s: any) =>
        kitchenId === null
          ? s.kitchen_id === null && s.printer_type === 'customer' && s.is_active
          : s.kitchen_id === kitchenId && s.printer_type === 'kitchen' && s.is_active,
      ) || null;
    if (!isPrinterConfigured(setting)) {
      return reply.status(400).send({
        success: false,
        error:
          kitchenId === null
            ? 'No customer receipt printer configured'
            : 'No printer configured for this kitchen',
      });
    }
  } else {
    setting = {
      connection_type:
        data.connection_type === 'windows_spooler' ? 'windows_spooler' : 'network',
      printer_ip: data.printer_ip ?? null,
      printer_port: data.printer_port || 9100,
      printer_name: data.printer_name ?? null,
    };
    if (!isPrinterConfigured(setting)) {
      return reply.status(400).send({
        success: false,
        error:
          setting.connection_type === 'windows_spooler'
            ? 'Windows printer name is required'
            : 'Printer IP address is required',
      });
    }
  }

  const kind: 'customer' | 'kitchen' =
    data.kind ||
    (setting?.printer_type === 'customer' || data.kitchen_id === null
      ? 'customer'
      : 'kitchen');

  const png = await renderSamplePng(kind, data.kitchen_name);
  if (!png || png.length < 100) {
    return reply
      .status(500)
      .send({ success: false, error: 'Failed to generate test PNG' });
  }

  const printResult = await printPngUsingSetting(png, setting!);
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

  app.post<{ Body: { kind?: 'customer' | 'kitchen'; kitchen_name?: string } }>(
    '/api/printers/preview',
    async (request, reply) => {
      try {
        const kind = request.body?.kind === 'kitchen' ? 'kitchen' : 'customer';
        const png = await renderSamplePng(kind, request.body?.kitchen_name);
        if (!png || png.length < 100) {
          return reply
            .status(500)
            .send({ success: false, error: 'Failed to generate preview PNG' });
        }
        return {
          success: true,
          imageBase64: png.toString('base64'),
          kind,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to generate preview';
        return reply.status(500).send({ success: false, error: message });
      }
    },
  );
}
