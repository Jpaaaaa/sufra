import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ClockIcon, ArchiveIcon } from '../icons';

type OrderStatusFilter = 'pending' | 'archived';

interface OrderStatusTabsProps {
  activeFilter: OrderStatusFilter;
  onFilterChange: (filter: OrderStatusFilter) => void;
  pendingCount: number;
  archivedCount: number;
}

interface TabConfig {
  key: OrderStatusFilter;
  labelKey: 'orders.filterPending' | 'orders.filterArchived';
  icon: React.ComponentType<{ className?: string }>;
  count: number;
}

export const OrderStatusTabs = memo(function OrderStatusTabs({
  activeFilter,
  onFilterChange,
  pendingCount,
  archivedCount,
}: OrderStatusTabsProps) {
  const { t } = useTranslation();
  const tabs: TabConfig[] = useMemo(
    () => [
      { key: 'pending', labelKey: 'orders.filterPending', icon: ClockIcon, count: pendingCount },
      { key: 'archived', labelKey: 'orders.filterArchived', icon: ArchiveIcon, count: archivedCount },
    ],
    [pendingCount, archivedCount],
  );

  return (
    <div className="mb-3 flex justify-center xl:mb-6">
      <div className="inline-flex w-full gap-1 overflow-x-auto rounded-soft-xl bg-cloud-soft-white p-1 shadow-soft scrollbar-hide xl:w-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === activeFilter;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onFilterChange(tab.key)}
              className={`
                flex min-h-11 flex-shrink-0 items-center gap-2 rounded-soft-lg px-3 py-2.5 text-[13px] leading-normal font-medium xl:px-4 xl:text-[14px]
                ${isActive
                  ? 'bg-white text-obsidian/80 shadow-soft'
                  : 'text-obsidian/60 hover:text-obsidian/80'
                }
              `}
            >
              <Icon
                className={`h-4 w-4 ${
                  isActive ? 'text-obsidian' : 'text-obsidian/50'
                }`}
              />
              <span>{t(tab.labelKey)}</span>
              {tab.count > 0 && (
                <span
                  className={`
                    ms-1 rounded-full px-1.5 py-0.5 text-[11px] leading-tight font-bold
                    ${isActive
                      ? 'bg-obsidian/10 text-obsidian'
                      : 'bg-obsidian/5 text-obsidian/50'
                    }
                  `}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
