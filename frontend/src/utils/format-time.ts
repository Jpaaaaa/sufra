/** "HH:MM" or "HH:MM:SS" (24h) → e.g. "9:44 AM" */
export function formatClockTimeAmPm(timeStr: string): string {
  const t = String(timeStr).trim();
  if (!t) return '—';
  const parts = t.split(':');
  const h = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  const secRaw = parts[2] ? parseInt(parts[2], 10) : 0;
  const sec = Number.isNaN(secRaw) ? 0 : secRaw;
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStr;
  const d = new Date(2000, 0, 1, h, m, sec);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** SQL/ISO datetime string → localized date + 12h time */
export function formatDateTimeAmPm(value: string): string {
  if (!value?.trim()) return '—';
  const normalized = value.trim().replace(' ', 'T');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
