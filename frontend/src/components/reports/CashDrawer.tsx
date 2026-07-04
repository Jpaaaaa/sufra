'use client';

import { useTranslation } from 'react-i18next';
import { CashDrawerData } from '@/lib/reports/types';
import { formatCurrency } from '@/lib/reports/utils';

interface CashDrawerProps {
  data: CashDrawerData;
}

export default function CashDrawer({ data }: CashDrawerProps) {
  const { t } = useTranslation();
  const isVariancePositive = data.variance >= 0;

  return (
    <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
      <div className="mb-4">
        <h3 className="text-[20px] leading-tight font-semibold text-obsidian">{t('reports.cashDrawerTitle')}</h3>
        <p className="text-[15px] leading-normal text-obsidian/60">{t('reports.cashDrawerSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-soft-lg border border-black/5 bg-cloud-soft-white/30 p-4">
          <p className="text-[15px] leading-normal font-medium text-obsidian/60 mb-1">{t('reports.cashOpeningBalance')}</p>
          <p className="text-[20px] leading-tight font-bold text-obsidian">{formatCurrency(data.openingBalance)}</p>
        </div>

        <div className="rounded-soft-lg border border-black/5 bg-emerald-50 p-4">
          <p className="text-[15px] leading-normal font-medium text-obsidian/60 mb-1">{t('reports.cashCashIn')}</p>
          <p className="text-[20px] leading-tight font-bold text-emerald-700">{formatCurrency(data.cashIn)}</p>
        </div>

        <div className="rounded-soft-lg border border-black/5 bg-red-50 p-4">
          <p className="text-[15px] leading-normal font-medium text-obsidian/60 mb-1">{t('reports.cashCashOut')}</p>
          <p className="text-[20px] leading-tight font-bold text-red-700">{formatCurrency(data.cashOut)}</p>
        </div>

        <div className="rounded-soft-lg border border-black/5 bg-graphite/5 p-4">
          <p className="text-[15px] leading-normal font-medium text-obsidian/60 mb-1">{t('reports.cashExpectedBalance')}</p>
          <p className="text-[20px] leading-tight font-bold text-obsidian">
            {formatCurrency(data.openingBalance + data.cashIn - data.cashOut)}
          </p>
        </div>

        <div className="rounded-soft-lg border border-black/5 bg-cyber-aqua/10 p-4">
          <p className="text-[15px] leading-normal font-medium text-obsidian/60 mb-1">{t('reports.cashActualBalance')}</p>
          <p className="text-[20px] leading-tight font-bold text-obsidian">{formatCurrency(data.closingBalance)}</p>
        </div>

        <div
          className={`rounded-soft-lg border p-4 ${
            isVariancePositive ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
          }`}
        >
          <p className="text-[15px] leading-normal font-medium text-obsidian/60 mb-1">{t('reports.cashVariance')}</p>
          <p
            className={`text-[20px] leading-tight font-bold ${
              isVariancePositive ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {isVariancePositive ? '+' : ''}
            {formatCurrency(data.variance)}
          </p>
          {data.variance !== 0 && (
            <p className="text-[13px] leading-relaxed text-obsidian/50 mt-1">
              {isVariancePositive ? t('reports.cashHintOver') : t('reports.cashHintUnder')}
            </p>
          )}
        </div>
      </div>

      {data.variance !== 0 && (
        <div
          className={`mt-4 rounded-soft-lg border p-3 ${
            isVariancePositive ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
          }`}
        >
          <p className="text-[15px] leading-normal font-medium text-obsidian">
            {isVariancePositive ? t('reports.cashAlertOver') : t('reports.cashAlertUnder')}
          </p>
        </div>
      )}
    </div>
  );
}
