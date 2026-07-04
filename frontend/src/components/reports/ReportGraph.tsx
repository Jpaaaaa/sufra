'use client';

import { useTranslation } from 'react-i18next';
import { GraphDataPoint } from '@/lib/reports/types';
import { formatCurrency } from '@/lib/reports/utils';

interface ReportGraphProps {
  data: GraphDataPoint[] | Array<Record<string, unknown>>;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

function normalizeGraphData(
  raw: GraphDataPoint[] | Array<Record<string, unknown>> | null | undefined,
): GraphDataPoint[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map((d: GraphDataPoint | Record<string, unknown>) => {
    const r = d as Record<string, unknown>;
    const value = Number(
      (r.value as number) ?? (r.totalSales as number) ?? (r.sales as number) ?? 0,
    );
    const label =
      String(
        (r.label as string) ??
          (r.day as string) ??
          (r.week as string) ??
          (r.month as string) ??
          (r.date as string) ??
          '',
      ) || '—';
    return {
      label,
      value: Number.isFinite(value) ? value : 0,
      timestamp: (r.timestamp as string) ?? '',
    };
  });
}

export default function ReportGraph({ data, period }: ReportGraphProps) {
  const { t } = useTranslation();
  const normalized = normalizeGraphData(data);

  const granularityLabel =
    period === 'daily'
      ? t('reports.chartGranularityDaily')
      : period === 'weekly'
        ? t('reports.chartGranularityWeekly')
        : period === 'monthly'
          ? t('reports.chartGranularityMonthly')
          : t('reports.chartGranularityYearly');

  if (normalized.length === 0) {
    return (
      <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
        <div className="mb-4">
          <h3 className="text-[20px] leading-tight font-semibold text-obsidian">{t('reports.chartTitle')}</h3>
          <p className="text-[15px] leading-normal text-obsidian/60">{granularityLabel}</p>
        </div>
        <div className="flex h-[300px] items-center justify-center text-obsidian/60">{t('reports.noData')}</div>
      </div>
    );
  }

  const values = normalized.map((d) => d.value);
  const rawMax = Math.max(...values);
  const rawMin = Math.min(...values);
  const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
  const upperValue = rawMax;

  const minValue = Math.min(rawMin, avgValue, upperValue);
  const maxValue = Math.max(rawMax, avgValue, upperValue);
  const range = maxValue - minValue || 1;

  const width = 800;
  const height = 300;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const yForValue = (v: number) =>
    padding + chartHeight - ((v - minValue) / range) * chartHeight;

  const points = normalized.map((point, index) => {
    const x = padding + (normalized.length > 1 ? (index / (normalized.length - 1)) * chartWidth : chartWidth / 2);
    const numValue = Number.isFinite(point.value) ? point.value : 0;
    const y = yForValue(numValue);
    return { x: Number.isFinite(x) ? x : padding, y: Number.isFinite(y) ? y : padding + chartHeight, ...point };
  });

  const pathData = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const areaPath = points.length > 0
    ? `${pathData} L ${points[points.length - 1].x} ${padding + chartHeight} L ${points[0].x} ${padding + chartHeight} Z`
    : '';

  return (
    <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
      <div className="mb-4">
        <h3 className="text-[20px] leading-tight font-semibold text-obsidian">{t('reports.chartTitle')}</h3>
        <p className="text-[15px] leading-normal text-obsidian/60">{granularityLabel}</p>
      </div>

      <div className="relative overflow-x-auto">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding + chartHeight - ratio * chartHeight;
            const value = minValue + ratio * range;
            return (
              <g key={ratio}>
                <line
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeOpacity="0.1"
                />
                <text
                  x={padding - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="text-[13px] leading-relaxed fill-obsidian/50"
                  fontSize="10"
                >
                  {formatCurrency(value)}
                </text>
              </g>
            );
          })}

          <path
            d={areaPath}
            fill="url(#gradient)"
            fillOpacity="0.2"
          />

          <line
            x1={padding}
            y1={yForValue(avgValue)}
            x2={width - padding}
            y2={yForValue(avgValue)}
            stroke="#16a34a"
            strokeWidth="2"
            strokeDasharray="10 6"
            strokeLinecap="round"
          />
          <line
            x1={padding}
            y1={yForValue(upperValue)}
            x2={width - padding}
            y2={yForValue(upperValue)}
            stroke="#ea580c"
            strokeWidth="2"
            strokeDasharray="6 5"
            strokeLinecap="round"
          />

          <path
            d={pathData}
            fill="none"
            stroke="#A39E58"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((point, index) => (
            <g key={index}>
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill="#A39E58"
                stroke="white"
                strokeWidth="2"
              />
              {index % Math.ceil(normalized.length / 8) === 0 && (
                <text
                  x={point.x}
                  y={height - padding + 20}
                  textAnchor="middle"
                  className="text-[13px] leading-relaxed fill-obsidian/60"
                  fontSize="10"
                >
                  {point.label}
                </text>
              )}
            </g>
          ))}

          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#A39E58" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#A39E58" stopOpacity="0.05" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[15px] leading-normal">
        <div className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-6 rounded bg-[#A39E58]" aria-hidden />
          <span className="text-obsidian/70">{t('reports.chartLegendSales')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-6 rounded bg-[#16a34a]" aria-hidden />
          <span className="text-obsidian/70">{t('reports.chartLegendAverage')}</span>
          <span className="font-semibold text-obsidian">{formatCurrency(avgValue)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-6 rounded bg-[#ea580c]" aria-hidden />
          <span className="text-obsidian/70">{t('reports.chartLegendPeak')}</span>
          <span className="font-semibold text-obsidian">{formatCurrency(upperValue)}</span>
        </div>
        <div className="text-obsidian/50">
          {t('reports.chartRangeMinMax', { min: formatCurrency(rawMin), max: formatCurrency(rawMax) })}
        </div>
      </div>
    </div>
  );
}
