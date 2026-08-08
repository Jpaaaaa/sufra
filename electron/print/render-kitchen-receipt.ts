import type { OrderPrintData, PrintItemOption, KitchenPrintItem } from './receipt-utils';
import {
  PRINT_TOKENS,
  KITCHEN_TYPE,
  canvasWidthFor,
  kitchenColumnLayout,
  type PaperWidthMm,
} from './tokens';
import { registerArabicFontIfAvailable, printFont } from './canvas/fonts';
import { formatTimeAr, wrapText } from './canvas/text';
import {
  ReceiptPainter,
  createPrintCanvas,
  generateMinimalFallbackPng,
} from './canvas/primitives';
import { getTrayPrintName, parseTrayNumberFromPrintName } from './tray-print-name';

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

function modifierLines(item: KitchenPrintItem): string[] {
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

function isTrayHeader(item: KitchenPrintItem): boolean {
  return Boolean(item.is_tray_header);
}

function isTrayChild(item: KitchenPrintItem): boolean {
  return Boolean(item.is_tray_child);
}

function resolveTrayNumber(item: KitchenPrintItem, fallback?: number | null): number | null {
  if (item.tray_number != null && item.tray_number > 0) return item.tray_number;
  const fromName = parseTrayNumberFromPrintName(item.item_name);
  if (fromName != null) return fromName;
  return fallback ?? null;
}

function normalizeKitchenItems(items: KitchenPrintItem[]): KitchenPrintItem[] {
  let seq = 0;
  let currentTray: number | null = null;
  return items.map((item) => {
    if (isTrayHeader(item)) {
      const n = resolveTrayNumber(item) ?? ++seq;
      currentTray = n;
      return {
        ...item,
        tray_number: n,
        item_name: getTrayPrintName(n, item.item_name),
      };
    }
    if (isTrayChild(item)) {
      const n = resolveTrayNumber(item, currentTray) ?? currentTray ?? ++seq;
      currentTray = n;
      return { ...item, tray_number: n };
    }
    currentTray = null;
    return { ...item, tray_number: null };
  });
}

type TrayBlock = { header: KitchenPrintItem; children: KitchenPrintItem[] };

function buildKitchenBlocks(items: KitchenPrintItem[]): {
  trays: TrayBlock[];
  singles: KitchenPrintItem[];
} {
  const trays: TrayBlock[] = [];
  const singles: KitchenPrintItem[] = [];
  let current: TrayBlock | null = null;

  for (const item of items) {
    if (isTrayHeader(item)) {
      current = { header: item, children: [] };
      trays.push(current);
      continue;
    }
    if (isTrayChild(item)) {
      if (current) current.children.push(item);
      else singles.push(item);
      continue;
    }
    current = null;
    singles.push(item);
  }

  return { trays, singles };
}

function serviceTypeTitle(serviceType: string): string {
  switch (serviceType) {
    case 'pickup':
      return 'سفري';
    case 'delivery':
      return 'توصيل';
    default:
      return 'طاولة';
  }
}

function kitchenTypeFor(paper: PaperWidthMm) {
  if (paper !== 58) return KITCHEN_TYPE;
  const scale = 0.88;
  return {
    ...KITCHEN_TYPE,
    kitchenName: Math.round(KITCHEN_TYPE.kitchenName * scale),
    orderNumber: Math.round(KITCHEN_TYPE.orderNumber * scale),
    orderType: Math.round(KITCHEN_TYPE.orderType * scale),
    tableNumber: Math.round(KITCHEN_TYPE.tableNumber * scale),
    location: Math.round(KITCHEN_TYPE.location * scale),
    time: Math.round(KITCHEN_TYPE.time * scale),
    trayHeader: Math.round(KITCHEN_TYPE.trayHeader * scale),
    trayChild: Math.round(KITCHEN_TYPE.trayChild * scale),
    singleSection: Math.round(KITCHEN_TYPE.singleSection * scale),
    singleItem: Math.round(KITCHEN_TYPE.singleItem * scale),
    secondary: Math.round(KITCHEN_TYPE.secondary * scale),
  };
}

type TableRow = {
  kind: 'tray' | 'child' | 'single' | 'section' | 'meta' | 'empty';
  label: string;
  qty: string | null;
  font: number;
  bold: boolean;
  indent: number;
};

/**
 * Kitchen ticket — large header hierarchy + items as الصنف | الكمية table.
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
    const K = kitchenTypeFor(paper);
    const layout = kitchenColumnLayout(paper);
    const items = normalizeKitchenItems(data.items);
    const { trays, singles } = buildKitchenBlocks(items);
    const serviceType = data.service_type || items[0]?.service_type || 'dine-in';
    const orderTime = formatTimeAr(data.timestamp || data.printTime);
    const serviceTitle = serviceTypeTitle(serviceType);
    const hasTable =
      serviceType === 'dine-in' &&
      data.table != null &&
      String(data.table).trim() !== '' &&
      String(data.table) !== '0';

    const childIndent = K.indentChild;
    const rows: TableRow[] = [];

    for (const block of trays) {
      rows.push({
        kind: 'tray',
        label: getTrayPrintName(block.header.tray_number, block.header.item_name),
        qty: String(block.header.quantity || 1),
        font: K.trayHeader,
        bold: true,
        indent: 0,
      });
      if (block.children.length === 0) {
        rows.push({
          kind: 'empty',
          label: '— فارغة —',
          qty: null,
          font: K.secondary,
          bold: false,
          indent: childIndent,
        });
      } else {
        for (const child of block.children) {
          rows.push({
            kind: 'child',
            label: `• ${child.item_name || 'صنف'}`,
            qty: String(child.quantity || 1),
            font: K.trayChild,
            bold: true,
            indent: childIndent,
          });
          for (const mod of modifierLines(child)) {
            rows.push({
              kind: 'meta',
              label: `• ${mod}`,
              qty: null,
              font: K.secondary,
              bold: false,
              indent: childIndent + 10,
            });
          }
          if (child.note) {
            rows.push({
              kind: 'meta',
              label: `※ ${child.note}`,
              qty: null,
              font: K.secondary,
              bold: true,
              indent: childIndent + 10,
            });
          }
        }
      }
    }

    if (singles.length) {
      rows.push({
        kind: 'section',
        label: 'مفرد',
        qty: null,
        font: K.singleSection,
        bold: true,
        indent: 0,
      });
      for (const item of singles) {
        rows.push({
          kind: 'single',
          label: item.item_name || 'صنف',
          qty: String(item.quantity || 1),
          font: K.singleItem,
          bold: true,
          indent: 0,
        });
        for (const mod of modifierLines(item)) {
          rows.push({
            kind: 'meta',
            label: `• ${mod}`,
            qty: null,
            font: K.secondary,
            bold: false,
            indent: childIndent,
          });
        }
        if (item.note) {
          rows.push({
            kind: 'meta',
            label: `※ ${item.note}`,
            qty: null,
            font: K.secondary,
            bold: true,
            indent: childIndent,
          });
        }
      }
    }

    // —— Measure ——
    const { ctx: tempCtx } = await createPrintCanvas(width, 80);
    const measure = new ReceiptPainter(tempCtx, paper);
    let est = measure.pad;

    const cellPadY = 5;
    const headerPadY = 7;
    const tableHeaderH = K.secondary + headerPadY * 2;

    est += K.kitchenName + 6;
    est += K.orderNumber + K.orderBandPadY * 2 + K.gapAfterOrder;
    if (hasTable) {
      est += K.tableNumber + K.gapAfterPrimary;
      if (data.floor || data.hall) est += K.location + K.gapAfterPrimary;
    } else {
      est += K.orderType + K.gapAfterPrimary;
    }
    if (orderTime) est += K.time + K.gapAfterMeta;
    if (data.priority) est += 28;
    if (serviceType === 'delivery') {
      if (data.customer_name) est += K.secondary + 4;
      if (data.customer_phone) est += K.secondary + 4;
    }
    est += 10;
    est += tableHeaderH;

    for (const row of rows) {
      const nameW = layout.name.w - row.indent - 10;
      tempCtx.font = printFont(row.font, row.bold);
      const n = wrapText(tempCtx, row.label, Math.max(40, nameW)).length;
      const lh = row.font + 4;
      est += Math.max(lh, n * lh) + cellPadY * 2;
    }
    if (!rows.length) est += K.trayChild + cellPadY * 2;

    if (data.note) {
      tempCtx.font = printFont(K.secondary + 4, true);
      est +=
        K.secondary +
        10 +
        wrapText(tempCtx, data.note, measure.contentW - 16).length * (K.secondary + 5) +
        10;
    }
    if (data.reprintCount != null && data.reprintCount > 0) est += K.secondary + 6;
    est += T.bottomBuffer;
    const height = Math.max(280, est);

    // —— Draw ——
    const { canvas, ctx } = await createPrintCanvas(width, height);
    const p = new ReceiptPainter(ctx, paper);

    let lines = p.text(
      data.kitchenName || 'المطبخ',
      p.centerX,
      p.y,
      K.kitchenName,
      'center',
      true,
      p.contentW,
      K.kitchenName + 2,
    );
    p.advance(lines * (K.kitchenName + 2) + 4);

    const ticketNo =
      data.displayNumber != null && Number(data.displayNumber) > 0
        ? Number(data.displayNumber)
        : data.orderId;
    const orderLabel = `#${ticketNo ?? '—'}`;
    const orderBandH = K.orderNumber + K.orderBandPadY * 2;
    p.fillBox(p.pad, p.y, p.contentW, orderBandH);
    ctx.fillStyle = T.paper;
    ctx.font = printFont(K.orderNumber, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(orderLabel, p.centerX, p.y + orderBandH / 2);
    ctx.fillStyle = T.ink;
    ctx.textBaseline = 'top';
    p.advance(orderBandH + K.gapAfterOrder);

    if (hasTable) {
      lines = p.text(
        `طاولة ${data.table}`,
        p.centerX,
        p.y,
        K.tableNumber,
        'center',
        true,
        p.contentW,
        K.tableNumber + 2,
      );
      p.advance(lines * (K.tableNumber + 2) + K.gapAfterPrimary);

      const locParts: string[] = [];
      if (data.floor) {
        const floor = String(data.floor).trim();
        locParts.push(
          /^(الطابق|طابق)\b/.test(floor) ? floor.replace(/^طابق\b/, 'الطابق') : `الطابق ${floor}`,
        );
      }
      if (data.hall) {
        const hall = String(data.hall).trim();
        locParts.push(/^(الصالة|صالة|القاعة|قاعة)\b/.test(hall) ? hall : `الصالة ${hall}`);
      }
      if (locParts.length) {
        lines = p.text(
          locParts.join(' • '),
          p.centerX,
          p.y,
          K.location,
          'center',
          true,
          p.contentW,
          K.location + 2,
        );
        p.advance(lines * (K.location + 2) + K.gapAfterPrimary);
      }
    } else {
      lines = p.text(serviceTitle, p.centerX, p.y, K.orderType, 'center', true, p.contentW, K.orderType + 2);
      p.advance(lines * (K.orderType + 2) + K.gapAfterPrimary);
    }

    // Larger order time
    if (orderTime) {
      lines = p.text(orderTime, p.centerX, p.y, K.time, 'center', true, p.contentW, K.time + 2);
      p.advance(lines * (K.time + 2) + K.gapAfterMeta);
    }

    if (serviceType === 'delivery') {
      if (data.customer_name) {
        lines = p.text(String(data.customer_name), p.centerX, p.y, K.secondary, 'center', true, p.contentW);
        p.advance(lines * (K.secondary + 2) + 2);
      }
      if (data.customer_phone) {
        lines = p.text(String(data.customer_phone), p.centerX, p.y, K.secondary, 'center', false, p.contentW);
        p.advance(lines * (K.secondary + 2) + 2);
      }
    }

    if (data.priority) {
      const pr = p.badge('★ مستعجل ★', p.centerX, p.y, K.secondary, 'center', 12, 4);
      p.advance(pr.height + 4);
    }

    p.advance(4);

    // —— Items table: الصنف | الكمية ——
    const cols = layout;
    const tableX = cols.tableLeft;
    const tableW = cols.tableRight - cols.tableLeft;

    type RowMeasure = { height: number; nameLines: number; nameW: number };
    const rowMeasures: RowMeasure[] = rows.map((row) => {
      const nameW = Math.max(40, cols.name.w - row.indent - 10);
      ctx.font = printFont(row.font, row.bold);
      const nameLines = wrapText(ctx, row.label, nameW).length;
      const lh = row.font + 4;
      return {
        nameW,
        nameLines,
        height: Math.max(lh, nameLines * lh) + cellPadY * 2,
      };
    });

    const bodyH =
      rows.length === 0
        ? K.trayChild + cellPadY * 2
        : rowMeasures.reduce((s, m) => s + m.height, 0);
    const tableH = tableHeaderH + bodyH;
    const tableTop = p.y;

    p.text('الصنف', cols.name.x, tableTop + headerPadY, K.secondary, 'right', true, cols.name.w - 10);
    p.text('الكمية', cols.qty.x, tableTop + headerPadY, K.secondary, 'center', true, cols.qty.w - 4);

    const rowYs: number[] = [];
    let rowY = tableTop + tableHeaderH;

    if (rows.length === 0) {
      p.text('لا توجد أصناف', p.centerX, rowY + cellPadY, K.trayChild, 'center', false);
    } else {
      rows.forEach((row, index) => {
        const m = rowMeasures[index];
        const textY = rowY + cellPadY;
        const lh = row.font + 4;
        p.text(
          row.label,
          cols.name.x - row.indent,
          textY,
          row.font,
          'right',
          row.bold,
          m.nameW,
          lh,
        );
        if (row.qty != null) {
          p.singleLine(row.qty, cols.qty.x, textY, row.font, 'center', row.bold, cols.qty.w - 4);
        }
        rowY += m.height;
        if (index < rows.length - 1) rowYs.push(rowY);
      });
    }

    p.tableFrame(
      tableX,
      tableTop,
      tableW,
      tableH,
      tableHeaderH,
      cols.dividers,
      rowYs,
      T.line.heavy,
      T.line.thick,
    );
    p.y = tableTop + tableH;
    p.advance(8);

    if (data.note) {
      const noteH = p.orderNoteBlock('ملاحظات', data.note, p.y, K.secondary + 4);
      p.advance(noteH + 4);
    }

    if (data.reprintCount != null && data.reprintCount > 0) {
      p.text(`إعادة طباعة #${data.reprintCount}`, p.centerX, p.y, K.secondary, 'center', false);
      p.advance(K.secondary + 4);
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
