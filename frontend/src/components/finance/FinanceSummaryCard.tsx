'use client';

import { useTranslation } from 'react-i18next';
import { useOrderLocale } from '../../hooks/useOrderLocale';

interface FinanceSummaryCardProps {
  label: string;
  value: number;
  variant?: 'default' | 'positive' | 'negative';
  currency?: boolean;
}

export default function FinanceSummaryCard({
  label,
  value,
  variant = 'default',
  currency = true,
}: FinanceSummaryCardProps) {
  const { i18n } = useTranslation();
  const { numberLocale } = useOrderLocale();
  const listLocale = i18n.resolvedLanguage?.startsWith('en') ? 'en-US' : numberLocale;

  const formatValue = (val: number) => {
    if (currency) {
      return new Intl.NumberFormat(numberLocale, {
        style: 'currency',
        currency: 'IQD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(val);
    }
    return val.toLocaleString(listLocale);
  };

  const variantColors = {
    default: 'text-obsidian',
    positive: 'text-green-600',
    negative: 'text-red-600',
  };

  return (
    <div className="stats-card rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
      <div className="mb-2 text-[15px] leading-normal font-medium text-obsidian/60">{label}</div>
      <div className={`text-[24px] leading-tight font-bold ${variantColors[variant]}`}>
        {formatValue(value)}
      </div>
    </div>
  );
}

