/**
 * Print (order/receipt) HTTP routes - routes through IPC handlers for tablets/LAN.
 */
import { ipcMain } from 'electron';
import { getService } from '../../init/backend-loader';
import { PrintersService } from '../../init/backend-loader';
import { getAvailablePrinters, printPngToPrinter, scanForPrinters } from '../../print/printer';
import type { RouteContext } from '../types';

export function registerPrintRoutes(ctx: RouteContext) {
  const { app, asyncHandler } = ctx;

  app.post('/api/print/order', asyncHandler(async (req, res) => {
    const { orderData, kitchenId } = req.body;
    if (!orderData) {
      return res.status(400).json({ success: false, error: 'orderData is required' });
    }
    try {
      const handlerMap = (ipcMain as any)._handlers;
      if (!handlerMap || !handlerMap.has('print:order')) {
        const { renderOrderToPng } = await import('../../print/render-kitchen-receipt');
        const png = await renderOrderToPng(orderData);
        const printersService = getService(PrintersService);
        const settings = await printersService.getAllSettings();
        const setting = settings.find((s: any) => s.kitchen_id === (kitchenId ?? null) && s.printer_type === 'kitchen' && s.is_active);
        if (!setting || !setting.printer_ip) {
          return res.status(404).json({ success: false, error: 'No printer configured for this kitchen' });
        }
        const printResult = await printPngToPrinter(png, setting.printer_ip, setting.printer_port);
        if (!printResult.success) {
          return res.status(500).json({ success: false, error: printResult.error || 'Failed to send print job' });
        }
        return res.json({ success: true });
      }
      const handler = handlerMap.get('print:order');
      const result = await handler({} as any, orderData, kitchenId);
      if (result.success) res.json(result);
      else res.status(500).json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Print failed' });
    }
  }));

  app.post('/api/print/receipt', asyncHandler(async (req, res) => {
    const { receiptData } = req.body;
    if (!receiptData) {
      return res.status(400).json({ success: false, error: 'receiptData is required' });
    }
    try {
      const handlerMap = (ipcMain as any)._handlers;
      if (!handlerMap || !handlerMap.has('print:receipt')) {
        const { renderReceiptToPng } = await import('../../print/render-customer-receipt');
        const png = await renderReceiptToPng(receiptData);
        const printersService = getService(PrintersService);
        const settings = await printersService.getAllSettings();
        const setting = settings.find((s: any) => s.kitchen_id === null && s.printer_type === 'customer' && s.is_active);
        if (!setting || !setting.printer_ip) {
          return res.status(404).json({ success: false, error: 'No customer receipt printer configured' });
        }
        const printResult = await printPngToPrinter(png, setting.printer_ip, setting.printer_port);
        if (!printResult.success) {
          return res.status(500).json({ success: false, error: printResult.error || 'Failed to send receipt' });
        }
        return res.json({ success: true });
      }
      const handler = handlerMap.get('print:receipt');
      const result = await handler({} as any, receiptData);
      if (result.success) res.json(result);
      else res.status(500).json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Print failed' });
    }
  }));

  app.get('/api/print/scan', asyncHandler(async (req, res) => {
    try {
      const printers = await scanForPrinters();
      return res.json({ printers });
    } catch (error: any) {
      return res.status(500).json({ printers: [], error: error.message });
    }
  }));

  app.get('/api/print/printers', asyncHandler(async (req, res) => {
    try {
      const handlerMap = (ipcMain as any)._handlers;
      if (!handlerMap || !handlerMap.has('print:getPrinters')) {
        const printers = await getAvailablePrinters();
        return res.json(printers);
      }
      const handler = handlerMap.get('print:getPrinters');
      const printers = await handler({} as any);
      res.json(printers);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to get printers' });
    }
  }));
}
