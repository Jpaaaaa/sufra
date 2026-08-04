import type { OrderPrintData, PrintItemOption } from './receipt-utils';
import { PRINT_TOKENS, canvasWidthFor, kitchenColumnLayout, type PaperWidthMm } from './tokens';
import { registerArabicFontIfAvailable, printFont } from './canvas/fonts';
import { formatTimeAr, serviceTypeLabel, wrapText } from './canvas/text';
import {
  ReceiptPainter,
  createPrintCanvas,
  generateMinimalFallbackPng,
} from './canvas/primitives';

function parseOptions(raw: unknown): PrintItemOption[] {
  if (Array.isArray(raw)) return raw as PrintItemOption[];
  if (typeof raw === 'string' && raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* ignore */
    }
  }
  return [];
}

function modifierLines(item: OrderPrintData['items'][number]): string[] {
  const fromField = item.modifiers?.filter(Boolean) ?? [];
  if (fromField.length) return fromField;
  return parseOptions(item.options_json)
    .map((opt) => {
      const name = opt.option_name ?? '';
      if (!name) return '';
      return opt.group_name ? `${opt.group_name}: ${name}` : name;
    })
    .filter(Boolean);
}

function serviceTypeArabic(serviceType: string): string {
  switch (serviceType) {
    case 'pickup':
      return 'سفري';
    case 'delivery':
      return 'توصيل';
    default:
      return 'طاولة';
  }
}

/**
 * Kitchen ticket — no logo, dense, high-contrast, thermal-optimized.
 */
export async function renderOrderToPng(data: OrderPrintData | null | undefined): Promise<Buffer> {
  console.log('[KITCHEN] Starting PNG generation...');

  if (!data) {
    data = {
      orderId: 999,
      table: 0,
      hall: 'TEST',
      items: [{ id: 1, item_name: 'TEST OK', quantity: 1, price: 0 }],
      totals: { total: 0 },
      timestamp: new Date().toISOString(),
      restaurantName: 'SUFRA POS - TEST',
      kitchenName: 'KITCHEN',
    };
  }
  if (!data.items || !Array.isArray(data.items)) data.items = [];

  try {
    await registerArabicFontIfAvailable();

    const paper: PaperWidthMm = data.paperWidth === 58 ? 58 : 80;
    const width = canvasWidthFor(paper);
    const T = PRINT_TOKENS;
    const k = T.kitchen;
    const items = data.items;
    const serviceType = data.service_type || items[0]?.service_type || 'dine-in';
    const printTime = data.printTime || new Date().toISOString();
    const cols = kitchenColumnLayout(paper);
    const infoFields = buildInfoFields(data, serviceType);

    // —— Measure ——
    const { ctx: tempCtx } = await createPrintCanvas(width, 80);
    const measure = new ReceiptPainter(tempCtx, paper);
    let est = measure.pad;

    est += k.fontXl + 8; // kitchen name
    est += T.font.sm + 6; // subtitle
    est += 10;
    est += k.fontXl + 24; // order band
    est += k.fontMd + 16; // service type
    if (data.priority) est += 36;
    est += T.font.sm + 12; // print time
    est += Math.ceil(Math.max(1, infoFields.length) / 2) * 34 + 16;

    const nameInnerW = cols.name.w - 16;
    const cellPadY = 10;
    const headerH = T.font.sm + 16;

    const rowHeights = items.map((item) => {
      tempCtx.font = printFont(k.fontMd, true);
      let h = wrapText(tempCtx, item.item_name || 'صنف', nameInnerW).length * (k.fontMd + 6);
      for (const mod of modifierLines(item)) {
        tempCtx.font = printFont(T.font.sm, false);
        h += wrapText(tempCtx, `• ${mod}`, nameInnerW - 6).length * (T.font.sm + 4) + 2;
      }
      if (item.note) {
        tempCtx.font = printFont(T.font.sm, true);
        h += wrapText(tempCtx, `※ ${item.note}`, nameInnerW - 6).length * (T.font.sm + 4) + 8;
      }
      return Math.max(k.lineHeight + 4, h) + cellPadY * 2;
    });

    est += headerH + (rowHeights.length ? rowHeights.reduce((a, b) => a + b, 0) : 40) + 16;
    if (data.note) {
      tempCtx.font = printFont(T.font.sm, false);
      est += wrapText(tempCtx, data.note, measure.contentW - 20).length * (T.font.sm + 6) + 28;
    }
    est += 50 + T.bottomBuffer;
    const height = Math.max(360, est);

    // —— Draw ——
    const { canvas, ctx } = await createPrintCanvas(width, height);
    const p = new ReceiptPainter(ctx, paper);

    // Header: kitchen name first (no logo)
    const kitchenTitle = data.kitchenName || 'المطبخ';
    let lines = p.text(kitchenTitle, p.centerX, p.y, k.fontXl, 'center', true, p.contentW, k.fontXl + 2);
    p.advance(lines * (k.fontXl + 2) + 2);

    lines = p.text('تذكرة مطبخ', p.centerX, p.y, T.font.sm, 'center', false, p.contentW, T.font.sm + 2);
    p.advance(lines * (T.font.sm + 2) + 8);

    p.doubleHLine(p.y);
    p.advance(12);

    // Order band — full-width inverted bar
    const orderLabel = `#${data.orderId ?? '—'}`;
    const bandH = k.fontXl + 20;
    p.fillBox(p.pad, p.y, p.contentW, bandH);
    ctx.fillStyle = T.paper;
    ctx.font = printFont(k.fontXl, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(orderLabel, p.centerX, p.y + bandH / 2);
    ctx.fillStyle = T.ink;
    ctx.textBaseline = 'top';
    p.advance(bandH + 8);

    // Service type — clean outline strip
    const typeLabel = serviceTypeLabel(serviceType, true);
    const typeH = k.fontMd + 14;
    p.box(p.pad, p.y, p.contentW, typeH, T.line.thick);
    p.text(typeLabel, p.centerX, p.y + 7, k.fontMd, 'center', true, p.contentW - 8, k.fontMd + 2);
    p.advance(typeH + 6);

    if (data.priority) {
      const pr = p.badge('★ مستعجل ★', p.centerX, p.y, T.font.md, 'center', 16, 6);
      p.advance(pr.height + 6);
    }

    // Print time under service
    const timeStr = formatTimeAr(printTime);
    if (timeStr) {
      lines = p.text(`طباعة: ${timeStr}`, p.centerX, p.y, T.font.xs, 'center', false, p.contentW, T.font.xs + 2);
      p.advance(lines * (T.font.xs + 2) + 8);
    }

    // Meta — compact borderless pairs
    if (infoFields.length) {
      p.hLine(T.line.hair);
      p.advance(8);
      const gridH = p.infoGrid(infoFields, p.y, 2, T.font.sm);
      p.advance(gridH + 6);
    }

    // Items table
    p.hLine(T.line.thick);
    p.advance(0);

    const tableX = cols.tableLeft;
    const tableW = cols.tableRight - cols.tableLeft;
    const bodyH = items.length === 0 ? 40 : rowHeights.reduce((a, b) => a + b, 0);
    const tableH = headerH + bodyH;
    const tableTop = p.y;

    // Filled header bar for table
    p.fillBox(tableX, tableTop, tableW, headerH);
    ctx.fillStyle = T.paper;
    ctx.font = printFont(T.font.sm, true);
    ctx.textBaseline = 'middle';
    const headerMid = tableTop + headerH / 2;
    ctx.textAlign = 'right';
    ctx.fillText('الكمية', cols.qty.x, headerMid);
    ctx.fillText('الصنف', cols.name.x, headerMid);
    ctx.fillStyle = T.ink;
    ctx.textBaseline = 'top';

    const rowYs: number[] = [];
    let rowY = tableTop + headerH;

    if (items.length === 0) {
      p.text('لا توجد أصناف', p.centerX, rowY + 12, T.font.md, 'center', false);
    } else {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const qty = item.quantity || 1;
        const name = item.item_name || 'صنف';
        const textY = rowY + cellPadY;
        let cursorY = textY;

        // Qty emphasized
        p.text(`${qty}×`, cols.qty.x, textY, k.fontXl, 'right', true, cols.qty.w - 8, k.fontXl + 2);

        const nameLines = p.text(name, cols.name.x, cursorY, k.fontMd, 'right', true, nameInnerW, k.fontMd + 6);
        cursorY += nameLines * (k.fontMd + 6) + 2;

        for (const mod of modifierLines(item)) {
          const ml = p.text(`• ${mod}`, cols.name.x, cursorY, T.font.sm, 'right', false, nameInnerW - 6, T.font.sm + 4);
          cursorY += ml * (T.font.sm + 4) + 2;
        }

        if (item.note) {
          // Bold note line — no nested box clutter
          const noteText = `※ ${item.note}`;
          const nl = p.text(noteText, cols.name.x, cursorY + 2, T.font.sm, 'right', true, nameInnerW - 6, T.font.sm + 4);
          cursorY += nl * (T.font.sm + 4) + 4;
        }

        rowY += rowHeights[i];
        if (i < items.length - 1) rowYs.push(rowY);
      }
    }

    p.tableFrame(tableX, tableTop, tableW, tableH, headerH, cols.dividers, rowYs, T.line.thick);
    p.y = tableTop + tableH;
    p.advance(10);

    // Order note
    if (data.note) {
      const noteH = (() => {
        ctx.font = printFont(T.font.sm, true);
        const nLines = wrapText(ctx, data.note!, p.contentW - 20);
        return nLines.length * (T.font.sm + 6) + 16;
      })();
      p.box(p.pad, p.y, p.contentW, noteH, T.line.thick);
      p.text('ملاحظة الطلب', p.right - 8, p.y + 6, T.font.xs, 'right', true, p.contentW - 16, T.font.xs + 2);
      p.text(data.note, p.right - 8, p.y + 6 + T.font.xs + 4, T.font.sm, 'right', true, p.contentW - 16, T.font.sm + 4);
      p.advance(noteH + 10);
    }

    // Footer
    p.doubleHLine(p.y);
    p.advance(10);

    const totalQty = items.reduce((s, it) => s + (it.quantity || 0), 0);
    const typeShort = serviceTypeArabic(serviceType);
    const footer = `إجمالي الأصناف: ${totalQty}  ·  ${typeShort}`;
    p.text(footer, p.centerX, p.y, T.font.md, 'center', true, p.contentW, T.font.md + 4);
    p.advance(T.font.md + 8);

    if (data.reprintCount != null && data.reprintCount > 0) {
      p.text(`إعادة طباعة #${data.reprintCount}`, p.centerX, p.y, T.font.sm, 'center', false);
      p.advance(T.font.sm + 4);
    }

    p.track(p.y);

    const pngBuffer = (canvas as any).toBuffer('image/png');
    console.log(`[KITCHEN] ✓ PNG generated: ${pngBuffer.length} bytes (${(pngBuffer.length / 1024).toFixed(2)} KB)`);
    if (pngBuffer.length < 1000) {
      throw new Error(`PNG generation failed: output too small (${pngBuffer.length} bytes)`);
    }
    return pngBuffer;
  } catch (error: any) {
    console.error('[KITCHEN] ✕ Error generating PNG:', error);
    return await generateMinimalFallbackPng('Kitchen receipt working');
  }
}

function buildInfoFields(data: OrderPrintData, serviceType: string) {
  const fields: Array<{ label: string; value?: string | number | null }> = [];
  if (data.floor) fields.push({ label: 'الطابق', value: data.floor });
  if (data.hall) fields.push({ label: 'القاعة', value: data.hall });
  if (serviceType === 'dine-in' && data.table) {
    fields.push({ label: 'الطاولة', value: data.table });
  }
  if (data.seat) fields.push({ label: 'المقعد', value: data.seat });
  if (data.waiter) fields.push({ label: 'النادل', value: data.waiter });
  if (data.cashier) fields.push({ label: 'الكاشير', value: data.cashier });
  // guests intentionally omitted — not used in kitchen workflow
  if (data.timestamp) {
    fields.push({ label: 'وقت الطلب', value: formatTimeAr(data.timestamp) });
  }
  if (serviceType === 'delivery') {
    if (data.customer_name) fields.push({ label: 'العميل', value: data.customer_name });
    if (data.customer_phone) fields.push({ label: 'الهاتف', value: data.customer_phone });
  }
  return fields;
}
