'use client';

import { useTranslation } from 'react-i18next';
import { UtensilsIcon, GiftIcon, FinanceIcon } from '../icons';

export type ItemsTabKey = 'categories' | 'items' | 'fast-pricing';

interface ItemsTabsProps {
  activeTab: ItemsTabKey;
  onTabChange: (tab: ItemsTabKey) => void;
}

const tabs: { key: ItemsTabKey; labelKey: string; icon?: React.ComponentType<{ className?: string }> }[] = [
  { key: 'categories', labelKey: 'catalog.tabCategories', icon: GiftIcon },
  { key: 'items', labelKey: 'catalog.tabItems', icon: UtensilsIcon },
  { key: 'fast-pricing', labelKey: 'catalog.tabFastPricing', icon: FinanceIcon },
];

export default function ItemsTabs({ activeTab, onTabChange }: ItemsTabsProps) {
  const { t } = useTranslation();
  const handleSelect = (key: ItemsTabKey) => {
    onTabChange(key);
  };

  return (
    <nav className="mb-6 flex justify-center">
      <div className="inline-flex gap-2 rounded-soft-xl border border-black/5 bg-cloud-soft-white p-1 shadow-soft">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleSelect(tab.key)}
              className={`tab-button flex items-center gap-2 rounded-soft-lg px-5 py-3 text-[15px] leading-normal font-medium ${
                isActive
                  ? 'tab-button-active bg-cyber-aqua text-charcoal-graphite shadow-soft'
                  : 'text-obsidian/70 hover:bg-cloud-soft-white hover:text-obsidian'
              }`}
            >
              {Icon && (
                <span className={`flex h-6 w-6 items-center justify-center rounded-soft ${
                  isActive ? 'bg-white/20' : 'text-obsidian/60'
                }`}>
                  <Icon className="h-4 w-4" />
                </span>
              )}
              <span>{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}


