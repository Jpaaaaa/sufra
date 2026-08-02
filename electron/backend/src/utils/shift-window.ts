import { computeBusinessDate } from './business-date';

export interface ShiftDefinitionLike {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
}

/** Parse minutes since midnight from "HH:mm" or "HH:mm:ss". */
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** True if local time-of-day falls inside [start, end), handling overnight windows. */
export function isInShiftWindow(orderMinutes: number, startMinutes: number, endMinutes: number): boolean {
  if (startMinutes < endMinutes) {
    return orderMinutes >= startMinutes && orderMinutes < endMinutes;
  }
  if (startMinutes > endMinutes) {
    return orderMinutes >= startMinutes || orderMinutes < endMinutes;
  }
  return true;
}

export function findShiftDefinitionForTime(
  createdAt: string,
  definitions: ShiftDefinitionLike[],
): ShiftDefinitionLike | null {
  const normalized = createdAt.replace('T', ' ').replace('Z', '');
  const timePart = normalized.split(' ')[1] || '00:00:00';
  const orderMinutes = timeToMinutes(timePart);

  for (const def of definitions) {
    const start = timeToMinutes(def.start_time);
    const end = timeToMinutes(def.end_time);
    if (isInShiftWindow(orderMinutes, start, end)) {
      return def;
    }
  }
  return null;
}

export interface ResolvedOrderShift {
  business_date: string;
  shift_definition_id: number | null;
}

export function resolveOrderShift(
  createdAt: string,
  mode: 'single' | 'multi',
  businessDayStartTime: string,
  definitions: ShiftDefinitionLike[],
): ResolvedOrderShift {
  if (mode === 'single') {
    return {
      business_date: computeBusinessDate(createdAt, businessDayStartTime),
      shift_definition_id: null,
    };
  }

  const matched = findShiftDefinitionForTime(createdAt, definitions);
  if (!matched) {
    return {
      business_date: computeBusinessDate(createdAt, businessDayStartTime),
      shift_definition_id: null,
    };
  }

  return {
    business_date: computeBusinessDate(createdAt, matched.start_time),
    shift_definition_id: matched.id,
  };
}
