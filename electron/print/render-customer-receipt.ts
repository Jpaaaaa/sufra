import type { ReceiptPrintData, ReceiptPrintItem } from './receipt-utils';
import {
  PRINT_TOKENS,
  canvasWidthFor,
  receiptColumnLayout,
  type PaperWidthMm,
} from './tokens';
import { registerArabicFontIfAvailable, printFont } from './canvas/fonts';
import {
  formatAmountIqd,
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
import { getTrayPrintName } from './tray-print-name';

/**
 * Customer sales receipt — formal table layout.
 * Tray header = billed row; tray children = detail rows (qty only, money cells empty).
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
    const cols = layout.cols;

    const nameFont = (item: ReceiptPrintItem) =>
      item.is_tray_child ? T.font.sm : T.font.md;
    const nameInnerW = (item: ReceiptPrintItem) =>
      cols.item.w - (item.is_tray_child ? 22 : 12);

    const rowLabel = (item: ReceiptPrintItem): string => {
      const raw = (item.item_name || 'صنف').trim();
      if (item.is_tray_header) return getTrayPrintName(item.tray_number, raw);
      if (item.is_tray_child) return `• ${raw}`;
      return raw;
    };

    // Pass 1 — measure
    const { ctx: tempCtx } = await createPrintCanvas(width, 100);
    const measure = new ReceiptPainter(tempCtx, paper);
    let y = measure.pad;

    y += 70;
    y += T.font.xl + 8;
    if (data.address) y += T.font.sm * 2 + 4;
    if (data.phone) y += T.font.sm + 4;
    if (data.taxNumber) y += T.font.sm + 4;
    if (serviceType === 'pickup' || serviceType === 'delivery') y += T.font.lg + 8;
    y += T.sectionGap;

    const infoFields = buildReceiptInfoFields(data, serviceType);
    const visible = infoFields.filter((f) => f.value != null && String(f.value).trim() !== '');
    y += Math.ceil(Math.max(1, visible.length) / 2) * 72 + T.sectionGap;

    if (serviceType === 'pickup' || serviceType === 'delivery') {
      const hasCustomer =
        Boolean(data.customer_name) ||
        Boolean(data.customer_phone) ||
        (serviceType === 'delivery' && Boolean(data.customer_address));
      if (hasCustomer) {
        y += T.font.md + 16; // inverted header band
        y += 14; // box pad top
        if (data.customer_name) y += T.font.xl + 10;
        if (data.customer_phone) y += T.font.lg + 10;
        if (serviceType === 'delivery' && data.customer_address) {
          tempCtx.font = printFont(T.font.md, true);
          y +=
            wrapText(tempCtx, `العنوان: ${data.customer_address}`, measure.contentW - 28).length *
              (T.font.md + 6) +
            8;
        }
        y += 14 + T.sectionGap; // box pad bottom + gap
      }
    }

    y += T.font.xs + 10;
    y += T.font.sm + 20;

    for (const item of items) {
      const font = nameFont(item);
      tempCtx.font = printFont(font, !item.is_tray_child);
      const lh = item.is_tray_child ? r.lineHeightSm : r.lineHeight;
      const nameLines = wrapText(tempCtx, rowLabel(item), nameInnerW(item));
      y += Math.max(lh, nameLines.length * lh) + 10;
    }

    y += T.sectionGap;
    y += (r.lineHeight + 4) * 5;
    y += T.font.xl + 20;
    y += (r.lineHeight + 4) * 4;
    y += T.sectionGap + T.font.md + 40;
    y += T.bottomBuffer;

    const height = Math.max(500, y);

    // Pass 2 — draw
    const { canvas, ctx } = await createPrintCanvas(width, height);
    const p = new ReceiptPainter(ctx, paper);

    const logoH = await p.drawLogo(data.logoUrl, paper === 58 ? 48 : 64, {
      allowFallback: !data.skipDefaultLogo,
    });
    if (logoH) p.advance(logoH + 8);
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

    // Customer block first for pickup/delivery — dominant for staff/drivers
    if (serviceType === 'pickup' || serviceType === 'delivery') {
      const hasCustomer =
        Boolean(data.customer_name) ||
        Boolean(data.customer_phone) ||
        (serviceType === 'delivery' && Boolean(data.customer_address));
      if (hasCustomer) {
        const headerH = T.font.md + 16;
        p.fillBox(p.pad, p.y, p.contentW, headerH);
        const ctxHeader = ctx;
        ctxHeader.fillStyle = T.paper;
        ctxHeader.font = printFont(T.font.md, true);
        ctxHeader.textAlign = 'center';
        ctxHeader.textBaseline = 'middle';
        ctxHeader.fillText('بيانات العميل', p.centerX, p.y + headerH / 2);
        ctxHeader.fillStyle = T.ink;
        ctxHeader.textBaseline = 'top';
        p.advance(headerH);

        const boxPadX = 14;
        const boxPadY = 14;
        const innerW = p.contentW - boxPadX * 2;
        const boxTop = p.y;
        let innerY = boxTop + boxPadY;

        if (data.customer_name) {
          lines = p.text(
            String(data.customer_name),
            p.centerX,
            innerY,
            T.font.xl,
            'center',
            true,
            innerW,
            T.font.xl + 6,
          );
          innerY += lines * (T.font.xl + 6) + 8;
        }
        if (data.customer_phone) {
          lines = p.text(
            `هاتف: ${data.customer_phone}`,
            p.centerX,
            innerY,
            T.font.lg,
            'center',
            true,
            innerW,
            T.font.lg + 6,
          );
          innerY += lines * (T.font.lg + 6) + 8;
        }
        if (serviceType === 'delivery' && data.customer_address) {
          lines = p.text(
            `العنوان: ${data.customer_address}`,
            p.centerX,
            innerY,
            T.font.md,
            'center',
            true,
            innerW,
            T.font.md + 6,
          );
          innerY += lines * (T.font.md + 6);
        }

        const boxH = Math.max(T.font.xl + boxPadY * 2, innerY + boxPadY - boxTop);
        // Double outline for thermal contrast
        p.box(p.pad, boxTop, p.contentW, boxH, T.line.heavy);
        p.box(p.pad + 3, boxTop + 3, p.contentW - 6, boxH - 6, T.line.thick);
        p.advance(boxH + T.sectionGap);
      }
    }

    const gridH = p.infoGrid(infoFields, p.y, 2, T.font.md);
    if (gridH) p.advance(gridH + T.sectionGap);

    p.hLine(T.line.thick);
    p.advance(6);
    p.text('المبالغ بالدينار (د.ع)', p.centerX, p.y, T.font.xs, 'center', false, p.contentW);
    p.advance(T.font.xs + 8);

    // —— Sales table: الصنف | الكمية | السعر | المجموع ——
    const tableX = layout.tableLeft;
    const tableW = layout.tableRight - layout.tableLeft;
    const headerPadY = 8;
    const headerH = T.font.sm + headerPadY * 2;
    const cellPadY = 6;

    type RowMeasure = { height: number; font: number; lh: number; label: string; nameW: number };
    const rowMeasures: RowMeasure[] = items.map((item) => {
      const font = nameFont(item);
      const lh = item.is_tray_child ? r.lineHeightSm : r.lineHeight;
      const label = rowLabel(item);
      const nameW = nameInnerW(item);
      ctx.font = printFont(font, !item.is_tray_child);
      const nameLines = wrapText(ctx, label, nameW).length;
      return {
        font,
        lh,
        label,
        nameW,
        height: Math.max(lh, nameLines * lh) + cellPadY * 2,
      };
    });

    const bodyH =
      items.length === 0
        ? r.lineHeight + cellPadY * 2
        : rowMeasures.reduce((s, m) => s + m.height, 0);
    const tableH = headerH + bodyH;
    const tableTop = p.y;

    const headerTextY = tableTop + headerPadY;
    p.text('الصنف', cols.item.x, headerTextY, T.font.sm, 'right', true, cols.item.w - 12);
    p.text('الكمية', cols.qty.x, headerTextY, T.font.sm, 'center', true, cols.qty.w - 4);
    p.text('السعر', cols.price.x, headerTextY, T.font.sm, 'center', true, cols.price.w - 4);
    p.text('المجموع', cols.total.x, headerTextY, T.font.sm, 'left', true, cols.total.w - 12);

    const rowYs: number[] = [];
    let rowY = tableTop + headerH;

    if (items.length === 0) {
      p.text('لا توجد أصناف', p.centerX, rowY + cellPadY, T.font.md, 'center', false);
    } else {
      items.forEach((item, index) => {
        const m = rowMeasures[index];
        const textY = rowY + cellPadY;
        const qty = item.quantity || 1;
        const isDetail = Boolean(item.is_tray_child);

        // Name (indented via bullet + narrower wrap for children)
        p.text(m.label, cols.item.x, textY, m.font, 'right', !isDetail, m.nameW, m.lh);

        // Qty always shown
        p.singleLine(String(qty), cols.qty.x, textY, m.font, 'center', !isDetail, cols.qty.w - 4);

        if (!isDetail) {
          const unitPrice = item.price || 0;
          const disc = item.discount || 0;
          const lineTotal = qty * unitPrice - disc;
          p.singleLine(
            formatAmountIqd(unitPrice),
            cols.price.x,
            textY,
            T.font.sm,
            'center',
            false,
            cols.price.w - 6,
          );
          p.singleLine(
            formatAmountIqd(lineTotal),
            cols.total.x,
            textY,
            T.font.md,
            'left',
            true,
            cols.total.w - 10,
          );
        }
        // Detail rows: leave السعر / المجموع empty (no —, no 0)

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

    const gtBoxPad = 10;
    const gtLabel = 'الإجمالي';
    const gtValue = formatCurrencyIqd(totals.total);
    ctx.font = printFont(T.font.xl, true);
    const gtH = T.font.xl + gtBoxPad * 2;
    p.box(p.pad, p.y, p.contentW, gtH, T.line.heavy);
    p.text(gtLabel, p.right - gtBoxPad, p.y + gtBoxPad, T.font.xl, 'right', true, labelW);
    p.text(gtValue, p.left + gtBoxPad, p.y + gtBoxPad, T.font.xl, 'left', true, amountW);
    p.advance(gtH + T.sectionGap);

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
  const invoiceStr = String(data.invoiceNumber ?? '');
  const isCombinedInvoice = invoiceStr.includes('+');
  if (data.orderId != null && !isCombinedInvoice) {
    const ticketNo =
      data.displayNumber != null && Number(data.displayNumber) > 0
        ? Number(data.displayNumber)
        : data.orderId;
    fields.push({ label: 'الطلب', value: `#${ticketNo}` });
  }
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
