/**
 * Print (order/receipt) routes — migrated from electron/http/routes/print.ts
 */
import { printersGetAllSettings } from '../../init/backend-loader';
import {
  getAvailablePrinters,
  isPrinterConfigured,
  printPngUsingSetting,
  scanForPrinters,
} from '../../print/printer';
import { getIpcHandler } from '../ipc-handlers';
import type { FastifyRouteContext } from '../types';

type PrintOrderBody = { orderData?: unknown; kitchenId?: number | null };
type PrintReceiptBody = { receiptData?: unknown };

export function registerPrintRoutes(ctx: FastifyRouteContext): void {
  const { app } = ctx;

  app.post<{ Body: PrintOrderBody }>('/api/print/order', async (request, reply) => {
    const { orderData, kitchenId } = request.body ?? {};
    if (!orderData) {
      return reply
        .status(400)
        .send({ success: false, error: 'orderData is required' });
    }

    try {
      const handler = getIpcHandler('print:order');
      if (handler) {
        const result = (await handler({}, orderData, kitchenId)) as {
          success?: boolean;
        };
        if (result.success) {
          return result;
        }
        return reply.status(500).send(result);
      }

      const { renderOrderToPng } = await import('../../print/render-kitchen-receipt');
      const png = await renderOrderToPng(orderData as Parameters<typeof renderOrderToPng>[0]);
      const settings = await printersGetAllSettings();
      const setting = settings.find(
        (s: any) =>
          s.kitchen_id === (kitchenId ?? null) &&
          s.printer_type === 'kitchen' &&
          s.is_active,
      );
      if (!isPrinterConfigured(setting)) {
        return reply.status(404).send({
          success: false,
          error: 'No printer configured for this kitchen',
        });
      }
      const printResult = await printPngUsingSetting(png, setting);
      if (!printResult.success) {
        return reply.status(500).send({
          success: false,
          error: printResult.error || 'Failed to send print job',
        });
      }
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Print failed';
      return reply.status(500).send({ success: false, error: message });
    }
  });

  app.post<{ Body: PrintReceiptBody }>(
    '/api/print/receipt',
    async (request, reply) => {
      const { receiptData } = request.body ?? {};
      if (!receiptData) {
        return reply
          .status(400)
          .send({ success: false, error: 'receiptData is required' });
      }

      try {
        const handler = getIpcHandler('print:receipt');
        if (handler) {
          const result = (await handler({}, receiptData)) as { success?: boolean };
          if (result.success) {
            return result;
          }
          return reply.status(500).send(result);
        }

        const { renderReceiptToPng } = await import('../../print/render-customer-receipt');
        const { mergeCustomerReceiptBranding } = await import('../../recipe-print-branding-store');
        const merged = await mergeCustomerReceiptBranding(
          receiptData as NonNullable<Parameters<typeof renderReceiptToPng>[0]>,
        );
        const png = await renderReceiptToPng(merged);
        const settings = await printersGetAllSettings();
        const setting = settings.find(
          (s: any) =>
            s.kitchen_id === null &&
            s.printer_type === 'customer' &&
            s.is_active,
        );
        if (!isPrinterConfigured(setting)) {
          return reply.status(404).send({
            success: false,
            error: 'No customer receipt printer configured',
          });
        }
        const printResult = await printPngUsingSetting(png, setting);
        if (!printResult.success) {
          return reply.status(500).send({
            success: false,
            error: printResult.error || 'Failed to send receipt',
          });
        }
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Print failed';
        return reply.status(500).send({ success: false, error: message });
      }
    },
  );

  app.get('/api/print/scan', async (request, reply) => {
    try {
      const printers = await scanForPrinters();
      return { printers };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scan failed';
      return reply.status(500).send({ printers: [], error: message });
    }
  });

  app.get('/api/print/printers', async (request, reply) => {
    try {
      const handler = getIpcHandler('print:getPrinters');
      if (handler) {
        return await handler({});
      }
      return await getAvailablePrinters();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to get printers';
      return reply.status(500).send({ success: false, error: message });
    }
  });
}
