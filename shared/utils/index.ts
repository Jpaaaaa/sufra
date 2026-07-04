// Shared utility helpers can go here.

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ar-IQ', {
    style: 'currency',
    currency: 'IQD',
    maximumFractionDigits: 0
  }).format(value);
}


