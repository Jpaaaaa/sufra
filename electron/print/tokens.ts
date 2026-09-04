/** Thermal print design tokens — black ink on white paper only. */

export type PaperWidthMm = 58 | 80;

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
  /** Kitchen tickets use larger type for speed-of-read. */
  kitchen: {
    fontMd: 30,
    fontLg: 36,
    fontXl: 44,
    lineHeight: 36,
  },
  receipt: {
    lineHeight: 30,
    lineHeightSm: 26,
  },
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

/** RTL customer receipt columns with cell edges for table borders. */
export function receiptColumnLayout(paper: PaperWidthMm = 80) {
  const pad = PRINT_TOKENS.pad;
  const full = canvasWidthFor(paper);
  const left = pad;
  const right = full - pad;
  const W = right - left;
  const cellPad = 6;

  if (paper === 58) {
    const totalW = Math.round(W * 0.28);
    const qtyW = Math.round(W * 0.14);
    const itemW = W - qtyW - totalW;

    // RTL: item | qty | total  (right → left)
    const itemRight = right;
    const itemLeft = itemRight - itemW;
    const qtyRight = itemLeft;
    const qtyLeft = qtyRight - qtyW;
    const totalRight = qtyLeft;
    const totalLeft = left;

    return {
      mode: 'compact' as const,
      tableLeft: left,
      tableRight: right,
      dividers: [itemLeft, qtyLeft],
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

  const itemW = Math.round(W * 0.38);
  const qtyW = Math.round(W * 0.1);
  const unitW = Math.round(W * 0.17);
  const discW = Math.round(W * 0.14);
  const totalW = W - itemW - qtyW - unitW - discW;

  // RTL: item | qty | unit | disc | total
  let cursor = right;
  const itemRight = cursor;
  cursor -= itemW;
  const itemLeft = cursor;
  const qtyRight = cursor;
  cursor -= qtyW;
  const qtyLeft = cursor;
  const unitRight = cursor;
  cursor -= unitW;
  const unitLeft = cursor;
  const discRight = cursor;
  cursor -= discW;
  const discLeft = cursor;
  const totalRight = cursor;
  const totalLeft = left;

  return {
    mode: 'full' as const,
    tableLeft: left,
    tableRight: right,
    dividers: [itemLeft, qtyLeft, unitLeft, discLeft],
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
      unit: {
        left: unitLeft,
        right: unitRight,
        w: unitW,
        x: (unitLeft + unitRight) / 2,
        align: 'center' as const,
      },
      disc: {
        left: discLeft,
        right: discRight,
        w: discW,
        x: (discLeft + discRight) / 2,
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

/** Kitchen items table: Qty | Name */
export function kitchenColumnLayout(paper: PaperWidthMm = 80) {
  const pad = PRINT_TOKENS.pad;
  const full = canvasWidthFor(paper);
  const left = pad;
  const right = full - pad;
  const W = right - left;
  const cellPad = 8;
  const qtyW = paper === 58 ? 56 : 72;
  const nameW = W - qtyW;

  const qtyRight = right;
  const qtyLeft = qtyRight - qtyW;
  const nameRight = qtyLeft;
  const nameLeft = left;

  return {
    tableLeft: left,
    tableRight: right,
    dividers: [qtyLeft],
    qty: {
      left: qtyLeft,
      right: qtyRight,
      w: qtyW,
      x: qtyRight - cellPad,
      align: 'right' as const,
    },
    name: {
      left: nameLeft,
      right: nameRight,
      w: nameW,
      x: nameRight - cellPad,
      align: 'right' as const,
    },
  };
}
