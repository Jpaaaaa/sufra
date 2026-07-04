'use client';

import { useTranslation } from 'react-i18next';
import { EmployeeSummary } from '@/lib/reports/types';
import { formatCurrency } from '@/lib/reports/utils';
import { useOrderLocale } from '../../hooks/useOrderLocale';

interface EmployeesBestReportSectionProps {
  employees: EmployeeSummary[];
}

export default function EmployeesBestReportSection({ employees }: EmployeesBestReportSectionProps) {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();

  if (!employees.length) {
    return (
      <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
        <h3 className="text-[20px] font-semibold leading-tight text-obsidian">{t('reports.employeesTitle')}</h3>
        <p className="mt-2 text-[15px] leading-normal text-obsidian/60">{t('reports.employeesEmpty')}</p>
      </div>
    );
  }

  const best = employees[0];

  return (
    <div className="space-y-4">
      <div className="rounded-soft-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white p-6 shadow-soft">
        <p className="text-[14px] font-medium text-amber-900/80">{t('reports.employeesBestCaption')}</p>
        <p className="mt-1 text-[22px] font-bold text-obsidian">{best.name}</p>
        <div className="mt-3 flex flex-wrap gap-4 text-[15px] text-obsidian/80">
          <span>
            {t('reports.empLabelTotalSales')}{' '}
            <strong className="text-obsidian">{formatCurrency(best.totalSales)}</strong>
          </span>
          <span>
            {t('reports.empLabelOrders')}{' '}
            <strong className="text-obsidian">{best.ordersHandled.toLocaleString(numberLocale)}</strong>
          </span>
          <span>
            {t('reports.empLabelAvgOrder')}{' '}
            <strong className="text-obsidian">{formatCurrency(best.avgOrderValue)}</strong>
          </span>
        </div>
      </div>

      <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
        <h3 className="mb-1 text-[20px] font-semibold leading-tight text-obsidian">{t('reports.employeesRankTitle')}</h3>
        <p className="mb-4 text-[14px] leading-normal text-obsidian/55">{t('reports.employeesRankHint')}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-right text-[14px]">
            <thead>
              <tr className="border-b border-black/10 text-[13px] text-obsidian/65">
                <th className="py-2 pl-2">{t('reports.empColRank')}</th>
                <th className="py-2">{t('reports.empColName')}</th>
                <th className="py-2">{t('reports.empColOrders')}</th>
                <th className="py-2">{t('reports.empColTotalSales')}</th>
                <th className="py-2">{t('reports.empColAvgOrder')}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, i) => (
                <tr
                  key={emp.id}
                  className={`border-b border-black/5 last:border-0 ${i === 0 ? 'bg-emerald-50/50' : ''}`}
                >
                  <td className="py-2.5 pl-2 font-semibold text-obsidian/70">{i + 1}</td>
                  <td className="py-2.5 font-medium text-obsidian">{emp.name}</td>
                  <td className="py-2.5 tabular-nums">{emp.ordersHandled.toLocaleString(numberLocale)}</td>
                  <td className="py-2.5 font-semibold tabular-nums text-obsidian">{formatCurrency(emp.totalSales)}</td>
                  <td className="py-2.5 tabular-nums text-obsidian/90">{formatCurrency(emp.avgOrderValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
