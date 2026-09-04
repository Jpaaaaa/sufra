/** Thermal print design tokens — black ink on white paper only. */

export type PaperWidthMm = 58 | 80;

/**
 * Named kitchen print roles — use these instead of ad-hoc font sizes.
 * Canvas px on ~576 (80mm) / ~384 (58mm) bitmaps.
 */
export const KITCHEN_TYPE = {
  /** Kitchen station name at top */
  kitchenName: 24,
  /** Dominant order number e.g. #82 */
  orderNumber: 56,
  /** Takeaway / delivery title when no table */
  orderType: 42,
  /** Table number — second largest on dine-in */
  tableNumber: 44,
  /** Floor • hall */
  location: 32,
  /** Clock time under location — large enough to read at a glance */
  time: 34,
  /** Tray header e.g. صينية 1 ×2 */
  trayHeader: 30,
  /** Child line under a tray */
  trayChild: 28,
  /** "مفرد" section label */
  singleSection: 30,
  /** Standalone product line */
  singleItem: 28,
  /** Notes / reprint / modifiers */
  secondary: 22,
  /** Compact vertical rhythm */
  gapAfterOrder: 6,
  gapAfterPrimary: 4,
  gapAfterMeta: 6,
  gapBetweenTrays: 8,
  gapChild: 2,
  indentChild: 20,
  orderBandPadY: 10,
} as const;

export const PRINT_TOKENS = {
  width80: 576,
  width58: 384,
  pad: 14,
  gap: 8,
  sectionGap: 14,
  bottomBuffer: 120,
  font: {
    xs: 18,
    sm: 22,
    md: 26,
    lg: 32,
    xl: 40,
    xxl: 48,
  },
  line: {
    hair: 1,
    thick: 2,
    heavy: 3,
  },
  ink: '#000000',
  paper: '#FFFFFF',
  /** @deprecated Prefer KITCHEN_TYPE role tokens */
  kitchen: {
    fontMd: KITCHEN_TYPE.trayChild,
    fontLg: KITCHEN_TYPE.tableNumber,
    fontXl: KITCHEN_TYPE.orderNumber,
    lineHeight: KITCHEN_TYPE.trayChild + 8,
  },
  receipt: {
    lineHeight: 30,
    lineHeightSm: 26,
  },
  kitchenType: KITCHEN_TYPE,
} as const;

export function canvasWidthFor(paper: PaperWidthMm = 80): number {
  return paper === 58 ? PRINT_TOKENS.width58 : PRINT_TOKENS.width80;
}

export function contentWidth(paper: PaperWidthMm = 80): number {
  return canvasWidthFor(paper) - PRINT_TOKENS.pad * 2;
}

export type TableCol = {
  /** Text anchor X inside cell */
  x: number;
  w: number;
  /** Cell left edge */
  left: number;
  /** Cell right edge */
  right: number;
  align: 'left' | 'center' | 'right';
};

/**
 * Customer sales table (RTL, right → left):
 * الصنف | الكمية | السعر | المجموع
 */
export function receiptColumnLayout(paper: PaperWidthMm = 80) {
  const pad = PRINT_TOKENS.pad;
  const full = canvasWidthFor(paper);
  const left = pad;
  const right = full - pad;
  const W = right - left;
  const cellPad = paper === 58 ? 4 : 6;

  // Proportions tuned so amounts stay on one line on 58/80mm rolls.
  const qtyW = paper === 58 ? Math.round(W * 0.12) : Math.round(W * 0.11);
  const priceW = paper === 58 ? Math.round(W * 0.22) : Math.round(W * 0.22);
  const totalW = paper === 58 ? Math.round(W * 0.24) : Math.round(W * 0.24);
  const itemW = W - qtyW - priceW - totalW;

  let cursor = right;
  const itemRight = cursor;
  cursor -= itemW;
  const itemLeft = cursor;
  const qtyRight = cursor;
  cursor -= qtyW;
  const qtyLeft = cursor;
  const priceRight = cursor;
  cursor -= priceW;
  const priceLeft = cursor;
  const totalRight = cursor;
  const totalLeft = left;

  return {
    mode: (paper === 58 ? 'compact' : 'full') as 'compact' | 'full',
    tableLeft: left,
    tableRight: right,
    dividers: [itemLeft, qtyLeft, priceLeft],
    cols: {
      item: {
        left: itemLeft,
        right: itemRight,
        w: itemW,
        x: itemRight - cellPad,
        align: 'right' as const,
      },
      qty: {
        left: qtyLeft,
        right: qtyRight,
        w: qtyW,
        x: (qtyLeft + qtyRight) / 2,
        align: 'center' as const,
      },
      price: {
        left: priceLeft,
        right: priceRight,
        w: priceW,
        x: (priceLeft + priceRight) / 2,
        align: 'center' as const,
      },
      total: {
        left: totalLeft,
        right: totalRight,
        w: totalW,
        x: totalLeft + cellPad,
        align: 'left' as const,
      },
    },
  };
}

/**
 * Kitchen items table (RTL): الصنف | الكمية
 * No money / type / tray# columns — hierarchy is shown by indentation.
 */
export function kitchenColumnLayout(paper: PaperWidthMm = 80) {
  const pad = PRINT_TOKENS.pad;
  const full = canvasWidthFor(paper);
  const left = pad;
  const right = full - pad;
  const W = right - left;
  const cellPad = paper === 58 ? 4 : 6;
  const qtyW = paper === 58 ? 56 : 72;
  const nameW = W - qtyW;
  const nameRight = right;
  const nameLeft = nameRight - nameW;
  const qtyRight = nameLeft;
  const qtyLeft = left;
  return {
    tableLeft: left,
    tableRight: right,
    dividers: [nameLeft],
    name: {
      left: nameLeft,
      right: nameRight,
      w: nameW,
      x: nameRight - cellPad,
      align: 'right' as const,
    },
    qty: {
      left: qtyLeft,
      right: qtyRight,
      w: qtyW,
      x: (qtyLeft + qtyRight) / 2,
      align: 'center' as const,
    },
  };
}
