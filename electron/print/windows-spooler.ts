/**
 * Windows Spooler printing — list installed printers and print PNG via GDI.
 * Uses a persistent PowerShell worker + printer-name cache for low latency.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  invalidateWindowsPrinterCache,
  getCachedWindowsPrinterList,
} from './windows-printer-cache';
import {
  listPrintersViaWorker,
  printPngViaWorker,
  warmupWindowsSpoolerWorker,
  shutdownWindowsSpoolerWorker,
  stopWindowsSpoolerWorker,
} from './windows-spooler-worker';

const execFileAsync = promisify(execFile);

export type WindowsPrinterInfo = {
  name: string;
  isDefault: boolean;
  status?: string;
};

export {
  warmupWindowsSpoolerWorker,
  shutdownWindowsSpoolerWorker,
  stopWindowsSpoolerWorker,
  invalidateWindowsPrinterCache,
};

function isWindows(): boolean {
  return process.platform === 'win32';
}

/**
 * Fallback list when the persistent worker is unavailable.
 */
async function listWindowsPrintersFallback(): Promise<WindowsPrinterInfo[]> {
  const script = `
$ErrorActionPreference = 'Stop'
$default = $null
try { $default = (Get-CimInstance Win32_Printer -Filter "Default=$true" -ErrorAction SilentlyContinue).Name } catch {}
$printers = @(Get-Printer -ErrorAction Stop | ForEach-Object {
  [PSCustomObject]@{
    name = $_.Name
    isDefault = ($null -ne $default -and $_.Name -eq $default)
    status = [string]$_.PrinterStatus
  }
})
$printers | ConvertTo-Json -Compress -Depth 3
`.trim();

  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { windowsHide: true, maxBuffer: 2 * 1024 * 1024, timeout: 20000 },
  );
  const trimmed = (stdout || '').trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed) as WindowsPrinterInfo | WindowsPrinterInfo[];
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list
    .filter((p) => p && typeof p.name === 'string' && p.name.trim() !== '')
    .map((p) => ({
      name: p.name,
      isDefault: Boolean(p.isDefault),
      status: p.status,
    }));
}

/**
 * List printers installed in Windows (cached 120s; served by persistent worker).
 */
export async function listWindowsPrinters(
  forceRefresh = false,
): Promise<WindowsPrinterInfo[]> {
  if (!isWindows()) {
    return [];
  }

  if (!forceRefresh) {
    const cached = getCachedWindowsPrinterList();
    if (cached) return cached;
  }

  try {
    return await listPrintersViaWorker(forceRefresh);
  } catch (err: any) {
    console.warn(
      '[WINDOWS-SPOOLER] Worker list failed, falling back to one-shot PowerShell:',
      err?.message || err,
    );
    try {
      return await listWindowsPrintersFallback();
    } catch (fallbackErr: any) {
      console.error(
        '[WINDOWS-SPOOLER] Failed to list printers:',
        fallbackErr?.message || fallbackErr,
      );
      return [];
    }
  }
}

/**
 * Print a PNG buffer to a named Windows printer via persistent GDI worker.
 */
export async function printPngViaWindowsSpooler(
  pngBuffer: Buffer,
  printerName: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isWindows()) {
    return { success: false, error: 'Windows Spooler printing is only available on Windows' };
  }

  return printPngViaWorker(pngBuffer, printerName);
}
