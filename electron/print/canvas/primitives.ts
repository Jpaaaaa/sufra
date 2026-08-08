import * as fs from 'fs';
import * as path from 'path';
import { PRINT_TOKENS, canvasWidthFor, type PaperWidthMm } from '../tokens';
import { printFont } from './fonts';
import { drawWrappedText, wrapText, type TextAlign } from './text';

export interface CanvasCtx {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  direction: string;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  strokeRect: (x: number, y: number, w: number, h: number) => void;
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  stroke: () => void;
  fillText: (t: string, x: number, y: number) => void;
  measureText: (s: string) => { width: number };
  drawImage: (...args: any[]) => void;
  save: () => void;
  restore: () => void;
}

export class ReceiptPainter {
  readonly width: number;
  readonly pad: number;
  y = 0;
  private maxY = 0;

  constructor(
    readonly ctx: CanvasCtx,
    readonly paper: PaperWidthMm = 80,
  ) {
    this.width = canvasWidthFor(paper);
    this.pad = PRINT_TOKENS.pad;
    this.y = this.pad;
  }

  get contentW(): number {
    return this.width - this.pad * 2;
  }

  get right(): number {
    return this.width - this.pad;
  }

  get left(): number {
    return this.pad;
  }

  get centerX(): number {
    return this.width / 2;
  }

  track(y: number) {
    this.maxY = Math.max(this.maxY, y);
  }

  advance(dy: number) {
    this.y += dy;
    this.track(this.y);
  }

  /** Final canvas height including bottom buffer. */
  measuredHeight(minHeight = 300): number {
    return Math.max(minHeight, this.maxY + PRINT_TOKENS.bottomBuffer);
  }

  hLine(width: number = PRINT_TOKENS.line.thick, y = this.y) {
    const ctx = this.ctx;
    ctx.strokeStyle = PRINT_TOKENS.ink;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(this.pad, y);
    ctx.lineTo(this.width - this.pad, y);
    ctx.stroke();
  }

  doubleHLine(y = this.y) {
    this.hLine(PRINT_TOKENS.line.thick, y);
    this.hLine(PRINT_TOKENS.line.hair, y + 4);
  }

  box(x: number, y: number, w: number, h: number, lineWidth: number = PRINT_TOKENS.line.thick) {
    const ctx = this.ctx;
    ctx.strokeStyle = PRINT_TOKENS.ink;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x, y, w, h);
  }

  fillBox(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    ctx.fillStyle = PRINT_TOKENS.ink;
    ctx.fillRect(x, y, w, h);
  }

  text(
    value: string,
    x: number,
    y: number,
    fontSize: number,
    align: TextAlign = 'right',
    bold = false,
    maxWidth = this.contentW,
    lineHeight = fontSize + 6,
  ): number {
    return drawWrappedText(this.ctx, value, {
      x,
      y,
      fontSize,
      align,
      bold,
      maxWidth,
      lineHeight,
      fillStyle: PRINT_TOKENS.ink,
    });
  }

  /**
   * Inverted badge (black fill, white text) — use sparingly for priority/order #.
   */
  badge(
    label: string,
    x: number,
    y: number,
    fontSize: number,
    align: TextAlign = 'center',
    padX = 12,
    padY = 6,
  ): { width: number; height: number } {
    const ctx = this.ctx;
    ctx.font = printFont(fontSize, true);
    const tw = ctx.measureText(label).width;
    const w = tw + padX * 2;
    const h = fontSize + padY * 2;
    let bx = x;
    if (align === 'center') bx = x - w / 2;
    else if (align === 'right') bx = x - w;

    this.fillBox(bx, y, w, h);
    ctx.fillStyle = PRINT_TOKENS.paper;
    ctx.font = printFont(fontSize, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'ltr';
    ctx.fillText(label, bx + w / 2, y + h / 2);
    ctx.fillStyle = PRINT_TOKENS.ink;
    ctx.textBaseline = 'top';
    return { width: w, height: h };
  }

  /**
   * Outlined badge (order type etc.)
   */
  outlineBadge(
    label: string,
    x: number,
    y: number,
    fontSize: number,
    align: TextAlign = 'center',
    padX = 10,
    padY = 5,
  ): { width: number; height: number } {
    const ctx = this.ctx;
    ctx.font = printFont(fontSize, true);
    const tw = ctx.measureText(label).width;
    const w = Math.min(this.contentW, tw + padX * 2);
    const h = fontSize + padY * 2;
    let bx = x;
    if (align === 'center') bx = x - w / 2;
    else if (align === 'right') bx = x - w;

    this.box(bx, y, w, h, PRINT_TOKENS.line.thick);
    this.text(label, bx + w / 2, y + padY, fontSize, 'center', true, w - 4, fontSize + 4);
    return { width: w, height: h };
  }

  vLine(x: number, y1: number, y2: number, width: number = PRINT_TOKENS.line.hair) {
    const ctx = this.ctx;
    ctx.strokeStyle = PRINT_TOKENS.ink;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();
  }

  /**
   * Borderless meta rows: label (sm) + value (bold) per cell — clearer on thermal paper.
   * Returns height consumed.
   */
  infoGrid(
    fields: Array<{ label: string; value?: string | number | null }>,
    startY: number,
    cols = 2,
    fontSize: number = PRINT_TOKENS.font.sm,
  ): number {
    const visible = fields.filter((f) => {
      const v = f.value;
      return v !== undefined && v !== null && String(v).trim() !== '';
    });
    if (visible.length === 0) return 0;

    const gap = 12;
    const cellW = (this.contentW - gap * (cols - 1)) / cols;
    const labelSize = Math.max(PRINT_TOKENS.font.xs, fontSize - 4);
    const valueSize = fontSize;
    const labelLh = labelSize + 4;
    const valueLh = valueSize + 6;
    const cellPad = 4;
    const rowGap = 10;

    const rows: typeof visible[] = [];
    for (let i = 0; i < visible.length; i += cols) {
      rows.push(visible.slice(i, i + cols));
    }

    let y = startY;
    for (const row of rows) {
      let rowH = labelLh + valueLh;
      const measured = row.map((f) => {
        const value = String(f.value);
        this.ctx.font = printFont(valueSize, true);
        const wrapped = wrapText(this.ctx, value, cellW - cellPad * 2);
        rowH = Math.max(rowH, labelLh + wrapped.length * valueLh);
        return { label: f.label, value, wrapped };
      });

      measured.forEach((m, idx) => {
        const xRight = this.right - idx * (cellW + gap);
        this.text(m.label, xRight - cellPad, y, labelSize, 'right', false, cellW - cellPad * 2, labelLh);
        this.text(
          m.value,
          xRight - cellPad,
          y + labelLh,
          valueSize,
          'right',
          true,
          cellW - cellPad * 2,
          valueLh,
        );
      });

      y += rowH + rowGap;
    }

    return y - startY;
  }

  /**
   * Draw a full items table frame: outer border + vertical column dividers + row rules.
   * `dividers` are X positions of internal vertical lines (between columns).
   * `rowYs` are Y positions of horizontal rules inside the body (after header rule).
   */
  tableFrame(
    x: number,
    y: number,
    w: number,
    h: number,
    headerH: number,
    dividers: number[],
    rowYs: number[],
    lineWidth: number = PRINT_TOKENS.line.thick,
  ) {
    this.box(x, y, w, h, lineWidth);
    // Header separator
    this.hLine(lineWidth, y + headerH);
    for (const dx of dividers) {
      this.vLine(dx, y, y + h, PRINT_TOKENS.line.hair);
    }
    for (const ry of rowYs) {
      this.hLine(PRINT_TOKENS.line.hair, ry);
    }
  }

  /**
   * Order-note block: inverted title bar + padded body (no overlap with border).
   * Returns total height consumed.
   */
  orderNoteBlock(
    title: string,
    text: string,
    startY: number,
    fontSize: number = PRINT_TOKENS.font.sm,
  ): number {
    const padX = 10;
    const padY = 10;
    const titleSize = PRINT_TOKENS.font.sm;
    const titleH = titleSize + 14;
    const lh = fontSize + 6;
    this.ctx.font = printFont(fontSize, true);
    const lines = wrapText(this.ctx, text, this.contentW - padX * 2);
    const bodyH = Math.max(lh + padY * 2, lines.length * lh + padY * 2);
    const totalH = titleH + bodyH;

    this.box(this.pad, startY, this.contentW, totalH, PRINT_TOKENS.line.thick);
    this.fillBox(this.pad, startY, this.contentW, titleH);
    const ctx = this.ctx;
    ctx.fillStyle = PRINT_TOKENS.paper;
    ctx.font = printFont(titleSize, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, this.centerX, startY + titleH / 2);
    ctx.fillStyle = PRINT_TOKENS.ink;
    ctx.textBaseline = 'top';

    this.text(text, this.right - padX, startY + titleH + padY, fontSize, 'right', true, this.contentW - padX * 2, lh);
    return totalH;
  }

  /**
   * Try to load and draw a logo centered as 1-bit black/white (thermal-safe).
   * Returns height used (0 if missing).
   */
  async drawLogo(
    logoUrl: string | undefined | null,
    maxH = 64,
    options?: { allowFallback?: boolean },
  ): Promise<number> {
    const allowFallback = options?.allowFallback !== false;
    const candidates: string[] = [];
    if (logoUrl && fs.existsSync(logoUrl)) candidates.push(logoUrl);

    if (allowFallback) {
      candidates.push(
        path.join(__dirname, '../../build/sufralogo.png'),
        path.join(__dirname, '../../dist/logo.png'),
        path.join(__dirname, '../../../frontend/dist/logo/logo.png'),
        path.join(process.cwd(), 'build/sufralogo.png'),
        path.join(process.cwd(), 'dist/logo.png'),
      );
    }

    let file: string | null = null;
    for (const c of candidates) {
      try {
        if (fs.existsSync(c)) {
          file = c;
          break;
        }
      } catch {
        /* skip */
      }
    }
    if (!file) return 0;

    try {
      // @ts-ignore
      const { loadImage, createCanvas } = await import('canvas');
      const img = await loadImage(file);
      const scale = Math.min(maxH / img.height, (this.contentW * 0.45) / img.width, 1);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      // Rasterize to B/W so thermal printers don't dither color logos
      const tmp = createCanvas(w, h);
      const tctx = tmp.getContext('2d');
      tctx.drawImage(img, 0, 0, w, h);
      const imageData = tctx.getImageData(0, 0, w, h);
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
      tctx.putImageData(imageData, 0, 0);

      const x = (this.width - w) / 2;
      this.ctx.drawImage(tmp, x, this.y, w, h);
      return h;
    } catch (e) {
      console.warn('[PRINT] Logo load failed:', e);
      return 0;
    }
  }
}

/**
 * Create white canvas of given size.
 */
export async function createPrintCanvas(width: number, height: number) {
  // @ts-ignore
  const { createCanvas } = await import('canvas');
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as CanvasCtx;
  ctx.fillStyle = PRINT_TOKENS.paper;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = PRINT_TOKENS.ink;
  ctx.textBaseline = 'top';
  return { canvas, ctx };
}

export async function generateMinimalFallbackPng(label: string): Promise<Buffer> {
  const { canvas, ctx } = await createPrintCanvas(576, 200);
  ctx.fillStyle = PRINT_TOKENS.ink;
  ctx.font = printFont(24, true);
  ctx.textAlign = 'center';
  ctx.fillText('TEST OK', 288, 70);
  ctx.font = printFont(16, false);
  ctx.fillText(label, 288, 120);
  return (canvas as any).toBuffer('image/png');
}
