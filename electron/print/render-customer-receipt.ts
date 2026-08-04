import type { ReceiptPrintData } from './receipt-utils';
import {
  PRINT_TOKENS,
  canvasWidthFor,
  receiptColumnLayout,
  type PaperWidthMm,
} from './tokens';
import { registerArabicFontIfAvailable, printFont } from './canvas/fonts';
import {
  formatCurrencyIqd,
  formatDateAr,
  formatTimeAr,
  serviceTypeLabel,
  wrapText,
} from './canvas/text';
import {
  ReceiptPainter,
  createPrintCanvas,
  generateMinimalFallbackPng,
} from './canvas/primitives';

/**
 * Render customer receipt to PNG for thermal printers.
 */
export async function renderReceiptToPng(data: ReceiptPrintData | null | undefined): Promise<Buffer> {
  console.log('[RECEIPT] Starting PNG generation...');

  if (!data) {
    data = {
      orderId: 999,
      table: 0,
      hall: 'TEST',
      items: [{ order_id: 999, item_name: 'TEST OK', quantity: 1, price: 0 }],
      totals: { total: 0 },
      timestamp: new Date().toISOString(),
      restaurantName: 'SUFRA POS - TEST',
    };
  }
  if (!data.items || !Array.isArray(data.items)) data.items = [];

  try {
    await registerArabicFontIfAvailable();

    const paper: PaperWidthMm = data.paperWidth === 58 ? 58 : 80;
    const width = canvasWidthFor(paper);
    const T = PRINT_TOKENS;
    const r = T.receipt;
    const items = data.items;
    const serviceType = data.service_type || items[0]?.service_type || 'dine-in';
    const layout = receiptColumnLayout(paper);
    const compact = layout.mode === 'compact';

    // Pass 1 — measure
    const { ctx: tempCtx } = await createPrintCanvas(width, 100);
    const measure = new ReceiptPainter(tempCtx, paper);
    let y = measure.pad;

    y += 70; // logo
    y += T.font.xl + 8;
    if (data.address) y += T.font.sm * 2 + 4;
    if (data.phone) y += T.font.sm + 4;
    if (data.taxNumber) y += T.font.sm + 4;
    if (serviceType === 'pickup' || serviceType === 'delivery') y += T.font.lg + 8;
    y += T.sectionGap;

    const infoFields = buildReceiptInfoFields(data, serviceType);
    const visible = infoFields.filter((f) => f.value != null && String(f.value).trim() !== '');
    y += Math.ceil(Math.max(1, visible.length) / 2) * 56 + T.sectionGap;

    if (serviceType === 'delivery') {
      if (data.customer_name) y += r.lineHeight;
      if (data.customer_phone) y += r.lineHeight;
      if (data.customer_address) {
        tempCtx.font = printFont(T.font.sm, false);
        y += wrapText(tempCtx, String(data.customer_address), measure.contentW).length * r.lineHeightSm;
      }
      y += T.gap;
    }

    y += T.font.sm + 20; // table header

    for (const item of items) {
      const nameW = layout.cols.item.w;
      tempCtx.font = printFont(T.font.md, true);
      const nameLines = wrapText(tempCtx, item.item_name || 'صنف', nameW);
      y += Math.max(r.lineHeight, nameLines.length * r.lineHeight) + 10;
    }

    y += T.sectionGap;
    y += (r.lineHeight + 4) * 5; // summary rows
    y += T.font.xl + 20; // grand total
    y += (r.lineHeight + 4) * 4; // payment
    y += T.sectionGap + T.font.md + 40; // footer
    y += T.bottomBuffer;

    const height = Math.max(500, y);

    // Pass 2 — draw
    const { canvas, ctx } = await createPrintCanvas(width, height);
    const p = new ReceiptPainter(ctx, paper);

    // —— Header ——
    const logoH = await p.drawLogo(data.logoUrl, paper === 58 ? 48 : 64);
    if (logoH) p.advance(logoH + 6);
    else p.advance(4);

    let lines = p.text(
      data.restaurantName || 'سفرة',
      p.centerX,
      p.y,
      T.font.xl,
      'center',
      true,
      p.contentW,
      T.font.xl + 4,
    );
    p.advance(lines * (T.font.xl + 4) + 4);

    if (data.address) {
      lines = p.text(data.address, p.centerX, p.y, T.font.sm, 'center', false, p.contentW, T.font.sm + 4);
      p.advance(lines * (T.font.sm + 4) + 2);
    }
    if (data.phone) {
      lines = p.text(`هاتف: ${data.phone}`, p.centerX, p.y, T.font.sm, 'center', false, p.contentW, T.font.sm + 4);
      p.advance(lines * (T.font.sm + 4) + 2);
    }
    if (data.taxNumber) {
      lines = p.text(`الرقم الضريبي: ${data.taxNumber}`, p.centerX, p.y, T.font.xs, 'center', false, p.contentW, T.font.xs + 4);
      p.advance(lines * (T.font.xs + 4) + 2);
    }

    if (serviceType === 'pickup' || serviceType === 'delivery') {
      p.advance(4);
      const badge = p.outlineBadge(serviceTypeLabel(serviceType, true), p.centerX, p.y, T.font.md, 'center');
      p.advance(badge.height + 6);
    }

    p.hLine(T.line.thick);
    p.advance(T.sectionGap);

    // —— Info grid ——
    const gridH = p.infoGrid(infoFields, p.y, 2, T.font.sm);
    if (gridH) p.advance(gridH + T.gap);

    if (serviceType === 'delivery') {
      if (data.customer_name) {
        p.text(`العميل: ${data.customer_name}`, p.right, p.y, T.font.sm, 'right', true);
        p.advance(r.lineHeightSm);
      }
      if (data.customer_phone) {
        p.text(`الهاتف: ${data.customer_phone}`, p.right, p.y, T.font.sm, 'right', false);
        p.advance(r.lineHeightSm);
      }
      if (data.customer_address) {
        lines = p.text(`العنوان: ${data.customer_address}`, p.right, p.y, T.font.sm, 'right', false);
        p.advance(lines * r.lineHeightSm + 4);
      }
    }

    p.advance(T.gap);
    p.hLine(T.line.thick);
    p.advance(10);

    // —— Items table (with borders + column dividers) ——
    const cols = layout.cols;
    const tableX = layout.tableLeft;
    const tableW = layout.tableRight - layout.tableLeft;
    const headerPadY = 8;
    const headerH = T.font.sm + headerPadY * 2;
    const cellPadY = 8;
    const nameInnerW = cols.item.w - 12;

    type RowMeasure = { height: number; nameLines: number };
    const rowMeasures: RowMeasure[] = items.map((item) => {
      ctx.font = printFont(T.font.md, true);
      const nameLines = wrapText(ctx, item.item_name || 'صنف', nameInnerW).length;
      return {
        nameLines,
        height: Math.max(r.lineHeight, nameLines * r.lineHeight) + cellPadY * 2,
      };
    });

    const bodyH =
      items.length === 0
        ? r.lineHeight + cellPadY * 2
        : rowMeasures.reduce((s, m) => s + m.height, 0);
    const tableH = headerH + bodyH;
    const tableTop = p.y;

    // Header text
    const headerTextY = tableTop + headerPadY;
    p.text('الصنف', cols.item.x, headerTextY, T.font.sm, 'right', true, cols.item.w - 12);
    p.text('الكمية', cols.qty.x, headerTextY, T.font.sm, 'center', true, cols.qty.w - 4);
    if (!compact) {
      const unit = layout.cols.unit!;
      const disc = layout.cols.disc!;
      p.text('السعر', unit.x, headerTextY, T.font.sm, 'center', true, unit.w - 4);
      p.text('خصم', disc.x, headerTextY, T.font.sm, 'center', true, disc.w - 4);
    }
    p.text('المجموع', cols.total.x, headerTextY, T.font.sm, 'left', true, cols.total.w - 12);

    // Body rows
    const rowYs: number[] = [];
    let rowY = tableTop + headerH;

    if (items.length === 0) {
      p.text('لا توجد أصناف', p.centerX, rowY + cellPadY, T.font.md, 'center', false);
    } else {
      items.forEach((item, index) => {
        const name = item.item_name || 'صنف';
        const qty = item.quantity || 1;
        const unitPrice = item.price || 0;
        const disc = item.discount || 0;
        const lineTotal = qty * unitPrice - disc;
        const textY = rowY + cellPadY;
        const m = rowMeasures[index];

        p.text(name, cols.item.x, textY, T.font.md, 'right', true, nameInnerW, r.lineHeight);
        p.text(String(qty), cols.qty.x, textY, T.font.md, 'center', false, cols.qty.w - 4);
        if (!compact) {
          const unit = layout.cols.unit!;
          const discCol = layout.cols.disc!;
          p.text(formatCurrencyIqd(unitPrice), unit.x, textY, T.font.sm, 'center', false, unit.w - 4);
          p.text(disc ? formatCurrencyIqd(disc) : '—', discCol.x, textY, T.font.sm, 'center', false, discCol.w - 4);
        }
        p.text(formatCurrencyIqd(lineTotal), cols.total.x, textY, T.font.md, 'left', true, cols.total.w - 12);

        rowY += m.height;
        if (index < items.length - 1) rowYs.push(rowY);
      });
    }

    p.tableFrame(tableX, tableTop, tableW, tableH, headerH, layout.dividers, rowYs);
    p.y = tableTop + tableH;
    p.advance(T.sectionGap);

    // —— Summary ——
    const totals = data.totals || { total: 0 };
    const summaryX = p.right;
    const amountX = p.left;
    const labelW = p.contentW * 0.55;
    const amountW = p.contentW * 0.4;

    const drawSummaryRow = (label: string, amount: string, bold = false, size: number = T.font.md) => {
      p.text(label, summaryX, p.y, size, 'right', bold, labelW);
      p.text(amount, amountX, p.y, size, 'left', bold, amountW);
      p.advance(size + 8);
    };

    if (totals.subtotal != null) {
      drawSummaryRow('المجموع الفرعي', formatCurrencyIqd(totals.subtotal));
    }
    if (totals.globalDiscount && totals.globalDiscount.amount) {
      drawSummaryRow(
        `الخصم (${totals.globalDiscount.percent}%)`,
        `−${formatCurrencyIqd(totals.globalDiscount.amount)}`,
      );
    }
    if (totals.tax != null && totals.tax > 0) {
      drawSummaryRow('الضريبة', formatCurrencyIqd(totals.tax));
    }
    if (totals.serviceCharge != null && totals.serviceCharge > 0) {
      drawSummaryRow('خدمة', formatCurrencyIqd(totals.serviceCharge));
    }

    p.advance(4);
    p.doubleHLine(p.y);
    p.advance(12);

    // Grand total emphasized
    const gtBoxPad = 10;
    const gtLabel = 'الإجمالي';
    const gtValue = formatCurrencyIqd(totals.total);
    ctx.font = printFont(T.font.xl, true);
    const gtH = T.font.xl + gtBoxPad * 2;
    p.box(p.pad, p.y, p.contentW, gtH, T.line.heavy);
    p.text(gtLabel, p.right - gtBoxPad, p.y + gtBoxPad, T.font.xl, 'right', true, labelW);
    p.text(gtValue, p.left + gtBoxPad, p.y + gtBoxPad, T.font.xl, 'left', true, amountW);
    p.advance(gtH + T.sectionGap);

    // —— Payment ——
    if (data.paymentMethod || data.paidAmount != null || data.change != null || data.remaining != null) {
      p.hLine(T.line.hair);
      p.advance(8);
      if (data.paymentMethod) {
        drawSummaryRow('طريقة الدفع', data.paymentMethod, false, T.font.sm);
      }
      if (data.paidAmount != null) {
        drawSummaryRow('المبلغ المدفوع', formatCurrencyIqd(data.paidAmount), false, T.font.sm);
      }
      if (data.remaining != null && data.remaining > 0) {
        drawSummaryRow('المتبقي', formatCurrencyIqd(data.remaining), false, T.font.sm);
      }
      if (data.change != null && data.change > 0) {
        drawSummaryRow('الباقي', formatCurrencyIqd(data.change), false, T.font.sm);
      }
    }

    p.advance(T.gap);
    p.hLine(T.line.thick);
    p.advance(T.sectionGap);

    // —— Footer ——
    const thanks = data.thankYouMessage || 'شكراً لزيارتكم';
    lines = p.text(thanks, p.centerX, p.y, T.font.md, 'center', true, p.contentW);
    p.advance(lines * (T.font.md + 4) + 6);

    if (data.website) {
      lines = p.text(data.website, p.centerX, p.y, T.font.sm, 'center', false, p.contentW);
      p.advance(lines * (T.font.sm + 4) + 2);
    }
    if (data.phone) {
      lines = p.text(data.phone, p.centerX, p.y, T.font.sm, 'center', false, p.contentW);
      p.advance(lines * (T.font.sm + 4) + 2);
    }

    p.track(p.y);

    const pngBuffer = (canvas as any).toBuffer('image/png');
    console.log(
      `[RECEIPT] ✓ PNG generated successfully: ${pngBuffer.length} bytes (${(pngBuffer.length / 1024).toFixed(2)} KB)`,
    );

    if (pngBuffer.length < 1000) {
      throw new Error(`PNG generation failed: output too small (${pngBuffer.length} bytes)`);
    }
    if (pngBuffer.length > 80_000) {
      console.warn(`[RECEIPT] ⚠ PNG large: ${(pngBuffer.length / 1024).toFixed(2)} KB`);
    }

    return pngBuffer;
  } catch (error: any) {
    console.error('[RECEIPT] ✕ Error generating PNG:', error);
    return await generateMinimalFallbackPng('Receipt generation working');
  }
}

function buildReceiptInfoFields(data: ReceiptPrintData, serviceType: string) {
  const fields: Array<{ label: string; value?: string | number | null }> = [];
  if (data.invoiceNumber != null && data.invoiceNumber !== '') {
    fields.push({ label: 'الفاتورة', value: data.invoiceNumber });
  }
  if (data.orderId != null) fields.push({ label: 'الطلب', value: `#${data.orderId}` });
  if (data.timestamp) {
    fields.push({ label: 'التاريخ', value: formatDateAr(data.timestamp) });
    fields.push({ label: 'الوقت', value: formatTimeAr(data.timestamp) });
  }
  if (data.floor) fields.push({ label: 'الطابق', value: data.floor });
  if (data.hall) fields.push({ label: 'القاعة', value: data.hall });
  if (serviceType === 'dine-in' && data.table) {
    fields.push({ label: 'الطاولة', value: data.table });
  }
  if (data.waiter) fields.push({ label: 'النادل', value: data.waiter });
  if (data.cashier) fields.push({ label: 'الكاشير', value: data.cashier });
  return fields;
}
