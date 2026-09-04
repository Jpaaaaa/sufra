'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrderLocale } from '../../hooks/useOrderLocale';
import { formatCurrency, formatDate } from '../../lib/finance/utils';
import { buildFinanceDailyRows } from '../../lib/finance/daily-rows';
import type { Expense, Revenue } from '../../lib/finance/types';

interface FinancePageGeneralSectionProps {
  revenues: Revenue[];
  expenses: Expense[];
  onOpenExpenseForm: () => void;
  onExportPdf: () => void;
  isExportingPdf?: boolean;
}

export default function FinancePageGeneralSection({
  revenues,
  expenses,
  onOpenExpenseForm,
  onExportPdf,
  isExportingPdf = false,
}: FinancePageGeneralSectionProps) {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();

  const rows = useMemo(
    () => buildFinanceDailyRows(revenues, expenses, t),
    [revenues, expenses, t],
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          revenue: acc.revenue + row.revenue,
          expenses: acc.expenses + row.expenses,
          total: acc.total + row.total,
        }),
        { revenue: 0, expenses: 0, total: 0 },
      ),
    [rows],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-soft-xl border border-black/10 bg-white p-6 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[20px] leading-tight font-semibold text-obsidian">
            {t('finance.generalTableTitle')}
          </h3>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onOpenExpenseForm} className="btn-primary">
              {t('finance.addExpense')}
            </button>
            <button
              type="button"
              onClick={onExportPdf}
              disabled={isExportingPdf || rows.length === 0}
              className="rounded-soft-lg border border-cyber-aqua bg-white px-4 py-2 text-[15px] leading-normal font-medium text-cyber-aqua hover:bg-cyber-aqua/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExportingPdf ? t('finance.exportingPdf') : t('finance.savePdf')}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-black/10">
          <table className="w-full min-w-[640px] border-collapse text-right">
            <thead>
              <tr className="border-b border-black/10 bg-slate-100/90">
                <th className="px-4 py-3 text-[15px] font-bold text-obsidian">{t('finance.colDate')}</th>
                <th className="px-4 py-3 text-[15px] font-bold text-obsidian">{t('finance.colDetails')}</th>
                <th className="px-4 py-3 text-[15px] font-bold text-obsidian">{t('finance.colRevenue')}</th>
                <th className="px-4 py-3 text-[15px] font-bold text-obsidian">{t('finance.colExpenses')}</th>
                <th className="px-4 py-3 text-[15px] font-bold text-obsidian">{t('finance.colRowTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr
                    key={row.date}
                    className="border-b border-black/5 odd:bg-white even:bg-slate-50/80 hover:bg-cyber-aqua/5"
                  >
                    <td className="px-4 py-3 text-[15px] text-obsidian">{formatDate(row.date)}</td>
                    <td className="max-w-[280px] px-4 py-3 text-[14px] leading-relaxed break-words text-obsidian/75">
                      {row.details}
                    </td>
                    <td className="px-4 py-3 text-[15px] font-semibold tabular-nums text-obsidian">
                      {formatCurrency(row.revenue, numberLocale)}
                    </td>
                    <td className="px-4 py-3 text-[15px] tabular-nums text-obsidian">
                      {formatCurrency(row.expenses, numberLocale)}
                    </td>
                    <td
                      className={`px-4 py-3 text-[15px] font-semibold tabular-nums ${
                        row.total < 0 ? 'text-red-600' : 'text-obsidian'
                      }`}
                    >
                      {formatCurrency(row.total, numberLocale)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[15px] text-obsidian/60">
                    <div className="flex flex-col items-center gap-2">
                      <p>{t('finance.generalEmpty')}</p>
                      <p className="text-[13px] leading-relaxed text-obsidian/40">
                        {t('finance.generalEmptyHint')}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-black/15 bg-cloud-soft-white font-bold">
                  <td className="px-4 py-3 text-[15px] text-obsidian">{t('finance.totalRow')}</td>
                  <td className="px-4 py-3 text-[13px] font-normal text-obsidian/50">—</td>
                  <td className="px-4 py-3 text-[15px] tabular-nums text-obsidian">
                    {formatCurrency(totals.revenue, numberLocale)}
                  </td>
                  <td className="px-4 py-3 text-[15px] tabular-nums text-obsidian">
                    {formatCurrency(totals.expenses, numberLocale)}
                  </td>
                  <td
                    className={`px-4 py-3 text-[15px] tabular-nums ${
                      totals.total < 0 ? 'text-red-600' : 'text-obsidian'
                    }`}
                  >
                    {formatCurrency(totals.total, numberLocale)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
