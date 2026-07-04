/**
 * Printers HTTP routes.
 */
import { ipcMain } from 'electron';
import { getService } from '../../init/backend-loader';
import { PrintersService } from '../../init/backend-loader';
import { printPngToPrinter, getAvailablePrinters } from '../../print/printer';
import type { RouteContext } from '../types';

export function registerPrintersRoutes(ctx: RouteContext) {
  const { app, asyncHandler } = ctx;

  app.get('/api/printers/settings', asyncHandler(async (req, res) => {
    const printersService = getService(PrintersService);
    const settings = await printersService.getAllSettings();
    res.json(settings);
  }));

  app.get('/api/printers/available', asyncHandler(async (req, res) => {
    const printers = await getAvailablePrinters();
    res.json(printers);
  }));

  app.post('/api/printers/settings', asyncHandler(async (req, res) => {
    const printersService = getService(PrintersService);
    const setting = await printersService.saveSetting(req.body);
    res.json(setting);
  }));

  app.get('/printers/settings', asyncHandler(async (req, res) => {
    try {
      const handlerMap = (ipcMain as any)._handlers;
      if (!handlerMap || !handlerMap.has('printers:getSettings')) {
        const printersService = getService(PrintersService);
        const settings = await printersService.getAllSettings();
        return res.json(settings);
      }
      const handler = handlerMap.get('printers:getSettings');
      const settings = await handler({} as any);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to get printer settings' });
    }
  }));

  app.get('/printers/available', asyncHandler(async (req, res) => {
    try {
      const handlerMap = (ipcMain as any)._handlers;
      if (!handlerMap || !handlerMap.has('printers:available')) {
        const printers = await getAvailablePrinters();
        return res.json(printers);
      }
      const handler = handlerMap.get('printers:available');
      const printers = await handler({} as any);
      res.json(printers);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to get available printers' });
    }
  }));

  app.post('/printers/settings', asyncHandler(async (req, res) => {
    try {
      const handlerMap = (ipcMain as any)._handlers;
      if (!handlerMap || !handlerMap.has('printers:saveSettings')) {
        const printersService = getService(PrintersService);
        const setting = await printersService.saveSetting(req.body);
        return res.json(setting);
      }
      const handler = handlerMap.get('printers:saveSettings');
      const result = await handler({} as any, req.body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to save printer settings' });
    }
  }));

  app.post('/printers/test', asyncHandler(async (req, res) => {
    try {
      const handlerMap = (ipcMain as any)._handlers;
      if (!handlerMap || !handlerMap.has('printers:test')) {
        const data = req.body;
        if (!data || !data.printer_ip || data.printer_ip.trim() === '') {
          return res.status(400).json({ success: false, error: 'Printer IP address is required' });
        }
        const testData = {
          orderId: 999,
          table: 1,
          hall: 'اختبار',
          items: [{ id: 1, item_name: 'طباعة تجريبية - SUFRA POS', quantity: 1, price: 0 }],
          totals: { total: 0 },
          timestamp: new Date().toISOString(),
          restaurantName: 'سفرة',
        };
        const { renderOrderToPng } = await import('../../print/render-kitchen-receipt');
        const png = await renderOrderToPng(testData);
        const port = data.printer_port || 9100;
        const printResult = await printPngToPrinter(png, data.printer_ip, port);
        if (printResult.success) {
          return res.json({ success: true, message: 'Test print sent successfully' });
        }
        return res.status(500).json({ success: false, error: printResult.error || 'Failed to send test print' });
      }
      const handler = handlerMap.get('printers:test');
      const result = await handler({} as any, req.body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to test printer' });
    }
  }));

  app.post('/api/printers/test', asyncHandler(async (req, res) => {
    const data = req.body;
    if (!data || !data.printer_ip || data.printer_ip.trim() === '') {
      return res.status(400).json({ success: false, error: 'Printer IP address is required' });
    }
    const testData = {
      orderId: 999,
      table: 1,
      hall: 'اختبار',
      items: [{ id: 1, item_name: 'طباعة تجريبية - SUFRA POS', quantity: 1, price: 0 }],
      totals: { total: 0 },
      timestamp: new Date().toISOString(),
      restaurantName: 'سفرة',
    };
    const { renderOrderToPng } = await import('../../print/render-kitchen-receipt');
    const png = await renderOrderToPng(testData);
    if (!png || png.length < 100) {
      return res.status(500).json({ success: false, error: 'Failed to generate test PNG' });
    }
    const port = data.printer_port || 9100;
    const printResult = await printPngToPrinter(png, data.printer_ip, port);
    if (printResult.success) {
      res.json({ success: true, message: 'Test print sent successfully' });
    } else {
      res.status(500).json({ success: false, error: printResult.error || 'Failed to send test print' });
    }
  }));
}
