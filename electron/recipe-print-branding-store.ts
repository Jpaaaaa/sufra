import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import type { RecipePrintData } from './print/render-recipe-types';
import type { ReceiptPrintData } from './print/receipt-utils';

export type RecipePrintBranding = {
  restaurantName: string;
  thankYouLine: string;
  mobileNumber: string;
  /** Absolute path to B/W PNG logo for thermal receipts (optional). */
  logoPath: string;
};

const DEFAULT: RecipePrintBranding = {
  restaurantName: '',
  thankYouLine: '',
  mobileNumber: '',
  logoPath: '',
};

function brandingFilePath(): string {
  return path.join(app.getPath('userData'), 'recipe-print-branding.json');
}

function brandingDir(): string {
  return path.join(app.getPath('userData'), 'print-branding');
}

export function logoBwFilePath(): string {
  return path.join(brandingDir(), 'logo-bw.png');
}

function firstNonEmpty(a: string | undefined, b: string | undefined): string | undefined {
  const x = (a ?? '').trim();
  if (x) return x;
  const y = (b ?? '').trim();
  return y || undefined;
}

export async function readRecipePrintBranding(): Promise<RecipePrintBranding> {
  try {
    const raw = await fs.readFile(brandingFilePath(), 'utf-8');
    const j = JSON.parse(raw) as Partial<RecipePrintBranding>;
    const logoPath = typeof j.logoPath === 'string' ? j.logoPath : '';
    const resolvedLogo =
      logoPath && fsSync.existsSync(logoPath)
        ? logoPath
        : fsSync.existsSync(logoBwFilePath())
          ? logoBwFilePath()
          : '';
    return {
      restaurantName: typeof j.restaurantName === 'string' ? j.restaurantName : '',
      thankYouLine: typeof j.thankYouLine === 'string' ? j.thankYouLine : '',
      mobileNumber: typeof j.mobileNumber === 'string' ? j.mobileNumber : '',
      logoPath: resolvedLogo,
    };
  } catch {
    const fallbackLogo = fsSync.existsSync(logoBwFilePath()) ? logoBwFilePath() : '';
    return { ...DEFAULT, logoPath: fallbackLogo };
  }
}

export async function writeRecipePrintBranding(
  partial: Partial<RecipePrintBranding>,
): Promise<RecipePrintBranding> {
  const current = await readRecipePrintBranding();
  const next: RecipePrintBranding = {
    restaurantName: partial.restaurantName !== undefined ? partial.restaurantName : current.restaurantName,
    thankYouLine: partial.thankYouLine !== undefined ? partial.thankYouLine : current.thankYouLine,
    mobileNumber: partial.mobileNumber !== undefined ? partial.mobileNumber : current.mobileNumber,
    logoPath: partial.logoPath !== undefined ? partial.logoPath : current.logoPath,
  };
  const dir = path.dirname(brandingFilePath());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(brandingFilePath(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

/** Convert any image file to a thermal-safe black/white PNG and save under userData. */
export async function saveRestaurantLogoFromFile(sourcePath: string): Promise<RecipePrintBranding> {
  // @ts-ignore
  const { loadImage, createCanvas } = await import('canvas');
  const img = await loadImage(sourcePath);
  const maxSide = 512;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a < 128) {
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = 255;
      continue;
    }
    const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    const v = gray < 160 ? 0 : 255;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  await fs.mkdir(brandingDir(), { recursive: true });
  const outPath = logoBwFilePath();
  const buf = canvas.toBuffer('image/png');
  await fs.writeFile(outPath, buf);
  return writeRecipePrintBranding({ logoPath: outPath });
}

export async function removeRestaurantLogo(): Promise<RecipePrintBranding> {
  try {
    await fs.unlink(logoBwFilePath());
  } catch {
    /* ignore missing */
  }
  return writeRecipePrintBranding({ logoPath: '' });
}

export async function getRestaurantLogoPreviewBase64(): Promise<string | null> {
  const b = await readRecipePrintBranding();
  if (!b.logoPath || !fsSync.existsSync(b.logoPath)) return null;
  const buf = await fs.readFile(b.logoPath);
  return buf.toString('base64');
}

/** Fills missing header/footer fields from saved branding (saved in Electron userData). */
export async function mergeRecipePrintBranding(data: RecipePrintData): Promise<RecipePrintData> {
  const b = await readRecipePrintBranding();
  return {
    ...data,
    restaurantName: firstNonEmpty(data.restaurantName, b.restaurantName),
    thankYouLine: firstNonEmpty(data.thankYouLine, b.thankYouLine),
    mobileNumber: firstNonEmpty(data.mobileNumber, b.mobileNumber),
  };
}

/**
 * Apply restaurant branding to customer receipts.
 * Saved branding wins when set (frontend often sends the app default name).
 */
export async function mergeCustomerReceiptBranding(data: ReceiptPrintData): Promise<ReceiptPrintData> {
  const b = await readRecipePrintBranding();
  const hasCustomLogo = Boolean(b.logoPath && fsSync.existsSync(b.logoPath));
  return {
    ...data,
    restaurantName: firstNonEmpty(b.restaurantName, data.restaurantName) || data.restaurantName,
    thankYouMessage: firstNonEmpty(b.thankYouLine, data.thankYouMessage ?? undefined) ?? data.thankYouMessage,
    phone: firstNonEmpty(b.mobileNumber, data.phone ?? undefined) ?? data.phone,
    logoUrl: hasCustomLogo ? b.logoPath : data.logoUrl,
    skipDefaultLogo: true,
  };
}
