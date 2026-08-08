/**
 * IPC handlers: printers, print, export-pdf.
 */
import { ipcMain, BrowserWindow, app, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import {
  healthGetHealth,
  generateReportTemplate,
  printersGetAllSettings,
  printersSaveSetting,
} from '../../init/backend-loader';
import {
  getAvailablePrinters,
  isPrinterConfigured,
  printPngUsingSetting,
  scanForPrinters,
  warmupWindowsSpooler,
} from '../../print/printer';
import {
  customerTestReceiptData,
  kitchenTestPrintData,
} from '../../print/printer-test-samples';
import {
  readRecipePrintBranding,
  writeRecipePrintBranding,
  saveRestaurantLogoFromFile,
  removeRestaurantLogo,
  getRestaurantLogoPreviewBase64,
  mergeCustomerReceiptBranding,
} from '../../recipe-print-branding-store';
import { buildRecipePreviewSample } from '../../print/recipe-preview-sample';
import { invalidateWindowsPrinterCache } from '../../print/windows-printer-cache';

const LOCKED_FILE_ERROR_CODES = new Set(['EBUSY', 'EPERM', 'EACCES']);

function writePdfBufferToDownloads(
  downloadsPath: string,
  baseFileName: string,
  buffer: Buffer,
): { filePath: string; fileName: string } {
  const ext = path.extname(baseFileName);
  const base = path.basename(baseFileName, ext);
  const candidates = [
    baseFileName,
    `${base}-${Date.now()}${ext}`,
    ...Array.from({ length: 9 }, (_, i) => `${base} (${i + 2})${ext}`),
  ];

  let lastError: NodeJS.ErrnoException | null = null;

  for (const fileName of candidates) {
    const filePath = path.join(downloadsPath, fileName);
    try {
      fs.writeFileSync(filePath, buffer);
      return { filePath, fileName };
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (LOCKED_FILE_ERROR_CODES.has(error.code ?? '')) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    lastError?.code === 'EBUSY'
      ? 'الملف مفتوح في برنامج آخر. أغلق ملف PDF السابق ثم حاول مرة أخرى.'
      : lastError?.message || 'تعذّر حفظ ملف PDF',
  );
}

type PrinterTestPayload = {
  connection_type?: 'network' | 'windows_spooler';
  printer_ip?: string | null;
  printer_port?: number;
  printer_name?: string | null;
  /** When set without inline destination, use saved settings for this kitchen (null = customer). */
  kitchen_id?: number | null;
  kind?: 'customer' | 'kitchen';
  kitchen_name?: string;
  use_saved?: boolean;
};

async function resolveTestDestination(
  data: PrinterTestPayload,
): Promise<{ setting: any; error?: string }> {
  if (data.use_saved || (data.kitchen_id !== undefined && data.printer_ip === undefined && data.printer_name === undefined && !data.connection_type)) {
    const settings = await printersGetAllSettings();
    const kitchenId = data.kitchen_id ?? null;
    const setting = settings.find((s: any) =>
      kitchenId === null
        ? s.kitchen_id === null && s.printer_type === 'customer' && s.is_active
        : s.kitchen_id === kitchenId && s.printer_type === 'kitchen' && s.is_active,
    );
    if (!setting || !isPrinterConfigured(setting)) {
      return {
        setting: null,
        error:
          kitchenId === null
            ? 'No customer receipt printer configured'
            : 'No printer configured for this kitchen',
      };
    }
    return { setting };
  }

  const connection_type =
    data.connection_type === 'windows_spooler' ? 'windows_spooler' : 'network';
  const setting = {
    connection_type,
    printer_ip: data.printer_ip ?? null,
    printer_port: data.printer_port ?? 9100,
    printer_name: data.printer_name ?? null,
  };
  if (!isPrinterConfigured(setting)) {
    return {
      setting: null,
      error:
        connection_type === 'windows_spooler'
          ? 'Windows printer name is required'
          : 'Printer IP address is required',
    };
  }
  return { setting };
}

async function renderSamplePng(
  kind: 'customer' | 'kitchen',
  kitchenName?: string,
): Promise<Buffer> {
  if (kind === 'customer') {
    const { renderReceiptToPng } = await import('../../print/render-customer-receipt');
    const merged = await mergeCustomerReceiptBranding(customerTestReceiptData());
    return renderReceiptToPng(merged);
  }
  const { renderOrderToPng } = await import('../../print/render-kitchen-receipt');
  return renderOrderToPng(kitchenTestPrintData(kitchenName));
}

export function registerPrintHandlers() {
  warmupWindowsSpooler();

  ipcMain.handle('backend:health', async () => {
    try {
      return await healthGetHealth();
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  });

  ipcMain.handle('printers:getSettings', async () => printersGetAllSettings());
  ipcMain.handle('printers:available', async (_e, forceRefresh?: boolean) => {
    if (forceRefresh) invalidateWindowsPrinterCache();
    return getAvailablePrinters(Boolean(forceRefresh));
  });
  ipcMain.handle('printers:scan', async () => {
    try {
      return await scanForPrinters();
    } catch (err: any) {
      console.error('[PRINTER-SCAN] Error:', err);
      return [];
    }
  });
  ipcMain.handle('printers:saveSettings', async (_, data: any) => printersSaveSetting(data));
  ipcMain.handle('recipePrint:getSettings', async () => readRecipePrintBranding());
  ipcMain.handle(
    'recipePrint:saveSettings',
    async (_, data: { restaurantName?: string; thankYouLine?: string; mobileNumber?: string }) =>
      writeRecipePrintBranding(data ?? {}),
  );
  ipcMain.handle('recipePrint:pickLogo', async () => {
    try {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
      const options: Electron.OpenDialogOptions = {
        title: 'اختر شعار المطعم',
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] },
        ],
        properties: ['openFile'],
      };
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);
      if (result.canceled || !result.filePaths[0]) {
        return { success: false as const, error: 'CANCELLED' };
      }
      const branding = await saveRestaurantLogoFromFile(result.filePaths[0]);
      const preview = await getRestaurantLogoPreviewBase64();
      return {
        success: true as const,
        branding,
        logoPreviewBase64: preview,
      };
    } catch (err: any) {
      console.error('[recipePrint:pickLogo]', err);
      return { success: false as const, error: err?.message || 'فشل رفع الشعار' };
    }
  });
  ipcMain.handle('recipePrint:removeLogo', async () => {
    try {
      const branding = await removeRestaurantLogo();
      return { success: true as const, branding };
    } catch (err: any) {
      console.error('[recipePrint:removeLogo]', err);
      return { success: false as const, error: err?.message || 'فشل حذف الشعار' };
    }
  });
  ipcMain.handle('recipePrint:logoPreview', async () => {
    try {
      const preview = await getRestaurantLogoPreviewBase64();
      return { success: true as const, logoPreviewBase64: preview };
    } catch (err: any) {
      return { success: false as const, error: err?.message || 'فشل تحميل الشعار' };
    }
  });
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
        const settings = await printersGetAllSettings();
        const setting = settings.find(
          (s: any) => s.kitchen_id === null && s.printer_type === 'customer' && s.is_active,
        );
        if (!isPrinterConfigured(setting)) {
          return {
            success: false as const,
            error: 'لم يتم ضبط طابعة إيصال العميل — من إعدادات الطابعات',
          };
        }
        const printResult = await printPngUsingSetting(png, setting);
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

  ipcMain.handle('printers:preview', async (_, data: PrinterTestPayload = {}) => {
    try {
      const kind: 'customer' | 'kitchen' =
        data.kind || (data.kitchen_id != null ? 'kitchen' : 'customer');
      const buf = await renderSamplePng(kind, data.kitchen_name);
      if (!buf || buf.length < 100) {
        return { success: false as const, error: 'Failed to generate preview PNG' };
      }
      return { success: true as const, imageBase64: buf.toString('base64'), kind };
    } catch (err: any) {
      console.error('[printers:preview]', err);
      return { success: false as const, error: err?.message || 'Preview failed' };
    }
  });

  ipcMain.handle('printers:test', async (_, data: PrinterTestPayload = {}) => {
    try {
      const { setting, error } = await resolveTestDestination(data);
      if (!setting) {
        return { success: false, error: error || 'Printer not configured' };
      }
      const kind: 'customer' | 'kitchen' =
        data.kind ||
        (setting.printer_type === 'customer' || data.kitchen_id === null
          ? 'customer'
          : 'kitchen');
      const png = await renderSamplePng(kind, data.kitchen_name);
      if (!png || png.length < 100) {
        return { success: false, error: 'Failed to generate test PNG' };
      }
      const printResult = await printPngUsingSetting(png, setting);
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
      const settings = await printersGetAllSettings();
      const setting = settings.find(
        (s: any) =>
          s.kitchen_id === (kitchenId ?? null) && s.printer_type === 'kitchen' && s.is_active,
      );
      if (!isPrinterConfigured(setting)) {
        return { success: false, error: 'No printer configured for this kitchen' };
      }
      const printResult = await printPngUsingSetting(png, setting);
      return printResult.success
        ? { success: true }
        : { success: false, error: printResult.error || 'Failed to send print job to printer' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unknown error' };
    }
  });

  ipcMain.handle('print:receipt', async (_event, receiptData: any) => {
    try {
      const { renderReceiptToPng } = await import('../../print/render-customer-receipt');
      const merged = await mergeCustomerReceiptBranding(receiptData ?? {});
      const png = await renderReceiptToPng(merged);
      const settings = await printersGetAllSettings();
      const setting = settings.find(
        (s: any) => s.kitchen_id === null && s.printer_type === 'customer' && s.is_active,
      );
      if (!isPrinterConfigured(setting)) {
        return { success: false, error: 'No customer receipt printer configured' };
      }
      const printResult = await printPngUsingSetting(png, setting);
      return printResult.success
        ? { success: true }
        : { success: false, error: printResult.error || 'Failed to send receipt to printer' };
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

  ipcMain.handle(
    'export-pdf',
    async (
      _event,
      exportData: {
        type: 'daily' | 'weekly' | 'monthly' | 'yearly';
        date: string;
        data: { summary: any; items: any[]; employees: any[]; orders: any[]; drawer?: any };
      },
    ) => {
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
          const timeout = setTimeout(
            () => reject(new Error('Page load timeout after 120 seconds')),
            120000,
          );
          pdfWin!.webContents.once('dom-ready', () => {
            clearTimeout(timeout);
            resolve();
          });
          pdfWin!.webContents.once('did-fail-load', (_, __, errorDescription) => {
            clearTimeout(timeout);
            reject(new Error(`Page load failed: ${errorDescription}`));
          });
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
        const baseFileName = `sufra-pos-${exportData.type}-${exportData.date}.pdf`;
        const { filePath, fileName } = writePdfBufferToDownloads(downloadsPath, baseFileName, pdfBuffer);
        return { success: true, filePath, fileName };
      } catch (error: any) {
        return { success: false, error: error.message || 'Unknown error during PDF export' };
      } finally {
        if (pdfWin) {
          try {
            pdfWin.close();
          } catch {
            /* ignore */
          }
          pdfWin = null;
        }
      }
    },
  );
}
