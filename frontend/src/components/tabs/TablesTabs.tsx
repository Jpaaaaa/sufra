'use client';

import { useState } from 'react';
import { TableIcon } from '../icons';

type TablesTabKey = 'current' | 'history';

interface TablesTabsProps {
  initialTab?: TablesTabKey;
  onChange?: (tab: TablesTabKey) => void;
}

const tabs: { key: TablesTabKey; label: string }[] = [
  { key: 'current', label: 'الطاولات الحالية' },
  { key: 'history', label: 'سجل الجلسات' },
];

export default function TablesTabs({ initialTab = 'current', onChange }: TablesTabsProps) {
  const [activeTab, setActiveTab] = useState<TablesTabKey>(initialTab);

  const handleSelect = (key: TablesTabKey) => {
    setActiveTab(key);
    onChange?.(key);
  };

  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-2 text-[15px] leading-normal font-medium text-obsidian">
        <span className="flex h-9 w-9 items-center justify-center rounded-soft-lg border border-cyber-aqua/20 bg-cyber-aqua/10 text-cyber-aqua">
          <TableIcon className="h-4 w-4" />
        </span>
        <span className="font-medium">إدارة الطاولات</span>
      </div>
      <div className="inline-flex gap-1 rounded-full bg-cloud-soft-white p-1">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleSelect(tab.key)}
              className={`tab-button rounded-full px-4 py-2 text-[15px] leading-normal font-medium ${
                isActive
                  ? 'tab-button-active bg-cyber-aqua text-charcoal-graphite shadow-soft'
                  : 'text-obsidian/70 hover:bg-white hover:text-obsidian'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}


