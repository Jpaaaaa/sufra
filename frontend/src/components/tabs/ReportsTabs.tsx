'use client';

import { useTranslation } from 'react-i18next';
import { ChartIcon } from '../icons';
import { ReportPeriod } from '@/lib/reports/types';

interface ReportsTabsProps {
  activeTab: ReportPeriod;
  onTabChange: (tab: ReportPeriod) => void;
}

const TAB_KEYS: ReportPeriod[] = ['daily', 'weekly', 'monthly', 'yearly'];

export default function ReportsTabs({ activeTab, onTabChange }: ReportsTabsProps) {
  const { t } = useTranslation();
  const labelFor = (key: ReportPeriod) =>
    key === 'daily'
      ? t('reports.periodDaily')
      : key === 'weekly'
        ? t('reports.periodWeekly')
        : key === 'monthly'
          ? t('reports.periodMonthly')
          : t('reports.periodYearly');

  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-2 text-[15px] leading-normal font-medium text-obsidian">
        <span className="flex h-9 w-9 items-center justify-center rounded-soft-lg border border-cyber-aqua/20 bg-cyber-aqua/10 text-cyber-aqua">
          <ChartIcon className="h-4 w-4" />
        </span>
        <span className="font-medium">{t('reports.manageHeading')}</span>
      </div>
      <div className="inline-flex gap-1 rounded-full bg-cloud-soft-white p-1">
        {TAB_KEYS.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={`tab-button rounded-full px-4 py-2 text-[15px] leading-normal font-medium ${
                isActive
                  ? 'tab-button-active bg-cyber-aqua text-charcoal-graphite shadow-soft'
                  : 'text-obsidian/70 hover:bg-white hover:text-obsidian'
              }`}
            >
              {labelFor(tab)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
