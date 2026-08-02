export function formatReportDate(dateString: string | undefined): string {
  if (!dateString) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return `${String(day).padStart(2, '0')}/${month}/${year}`;
  }
  const dt = new Date(dateString);
  if (!isNaN(dt.getTime())) {
    return `${String(dt.getDate()).padStart(2, '0')}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
  }
  return dateString;
}

export function monthKeyFromRow(date: string, monthKey?: string): string {
  if (monthKey) return monthKey;
  return date.slice(0, 7);
}
