/** JS getDay(): 0 Sun … 6 Sat — empty/null = all days */
export function parseWeekdaysJson(raw: unknown): number[] | undefined {
  if (raw == null || raw === '') return undefined;
  if (Array.isArray(raw)) {
    const n = raw.filter((x): x is number => typeof x === 'number' && x >= 0 && x <= 6);
    return n.length ? n : undefined;
  }
  if (typeof raw === 'string') {
    try {
      return parseWeekdaysJson(JSON.parse(raw));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function isWeekdayIncluded(weekdays: number[] | undefined, now: Date): boolean {
  if (!weekdays || weekdays.length === 0) return true;
  return weekdays.includes(now.getDay());
}
