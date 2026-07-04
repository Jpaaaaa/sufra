'use client';

import { useTranslation } from 'react-i18next';
import { TableIcon, ChairIcon, UtensilsIcon, FloorIcon } from '../icons';

export type HallsTabKey = 'floors' | 'halls' | 'tables' | 'kitchens';

interface HallsTabsProps {
  activeTab: HallsTabKey;
  onTabChange: (tab: HallsTabKey) => void;
}

const tabs: {
  key: HallsTabKey;
  labelKey: string;
  icon?: React.ComponentType<{ className?: string }>;
}[] = [
  { key: 'floors', labelKey: 'halls.tabFloors', icon: FloorIcon },
  { key: 'halls', labelKey: 'halls.tabHalls', icon: ChairIcon },
  { key: 'tables', labelKey: 'halls.tabTables', icon: TableIcon },
  { key: 'kitchens', labelKey: 'halls.tabKitchens', icon: UtensilsIcon },
];

export default function HallsTabs({ activeTab, onTabChange }: HallsTabsProps) {
  const { t } = useTranslation();
  return (
    <nav className="mb-6 flex justify-center">
      <div className="inline-flex gap-2 rounded-soft-xl border border-black/5 bg-white p-1 shadow-soft">
        {tabs.map((tab) => {
          const Icon = tab.icon;
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


