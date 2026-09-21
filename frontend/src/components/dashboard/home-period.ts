import type { ReportPeriod } from '../../lib/reports/types';

export type HomePeriodId = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export function isoLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfDay(d = new Date()): Date {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function resolveHomePeriod(
  id: HomePeriodId,
  customDate?: string,
): {
  from: string;
  to: string;
  reportPeriod: ReportPeriod;
  reportDate: Date;
} {
  const today = startOfDay();

  if (id === 'yesterday') {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const iso = isoLocalDate(y);
    return { from: iso, to: iso, reportPeriod: 'daily', reportDate: y };
  }

  if (id === 'week') {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return {
      from: isoLocalDate(from),
      to: isoLocalDate(today),
      reportPeriod: 'weekly',
      reportDate: today,
    };
  }

  if (id === 'month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      from: isoLocalDate(from),
      to: isoLocalDate(today),
      reportPeriod: 'monthly',
      reportDate: today,
    };
  }

  if (id === 'custom' && customDate) {
    const d = parseIsoDate(customDate);
    return { from: customDate, to: customDate, reportPeriod: 'daily', reportDate: d };
  }

  const iso = isoLocalDate(today);
  return { from: iso, to: iso, reportPeriod: 'daily', reportDate: today };
}
