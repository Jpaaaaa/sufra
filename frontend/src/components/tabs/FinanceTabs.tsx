'use client';

import { useTranslation } from 'react-i18next';

export type FinanceTabKey = 'revenue' | 'expenses' | 'profit';

interface FinanceTabsProps {
  activeTab: FinanceTabKey;
  onTabChange: (tab: FinanceTabKey) => void;
}

const TAB_KEYS: FinanceTabKey[] = ['revenue', 'expenses', 'profit'];

export default function FinanceTabs({ activeTab, onTabChange }: FinanceTabsProps) {
  const { t } = useTranslation();

  const labelFor = (key: FinanceTabKey) =>
    key === 'revenue' ? t('finance.tabRevenue') : key === 'expenses' ? t('finance.tabExpenses') : t('finance.tabProfit');

  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-2 text-[15px] leading-normal font-medium text-obsidian">
        <span className="flex h-9 w-9 items-center justify-center rounded-soft-lg border border-cyber-aqua/20 bg-cyber-aqua/10 text-cyber-aqua">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 2L2 7L12 12L22 7L12 2Z"
            />
          </svg>
        </span>
        <span className="font-medium">{t('finance.manageHeading')}</span>
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
