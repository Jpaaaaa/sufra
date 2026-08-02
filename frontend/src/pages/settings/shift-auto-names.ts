import type { ShiftDraft } from './shift-validation';

export function applyAutoShiftNames(
  rows: ShiftDraft[],
  nameForIndex: (index: number) => string,
): ShiftDraft[] {
  return rows.map((row, index) => ({
    ...row,
    name: nameForIndex(index),
  }));
}
