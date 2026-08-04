import type { FinanceDailyRow } from './daily-rows';
import { formatCurrency, formatDate } from './utils';
import { APP_BRAND_NAME } from '../brand';

/** @deprecated Use APP_BRAND_NAME from lib/brand */
export const SUFRA_BRAND_NAME = APP_BRAND_NAME;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Build a printable HTML document for the General daily finance table. */
export function buildFinanceGeneralPdfHtml(opts: {
  brandName?: string;
  title: string;
  from: string;
  to: string;
  rows: FinanceDailyRow[];
  labels: {
    date: string;
    details: string;
    revenue: string;
    expenses: string;
    rowTotal: string;
    total: string;
    period: string;
  };
  numberLocale: string;
}): string {
  const brandName = opts.brandName || SUFRA_BRAND_NAME;
  const { title, from, to, rows, labels, numberLocale } = opts;
  const totals = rows.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenue,
      expenses: acc.expenses + row.expenses,
      total: acc.total + row.total,
    }),
    { revenue: 0, expenses: 0, total: 0 },
  );

  const bodyRows = rows
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(formatDate(row.date))}</td>
        <td>${escapeHtml(row.details)}</td>
        <td class="num">${escapeHtml(formatCurrency(row.revenue, numberLocale))}</td>
        <td class="num">${escapeHtml(formatCurrency(row.expenses, numberLocale))}</td>
        <td class="num ${row.total < 0 ? 'neg' : ''}">${escapeHtml(formatCurrency(row.total, numberLocale))}</td>
      </tr>`,
    )
    .join('');

  const docTitle = `${brandName} — ${title}`;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(docTitle)}</title>
  <style>
    body { font-family: Tahoma, Arial, sans-serif; color: #1a1a1a; padding: 24px; }
    .brand { font-size: 14px; font-weight: 700; color: #0d9488; margin: 0 0 4px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    .meta { font-size: 13px; color: #555; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: right; }
    th { background: #f1f5f9; font-weight: 700; }
    tfoot td { font-weight: 700; background: #f8fafc; }
    .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .neg { color: #dc2626; }
    .footer { margin-top: 24px; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <p class="brand">${escapeHtml(brandName)}</p>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">${escapeHtml(labels.period)}: ${escapeHtml(from)} — ${escapeHtml(to)}</p>
  <table>
    <thead>
      <tr>
        <th>${escapeHtml(labels.date)}</th>
        <th>${escapeHtml(labels.details)}</th>
        <th>${escapeHtml(labels.revenue)}</th>
        <th>${escapeHtml(labels.expenses)}</th>
        <th>${escapeHtml(labels.rowTotal)}</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
    <tfoot>
      <tr>
        <td>${escapeHtml(labels.total)}</td>
        <td>—</td>
        <td class="num">${escapeHtml(formatCurrency(totals.revenue, numberLocale))}</td>
        <td class="num">${escapeHtml(formatCurrency(totals.expenses, numberLocale))}</td>
        <td class="num ${totals.total < 0 ? 'neg' : ''}">${escapeHtml(formatCurrency(totals.total, numberLocale))}</td>
      </tr>
    </tfoot>
  </table>
  <p class="footer">${escapeHtml(brandName)}</p>
</body>
</html>`;
}

/** Open a print window so the user can save as PDF. */
export function printFinanceHtml(html: string): void {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!printWindow) {
    throw new Error('POPUP_BLOCKED');
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 300);
}
