export interface ShiftDraft {
  id?: number;
  name: string;
  start_time: string;
  end_time: string;
}

export interface ShiftOverlapError {
  index: number;
  name: string;
  start: string;
  end: string;
}

export interface ShiftGap {
  start: string;
  end: string;
}

export interface ShiftValidationResult {
  rowErrors: (ShiftOverlapError | null)[];
  gaps: ShiftGap[];
  hasBlockingErrors: boolean;
}

const HH_MM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function isValidHHmm(value: string): boolean {
  return HH_MM.test(value);
}

export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesToHHmm(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function isInShiftWindow(orderMinutes: number, startMinutes: number, endMinutes: number): boolean {
  if (startMinutes < endMinutes) {
    return orderMinutes >= startMinutes && orderMinutes < endMinutes;
  }
  if (startMinutes > endMinutes) {
    return orderMinutes >= startMinutes || orderMinutes < endMinutes;
  }
  return true;
}

function shiftsOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);
  for (let m = 0; m < 1440; m += 15) {
    if (isInShiftWindow(m, sA, eA) && isInShiftWindow(m, sB, eB)) return true;
  }
  return false;
}

function isShiftComplete(shift: ShiftDraft): boolean {
  return (
    Boolean(shift.name.trim()) &&
    isValidHHmm(shift.start_time) &&
    isValidHHmm(shift.end_time) &&
    shift.start_time !== shift.end_time
  );
}

export function validateShifts(shifts: ShiftDraft[]): ShiftValidationResult {
  const rowErrors: (ShiftOverlapError | null)[] = shifts.map(() => null);
  let hasBlockingErrors = false;

  for (let i = 0; i < shifts.length; i++) {
    const a = shifts[i];
    if (!isShiftComplete(a)) {
      if (a.name.trim() || a.start_time || a.end_time) {
        if (!a.name.trim() || !isValidHHmm(a.start_time) || !isValidHHmm(a.end_time) || a.start_time === a.end_time) {
          hasBlockingErrors = true;
        }
      }
      continue;
    }
    for (let j = 0; j < shifts.length; j++) {
      if (i === j) continue;
      const b = shifts[j];
      if (!isShiftComplete(b)) continue;
      if (shiftsOverlap(a.start_time, a.end_time, b.start_time, b.end_time)) {
        rowErrors[i] = {
          index: j,
          name: b.name.trim() || `Shift ${j + 1}`,
          start: b.start_time,
          end: b.end_time,
        };
        hasBlockingErrors = true;
        break;
      }
    }
  }

  const complete = shifts.filter(isShiftComplete);
  const gaps = findGaps(complete);

  return { rowErrors, gaps, hasBlockingErrors };
}

function findGaps(shifts: ShiftDraft[]): ShiftGap[] {
  if (shifts.length === 0) return [];

  const covered = new Array(1440).fill(false);
  for (const shift of shifts) {
    const start = timeToMinutes(shift.start_time);
    const end = timeToMinutes(shift.end_time);
    for (let m = 0; m < 1440; m += 15) {
      if (isInShiftWindow(m, start, end)) covered[m] = true;
    }
  }

  const gaps: ShiftGap[] = [];
  let gapStart: number | null = null;
  for (let m = 0; m < 1440; m += 15) {
    if (!covered[m]) {
      if (gapStart === null) gapStart = m;
    } else if (gapStart !== null) {
      gaps.push({ start: minutesToHHmm(gapStart), end: minutesToHHmm(m) });
      gapStart = null;
    }
  }
  if (gapStart !== null) {
    gaps.push({ start: minutesToHHmm(gapStart), end: minutesToHHmm(0) });
  }
  return gaps;
}

export function createEmptyShift(_index: number, id?: number): ShiftDraft {
  return {
    id,
    name: '',
    start_time: '09:00',
    end_time: '15:00',
  };
}

export function shiftsFromDefinitions(
  definitions: Array<{ id: number; name: string; start_time: string; end_time: string }>,
): ShiftDraft[] {
  if (!definitions.length) return [];
  return definitions.map((d) => ({
    id: d.id,
    name: d.name,
    start_time: d.start_time.slice(0, 5),
    end_time: d.end_time.slice(0, 5),
  }));
}
