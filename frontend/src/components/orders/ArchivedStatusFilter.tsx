import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export type ArchivedFilterValue = 'all' | 'completed' | 'cancelled';

interface ArchivedStatusFilterProps {
  activeFilter: ArchivedFilterValue;
  onFilterChange: (filter: ArchivedFilterValue) => void;
  completedCount: number;
  cancelledCount: number;
}

export const ArchivedStatusFilter = memo(function ArchivedStatusFilter({
  activeFilter,
  onFilterChange,
  completedCount,
  cancelledCount,
}: ArchivedStatusFilterProps) {
  const { t } = useTranslation();
  const keys = useMemo(() => (['all', 'completed', 'cancelled'] as const), []);

  return (
    <div className="mb-4 flex justify-center">
      <div className="inline-flex gap-1 rounded-soft-lg bg-white p-1 shadow-sm border border-black/5">
        {keys.map((key) => {
          const label =
            key === 'all'
              ? t('orders.archivedAll')
              : key === 'completed'
                ? t('orders.archivedCompleted')
                : t('orders.archivedCancelled');
          const count = key === 'all' ? completedCount + cancelledCount : key === 'completed' ? completedCount : cancelledCount;
          const isActive = activeFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onFilterChange(key)}
              className={`rounded-soft-md px-3 py-1.5 text-[13px] leading-normal font-medium ${
                isActive ? 'bg-cyber-aqua/20 text-cyber-aqua' : 'text-obsidian/60 hover:text-obsidian/80'
              }`}
            >
              {label}
              {count > 0 && (
                <span className="ms-1 rounded-full px-1.5 py-0.5 text-[11px] font-bold bg-obsidian/10">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
