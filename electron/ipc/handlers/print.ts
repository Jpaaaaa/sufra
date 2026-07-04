/**
 * IPC handlers: printers, print, export-pdf.
 */
import { ipcMain, BrowserWindow, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { getService, HealthController, PrintersService, generateReportTemplate } from '../../init/backend-loader';
import { getAvailablePrinters, printPngToPrinter, scanForPrinters } from '../../print/printer';
import {
  readRecipePrintBranding,
  writeRecipePrintBranding,
} from '../../recipe-print-branding-store';
import { buildRecipePreviewSample } from '../../print/recipe-preview-sample';

export function registerPrintHandlers() {
  ipcMain.handle('backend:health', async () => {
    try {
      const healthController = getService(HealthController);
      return await healthController.getHealth();
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  });

  ipcMain.handle('printers:getSettings', async () => {
    return await getService(PrintersService).getAllSettings();
  });
  ipcMain.handle('printers:available', async () => getAvailablePrinters());
  ipcMain.handle('printers:scan', async () => {
    try {
      return await scanForPrinters();
    } catch (err: any) {
      console.error('[PRINTER-SCAN] Error:', err);
      return [];
    }
  });
  ipcMain.handle('printers:saveSettings', async (_, data: any) => {
    return await getService(PrintersService).saveSetting(data);
  });
  ipcMain.handle('recipePrint:getSettings', async () => readRecipePrintBranding());
  ipcMain.handle('recipePrint:saveSettings', async (_, data: { restaurantName?: string; thankYouLine?: string; mobileNumber?: string }) =>
    writeRecipePrintBranding(data ?? {}),
  );
  ipcMain.handle(
    'recipePrint:preview',
    async (_, branding: { restaurantName?: string; thankYouLine?: string; mobileNumber?: string }) => {
      try {
        const { renderRecipeToPng } = await import('../../print/render-recipe');
        const sample = buildRecipePreviewSample(branding ?? {});
        const buf = await renderRecipeToPng(sample, { mergeBranding: false });
        return { success: true as const, imageBase64: buf.toString('base64') };
      } catch (err: any) {
        console.error('[recipePrint:preview]', err);
        return { success: false as const, error: err?.message || 'Preview failed' };
      }
    },
  );
  ipcMain.handle(
    'recipePrint:print',
    async (_, branding: { restaurantName?: string; thankYouLine?: string; mobileNumber?: string }) => {
      try {
        const { renderRecipeToPng } = await import('../../print/render-recipe');
        const sample = buildRecipePreviewSample(branding ?? {});
        const png = await renderRecipeToPng(sample, { mergeBranding: false });
        const settings = await getService(PrintersService).getAllSettings();
        const setting = settings.find(
          (s: any) => s.kitchen_id === null && s.printer_type === 'customer' && s.is_active,
        );
        if (!setting?.printer_ip) {
          return {
            success: false as const,
            error: 'لم يتم ضبط طابعة إيصال العميل — من إعدادات الطابعات',
          };
        }
        const printResult = await printPngToPrinter(png, setting.printer_ip, setting.printer_port);
        return printResult.success
          ? { success: true as const }
          : {
              success: false as const,
              error: printResult.error || 'تعذّر إرسال الطباعة إلى الطابعة',
            };
      } catch (err: any) {
        console.error('[recipePrint:print]', err);
        return { success: false as const, error: err?.message || 'فشلت الطباعة' };
      }
    },
  );

  ipcMain.handle('printers:test', async (_, data: any) => {
    try {
      if (!data?.printer_ip?.trim()) {
        return { success: false, error: 'Printer IP address is required' };
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
        return { success: false, error: 'Failed to generate test PNG' };
      }
      const port = data.printer_port || 9100;
      const printResult = await printPngToPrinter(png, data.printer_ip, port);
      return printResult.success
        ? { success: true, message: 'Test print sent successfully' }
        : { success: false, error: printResult.error || 'Failed to send test print to printer' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Unknown error during test print' };
    }
  });

  ipcMain.handle('print:order', async (_event, orderData: any, kitchenId?: number | null) => {
    try {
      const { renderOrderToPng } = await import('../../print/render-kitchen-receipt');
      const png = await renderOrderToPng(orderData);
      const settings = await getService(PrintersService).getAllSettings();
      const setting = settings.find((s: any) => s.kitchen_id === (kitchenId ?? null) && s.printer_type === 'kitchen' && s.is_active);
      if (!setting?.printer_ip) {
        return { success: false, error: 'No printer configured for this kitchen' };
      }
      const printResult = await printPngToPrinter(png, setting.printer_ip, setting.printer_port);
      return printResult.success ? { success: true } : { success: false, error: printResult.error || 'Failed to send print job to printer' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unknown error' };
    }
  });
  ipcMain.handle('print:receipt', async (_event, receiptData: any) => {
    try {
      const { renderReceiptToPng } = await import('../../print/render-customer-receipt');
      const png = await renderReceiptToPng(receiptData);
      const settings = await getService(PrintersService).getAllSettings();
      const setting = settings.find((s: any) => s.kitchen_id === null && s.printer_type === 'customer' && s.is_active);
      if (!setting?.printer_ip) {
        return { success: false, error: 'No customer receipt printer configured' };
      }
      const printResult = await printPngToPrinter(png, setting.printer_ip, setting.printer_port);
      return printResult.success ? { success: true } : { success: false, error: printResult.error || 'Failed to send receipt to printer' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unknown error' };
    }
  });
  ipcMain.handle('print:getPrinters', async () => {
    try {
      return await getAvailablePrinters();
    } catch {
      return [];
    }
  });

  ipcMain.handle('export-pdf', async (_event, exportData: {
    type: 'daily' | 'weekly' | 'monthly' | 'yearly';
    date: string;
    data: { summary: any; items: any[]; employees: any[]; orders: any[]; drawer?: any };
  }) => {
    let pdfWin: BrowserWindow | null = null;
    try {
      const html = generateReportTemplate(exportData);
      pdfWin = new BrowserWindow({
        show: false,
        width: 1200,
        height: 1600,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: false },
      });
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
      const loadPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Page load timeout after 120 seconds')), 120000);
        pdfWin!.webContents.once('dom-ready', () => { clearTimeout(timeout); resolve(); });
        pdfWin!.webContents.once('did-fail-load', (_, __, errorDescription) => { clearTimeout(timeout); reject(new Error(`Page load failed: ${errorDescription}`)); });
      });
      pdfWin.loadURL(dataUrl);
      await loadPromise;
      await pdfWin.webContents.executeJavaScript(`
        new Promise((resolve) => {
          if (document.fonts?.ready) document.fonts.ready.then(resolve).catch(() => setTimeout(resolve, 1000));
          else setTimeout(resolve, 1000);
        })
      `);
      await new Promise((resolve) => setTimeout(resolve, 500));
      const pdfBuffer = await pdfWin.webContents.printToPDF({
        pageSize: 'A4',
        margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 },
        printBackground: true,
        preferCSSPageSize: false,
      });
      if (!pdfBuffer || pdfBuffer.length === 0) throw new Error('PDF generation returned empty buffer');
      const downloadsPath = app.getPath('downloads');
      const fileName = `sufra-pos-${exportData.type}-${exportData.date}.pdf`;
      const filePath = path.join(downloadsPath, fileName);
      fs.writeFileSync(filePath, pdfBuffer);
      return { success: true, filePath, fileName };
    } catch (error: any) {
      return { success: false, error: error.message || 'Unknown error during PDF export' };
    } finally {
      if (pdfWin) {
        try { pdfWin.close(); } catch { /* ignore */ }
        pdfWin = null;
      }
    }
  });
}
