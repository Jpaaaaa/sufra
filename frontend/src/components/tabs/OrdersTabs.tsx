'use client';

import { useState } from 'react';
import { ClipboardIcon } from '../icons';

type OrdersTabKey = 'active' | 'completed' | 'cancelled';

interface OrdersTabsProps {
  initialTab?: OrdersTabKey;
  onChange?: (tab: OrdersTabKey) => void;
}

const tabs: { key: OrdersTabKey; label: string }[] = [
  { key: 'active', label: 'الطلبات الحالية' },
  { key: 'completed', label: 'الطلبات المنتهية' },
  { key: 'cancelled', label: 'الطلبات الملغاة' },
];

export default function OrdersTabs({ initialTab = 'active', onChange }: OrdersTabsProps) {
  const [activeTab, setActiveTab] = useState<OrdersTabKey>(initialTab);

  const handleSelect = (key: OrdersTabKey) => {
    setActiveTab(key);
    onChange?.(key);
  };

  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-2 text-[15px] leading-normal font-medium text-obsidian">
        <span className="flex h-9 w-9 items-center justify-center rounded-soft-lg border border-cyber-aqua/20 bg-cyber-aqua/10 text-cyber-aqua">
          <ClipboardIcon className="h-4 w-4" />
        </span>
        <span className="font-medium">إدارة الطلبات</span>
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


