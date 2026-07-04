'use client';

import { useTranslation } from 'react-i18next';
import { useOrderLocale } from '../../hooks/useOrderLocale';

interface ChartDataPoint {
  label: string;
  value: number;
  timestamp?: string;
}

interface FinanceLineChartProps {
  data: ChartDataPoint[];
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  title?: string;
}

export default function FinanceLineChart({ data, title: titleProp }: FinanceLineChartProps) {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();
  const title = titleProp ?? t('finance.chartDefaultTitle');

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-soft-xl border border-black/5 bg-white">
        <p className="text-[15px] leading-normal text-obsidian/60">{t('finance.lineChartNoData')}</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 0);
  const minValue = Math.min(...data.map((d) => d.value), 0);
  const range = maxValue - minValue || 1;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(numberLocale, {
      style: 'currency',
      currency: 'IQD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
      {title && (
        <h3 className="text-[20px] leading-tight font-semibold text-obsidian">{title}</h3>
      )}
      <div className="relative h-64 w-full">
        <svg className="h-full w-full" viewBox={`0 0 ${data.length * 100} 200`}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1="0"
              y1={200 * ratio}
              x2={data.length * 100}
              y2={200 * ratio}
              stroke="#E0E0E0"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          ))}

          {/* Chart line */}
          <polyline
            points={data
              .map(
                (d, i) =>
                  `${i * 100 + 50},${200 - ((d.value - minValue) / range) * 180 - 10}`,
              )
              .join(' ')}
            fill="none"
            stroke="#A39E58"
            strokeWidth="3"
          />

          {/* Data points */}
          {data.map((d, i) => {
            const y = 200 - ((d.value - minValue) / range) * 180 - 10;
            return (
              <circle
                key={i}
                cx={i * 100 + 50}
                cy={y}
                r="4"
                fill="#A39E58"
                stroke="white"
                strokeWidth="2"
              />
            );
          })}

          {/* Labels */}
          {data.map((d, i) => {
            const y = 200 - ((d.value - minValue) / range) * 180 - 10;
            return (
              <text
                key={i}
                x={i * 100 + 50}
                y={y - 10}
                textAnchor="middle"
                className="fill-obsidian text-[13px] leading-relaxed font-medium"
                fontSize="10"
              >
                {formatCurrency(d.value)}
              </text>
            );
          })}
        </svg>

        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-4 pt-2">
          {data.map((d, i) => (
            <span
              key={i}
              className="text-[13px] leading-relaxed text-obsidian/60"
              style={{ flex: 1, textAlign: 'center' }}
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

