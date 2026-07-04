import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import type { RecipePrintData } from './print/render-recipe-types';

export type RecipePrintBranding = {
  restaurantName: string;
  thankYouLine: string;
  mobileNumber: string;
};

const DEFAULT: RecipePrintBranding = {
  restaurantName: '',
  thankYouLine: '',
  mobileNumber: '',
};

function brandingFilePath(): string {
  return path.join(app.getPath('userData'), 'recipe-print-branding.json');
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
    return {
      restaurantName: typeof j.restaurantName === 'string' ? j.restaurantName : '',
      thankYouLine: typeof j.thankYouLine === 'string' ? j.thankYouLine : '',
      mobileNumber: typeof j.mobileNumber === 'string' ? j.mobileNumber : '',
    };
  } catch {
    return { ...DEFAULT };
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
  };
  const dir = path.dirname(brandingFilePath());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(brandingFilePath(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
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
