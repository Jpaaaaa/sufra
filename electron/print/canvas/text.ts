import { printFont } from './fonts';

export type TextAlign = 'left' | 'center' | 'right';

const ARABIC_RE = /[\u0600-\u06FF]/;

export function hasArabic(text: string): boolean {
  return ARABIC_RE.test(text);
}

/**
 * Split into wrap units. Prefer spaces; fall back to grapheme-ish chars
 * so long Arabic strings never overflow a cell.
 */
function unitsForWrap(text: string): string[] {
  const trimmed = String(text ?? '');
  if (!trimmed) return [''];
  if (/\s/.test(trimmed)) {
    return trimmed.split(/\s+/).filter(Boolean);
  }
  // No spaces — wrap by character clusters (safe for Arabic letters)
  return Array.from(trimmed);
}

/**
 * Wrap text to fit maxWidth. Never returns a line wider than maxWidth
 * when a single unit exceeds width (character-splits that unit).
 */
export function wrapText(
  ctx: { measureText: (s: string) => { width: number }; font: string },
  text: string,
  maxWidth: number,
): string[] {
  const safeMax = Math.max(8, maxWidth);
  const units = unitsForWrap(text);
  const lines: string[] = [];
  let current = '';
  const joiner = /\s/.test(String(text ?? '')) ? ' ' : '';

  const pushOverflowUnit = (unit: string) => {
    let chunk = '';
    for (const ch of Array.from(unit)) {
      const test = chunk + ch;
      if (ctx.measureText(test).width > safeMax && chunk) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk = test;
      }
    }
    if (chunk) current = chunk;
  };

  for (const unit of units) {
    const test = current ? `${current}${joiner}${unit}` : unit;
    if (ctx.measureText(test).width <= safeMax) {
      current = test;
      continue;
    }
    if (current) {
      lines.push(current);
      current = '';
    }
    if (ctx.measureText(unit).width > safeMax) {
      pushOverflowUnit(unit);
    } else {
      current = unit;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

export function measureWrappedHeight(
  ctx: { measureText: (s: string) => { width: number }; font: string },
  text: string,
  maxWidth: number,
  lineHeight: number,
  fontSize: number,
  bold = false,
): number {
  ctx.font = printFont(fontSize, bold);
  const lines = wrapText(ctx, text, maxWidth);
  return Math.max(1, lines.length) * lineHeight;
}

export interface DrawTextOpts {
  x: number;
  y: number;
  fontSize: number;
  align?: TextAlign;
  bold?: boolean;
  maxWidth: number;
  lineHeight: number;
  fillStyle?: string;
}

/**
 * Draw wrapped text. Returns number of lines drawn.
 */
export function drawWrappedText(
  ctx: any,
  text: string,
  opts: DrawTextOpts,
): number {
  const {
    x,
    y,
    fontSize,
    align = 'left',
    bold = false,
    maxWidth,
    lineHeight,
    fillStyle = '#000000',
  } = opts;

  ctx.font = printFont(fontSize, bold);
  ctx.fillStyle = fillStyle;
  ctx.textBaseline = 'top';
  ctx.textAlign = align;
  ctx.direction = hasArabic(text) && align !== 'center' ? 'rtl' : 'ltr';

  const lines = wrapText(ctx, String(text ?? ''), maxWidth);
  lines.forEach((line, idx) => {
    ctx.fillText(line, x, y + idx * lineHeight);
  });
  return lines.length;
}

/** Draw one line only — never wraps (for money / qty cells). */
export function drawSingleLineText(
  ctx: any,
  text: string,
  opts: Omit<DrawTextOpts, 'maxWidth' | 'lineHeight'> & { maxWidth?: number },
): void {
  const { x, y, fontSize, align = 'left', bold = false, fillStyle = '#000000', maxWidth } = opts;
  ctx.font = printFont(fontSize, bold);
  ctx.fillStyle = fillStyle;
  ctx.textBaseline = 'top';
  ctx.textAlign = align;
  ctx.direction = 'ltr';

  let value = String(text ?? '');
  if (maxWidth != null && maxWidth > 0) {
    while (value.length > 1 && ctx.measureText(value).width > maxWidth) {
      // Prefer dropping currency suffix, then trim digits from the left rarely needed
      if (value.endsWith(' د.ع')) {
        value = value.slice(0, -4);
        continue;
      }
      value = value.slice(0, -1);
    }
  }
  ctx.fillText(value, x, y);
}

export function formatAmountIqd(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  return n.toLocaleString('en-US');
}

export function formatCurrencyIqd(amount: number): string {
  return `${formatAmountIqd(amount)} د.ع`;
}

/**
 * Prefer "12,000 د.ع" when it fits in one line; otherwise amount only.
 * Prevents currency wrapping into the next receipt row.
 */
export function formatMoneyCell(
  ctx: { measureText: (s: string) => { width: number }; font: string },
  amount: number,
  maxWidth: number,
): string {
  const full = formatCurrencyIqd(amount);
  if (ctx.measureText(full).width <= Math.max(8, maxWidth)) return full;
  return formatAmountIqd(amount);
}

export function formatTimeAr(iso: string | undefined | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('ar-IQ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDateAr(iso: string | undefined | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ar-IQ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function serviceTypeLabel(
  serviceType: string | null | undefined,
  bilingual = false,
): string {
  switch (serviceType) {
    case 'pickup':
      return bilingual ? 'سفري / TAKEAWAY' : 'سفري';
    case 'delivery':
      return bilingual ? 'توصيل / DELIVERY' : 'توصيل';
    default:
      return bilingual ? 'طاولة / DINE-IN' : 'طاولة';
  }
}
