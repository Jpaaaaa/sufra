'use client';

import { useTranslation } from 'react-i18next';

export type ShelvesTabKey = 'inventory' | 'sell';

interface ShelvesTabsProps {
  activeTab: ShelvesTabKey;
  onTabChange: (tab: ShelvesTabKey) => void;
}

const tabs: { key: ShelvesTabKey; labelKey: string }[] = [
  { key: 'inventory', labelKey: 'shelves.tabInventory' },
  { key: 'sell', labelKey: 'shelves.tabSell' },
];

export default function ShelvesTabs({ activeTab, onTabChange }: ShelvesTabsProps) {
  const { t } = useTranslation();
  return (
    <nav className="mb-6 flex justify-center">
      <div className="inline-flex gap-2 rounded-soft-xl border border-black/5 bg-white p-1 shadow-soft">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={`tab-button flex items-center gap-2 rounded-soft-lg px-5 py-3 text-[15px] leading-normal font-medium ${
                isActive
                  ? 'tab-button-active bg-cyber-aqua text-charcoal-graphite shadow-soft'
                  : 'text-obsidian/70 hover:bg-cloud-soft-white hover:text-obsidian'
              }`}
            >
              <span>{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

