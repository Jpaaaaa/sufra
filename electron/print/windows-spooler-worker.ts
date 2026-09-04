/**
 * Persistent PowerShell worker for Windows Spooler GDI printing.
 * Avoids per-job powershell.exe spawn + System.Drawing load cost.
 */
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { app } from 'electron';
import {
  getCachedWindowsPrinterList,
  resolveWindowsPrinterName,
  setCachedWindowsPrinterList,
} from './windows-printer-cache';

export type WindowsPrinterInfo = {
  name: string;
  isDefault: boolean;
  status?: string;
};

type Pending = {
  resolve: (line: string) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

let worker: ChildProcessWithoutNullStreams | null = null;
let readyPromise: Promise<void> | null = null;
let workerReady = false;
let queue: Promise<unknown> = Promise.resolve();
let pending: Pending | null = null;
let stdoutBuffer = '';
let shuttingDown = false;

function workerScriptPath(): string {
  const base = app.isReady()
    ? app.getPath('userData')
    : path.join(os.tmpdir(), 'sufra-spooler');
  const dir = path.join(base, 'print-worker');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'windows-spooler-worker.ps1');
}

function writeWorkerScript(): string {
  const scriptPath = workerScriptPath();
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

function Write-Line([string]$text) {
  [Console]::Out.WriteLine($text)
  [Console]::Out.Flush()
}

function Invoke-ListPrinters {
  $default = $null
  try {
    $default = (Get-CimInstance Win32_Printer -Filter "Default=$true" -ErrorAction SilentlyContinue).Name
  } catch {}
  $printers = @(Get-Printer -ErrorAction Stop | ForEach-Object {
    [PSCustomObject]@{
      name = $_.Name
      isDefault = ($null -ne $default -and $_.Name -eq $default)
      status = [string]$_.PrinterStatus
    }
  })
  $json = ($printers | ConvertTo-Json -Compress -Depth 3)
  if (-not $json) { $json = '[]' }
  Write-Line ("OK:" + $json)
}

function Invoke-PrintPng([string]$printerName, [string]$imagePath) {
  if (-not (Test-Path -LiteralPath $imagePath)) {
    throw "Image not found: $imagePath"
  }
  $img = [System.Drawing.Image]::FromFile($imagePath)
  try {
    $doc = New-Object System.Drawing.Printing.PrintDocument
    $doc.PrinterSettings.PrinterName = $printerName
    if (-not $doc.PrinterSettings.IsValid) {
      throw "Windows reports printer as invalid: $printerName"
    }
    $doc.DocumentName = 'SUFRA POS'
    $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
    $script:printImage = $img
    $doc.add_PrintPage({
      param($sender, $e)
      $bounds = $e.PageBounds
      $maxW = [Math]::Max(1, $bounds.Width)
      $scale = $maxW / [double]$script:printImage.Width
      $w = $maxW
      $h = [int]([Math]::Ceiling($script:printImage.Height * $scale))
      $e.Graphics.DrawImage($script:printImage, 0, 0, $w, $h)
      $e.HasMorePages = $false
    })
    $doc.Print()
    $doc.Dispose()
  } finally {
    $img.Dispose()
  }
  Write-Line 'OK'
}

Write-Line 'READY'

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  try {
    $job = $line | ConvertFrom-Json
    switch ($job.op) {
      'ping' { Write-Line 'OK' }
      'list' { Invoke-ListPrinters }
      'print' {
        if (-not $job.printer -or -not $job.imagePath) {
          throw 'print requires printer and imagePath'
        }
        Invoke-PrintPng ([string]$job.printer) ([string]$job.imagePath)
      }
      default { throw ("unknown op: " + $job.op) }
    }
  } catch {
    $msg = ($_.Exception.Message -replace '[\\r\\n]+', ' ').Trim()
    if (-not $msg) { $msg = 'unknown error' }
    Write-Line ("ERR:" + $msg)
  }
}
`.trim();

  fs.writeFileSync(scriptPath, script, 'utf8');
  return scriptPath;
}

function rejectPending(err: Error): void {
  if (!pending) return;
  clearTimeout(pending.timer);
  const p = pending;
  pending = null;
  p.reject(err);
}

function handleStdoutLine(line: string): void {
  const trimmed = line.replace(/\r$/, '');
  if (!trimmed) return;

  if (!workerReady) {
    if (trimmed === 'READY') {
      workerReady = true;
    }
    return;
  }

  if (!pending) {
    console.warn('[spooler-worker] unexpected stdout:', trimmed);
    return;
  }

  clearTimeout(pending.timer);
  const p = pending;
  pending = null;
  p.resolve(trimmed);
}

function killWorkerProcess(): void {
  if (!worker) return;
  const proc = worker;
  worker = null;
  workerReady = false;
  try {
    proc.kill();
  } catch {
    /* ignore */
  }
}

async function startWorker(): Promise<void> {
  if (shuttingDown) throw new Error('Spooler worker shutting down');
  if (worker && !worker.killed && workerReady) return;

  killWorkerProcess();
  stdoutBuffer = '';
  workerReady = false;

  const scriptPath = writeWorkerScript();
  console.log('[spooler-worker] starting', scriptPath);

  const proc = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
    {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );

  worker = proc;
  proc.stdout.setEncoding('utf8');
  proc.stderr.setEncoding('utf8');

  proc.stdout.on('data', (chunk: string) => {
    stdoutBuffer += chunk;
    let idx: number;
    while ((idx = stdoutBuffer.indexOf('\n')) >= 0) {
      const line = stdoutBuffer.slice(0, idx);
      stdoutBuffer = stdoutBuffer.slice(idx + 1);
      handleStdoutLine(line);
    }
  });

  proc.stderr.on('data', (chunk: string) => {
    const text = String(chunk).trim();
    if (text) console.error('[spooler-worker] stderr:', text);
  });

  proc.on('exit', (code, signal) => {
    console.warn(`[spooler-worker] exited code=${code} signal=${signal}`);
    if (worker === proc) {
      worker = null;
      workerReady = false;
      readyPromise = null;
    }
    rejectPending(new Error(`Windows Spooler worker exited (code=${code})`));
  });

  proc.on('error', (err) => {
    console.error('[spooler-worker] process error:', err);
    if (worker === proc) {
      worker = null;
      workerReady = false;
      readyPromise = null;
    }
    rejectPending(err instanceof Error ? err : new Error(String(err)));
  });

  const readyDeadline = Date.now() + 30000;
  while (!workerReady) {
    if (!worker || worker.killed) {
      throw new Error('Worker exited before READY');
    }
    if (Date.now() > readyDeadline) {
      killWorkerProcess();
      throw new Error('Windows Spooler worker READY timeout');
    }
    await new Promise((r) => setTimeout(r, 25));
  }

  await sendRaw({ op: 'ping' }, 10000);
  console.log('[spooler-worker] ✓ READY');
}

function ensureWorkerReady(): Promise<void> {
  if (process.platform !== 'win32') {
    return Promise.reject(new Error('Windows only'));
  }
  if (worker && !worker.killed && workerReady && readyPromise) {
    return readyPromise;
  }
  readyPromise = startWorker().catch((err) => {
    readyPromise = null;
    killWorkerProcess();
    throw err;
  });
  return readyPromise;
}

function sendRaw(payload: object, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!worker || !worker.stdin.writable || !workerReady) {
      reject(new Error('Spooler worker not running'));
      return;
    }
    if (pending) {
      reject(new Error('Spooler worker busy'));
      return;
    }

    const timer = setTimeout(() => {
      if (pending) {
        pending = null;
        reject(new Error('Spooler worker response timeout'));
      }
    }, timeoutMs);

    pending = { resolve, reject, timer };
    try {
      worker.stdin.write(`${JSON.stringify(payload)}\n`, 'utf8');
    } catch (err: any) {
      clearTimeout(timer);
      pending = null;
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function request(payload: object, timeoutMs: number): Promise<string> {
  return enqueue(async () => {
    await ensureWorkerReady();
    try {
      return await sendRaw(payload, timeoutMs);
    } catch (err) {
      console.warn('[spooler-worker] request failed, restarting…', err);
      killWorkerProcess();
      readyPromise = null;
      await ensureWorkerReady();
      return sendRaw(payload, timeoutMs);
    }
  });
}

/** Start worker + load System.Drawing (call at app startup). */
export function warmupWindowsSpoolerWorker(): void {
  if (process.platform !== 'win32') return;
  shuttingDown = false;
  void ensureWorkerReady()
    .then(async () => {
      await listPrintersViaWorker(true);
    })
    .catch((e) => {
      console.error('[spooler-worker] warmup failed', e);
    });
}

export function stopWindowsSpoolerWorker(): void {
  rejectPending(new Error('Spooler worker stopped'));
  killWorkerProcess();
  readyPromise = null;
  stdoutBuffer = '';
}

export function shutdownWindowsSpoolerWorker(): void {
  shuttingDown = true;
  stopWindowsSpoolerWorker();
}

export async function listPrintersViaWorker(
  forceRefresh = false,
): Promise<WindowsPrinterInfo[]> {
  if (process.platform !== 'win32') return [];

  if (!forceRefresh) {
    const cached = getCachedWindowsPrinterList();
    if (cached) return cached;
  }

  const line = await request({ op: 'list' }, 20000);
  if (!line.startsWith('OK:')) {
    const err = line.startsWith('ERR:') ? line.slice(4) : line;
    throw new Error(err || 'Failed to list printers');
  }

  const json = line.slice(3).trim() || '[]';
  const parsed = JSON.parse(json) as WindowsPrinterInfo | WindowsPrinterInfo[];
  const list = (Array.isArray(parsed) ? parsed : [parsed])
    .filter((p) => p && typeof p.name === 'string' && p.name.trim() !== '')
    .map((p) => ({
      name: p.name,
      isDefault: Boolean(p.isDefault),
      status: p.status,
    }));

  setCachedWindowsPrinterList(list);
  return list;
}

export async function printPngViaWorker(
  pngBuffer: Buffer,
  printerName: string,
): Promise<{ success: boolean; error?: string }> {
  if (process.platform !== 'win32') {
    return { success: false, error: 'Windows Spooler printing is only available on Windows' };
  }

  const requested = (printerName || '').trim();
  if (!requested) {
    return { success: false, error: 'Windows printer name is required' };
  }
  if (!pngBuffer || pngBuffer.length < 100) {
    return { success: false, error: `Invalid PNG buffer: ${pngBuffer?.length || 0} bytes` };
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sufra-print-'));
  const imagePath = path.join(tmpDir, 'receipt.png');

  try {
    fs.writeFileSync(imagePath, pngBuffer);

    let list = getCachedWindowsPrinterList();
    if (!list) {
      try {
        list = await listPrintersViaWorker(false);
      } catch {
        list = null;
      }
    }
    const resolved = resolveWindowsPrinterName(requested, list);

    const line = await request(
      { op: 'print', printer: resolved, imagePath },
      60000,
    );

    if (line === 'OK' || line.startsWith('OK')) {
      console.log(
        `[spooler-worker] ✓ Printed PNG (${pngBuffer.length} bytes) to "${resolved}"`,
      );
      return { success: true };
    }

    const err = line.startsWith('ERR:') ? line.slice(4) : line;
    return { success: false, error: err || 'Windows Spooler print failed' };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Windows Spooler print failed',
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}
