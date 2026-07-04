import type { ReportPeriod } from '../../types/reports/export-pdf.dto';

export function formatCurrency(amount: number | null | undefined | string): string {
  try {
    if (amount === undefined || amount === null) return '0 د.ع';
    const num = Number(amount || 0);
    if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) return '0 د.ع';
    return new Intl.NumberFormat('ar-IQ', {
      style: 'currency',
      currency: 'IQD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return '0 د.ع';
  }
}

export function formatNumber(value: unknown): string {
  try {
    if (value === undefined || value === null) return '0';
    const num = Number(value || 0);
    if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) return '0';
    return num.toLocaleString('ar-IQ') || '0';
  } catch {
    return '0';
  }
}

export function getMovementLabel(status: string): string {
  const labels: Record<string, string> = {
    high: 'عالي',
    medium: 'متوسط',
    low: 'منخفض',
  };
  return labels[status] || status;
}

export function formatDate(date: Date, type: ReportPeriod): string {
  const formatNumericDate = (d: Date): string => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1);
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  if (type === 'daily') return formatNumericDate(date);
  if (type === 'weekly') {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `${formatNumericDate(weekStart)} - ${formatNumericDate(weekEnd)}`;
  }
  if (type === 'monthly') {
    return `${date.getMonth() + 1}/${date.getFullYear()}`;
  }
  return String(date.getFullYear());
}

export function getPeriodLabel(type: ReportPeriod): string {
  const labels: Record<ReportPeriod, string> = {
    daily: 'يومي',
    weekly: 'أسبوعي',
    monthly: 'شهري',
    yearly: 'سنوي',
  };
  return labels[type] || type;
}
