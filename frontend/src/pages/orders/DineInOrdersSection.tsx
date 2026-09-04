import { useTranslation } from 'react-i18next';
import type { Hall } from '../../utils';
import { ordersSegBtn, ordersSegWrap } from './orders-floor-chrome';

interface DineInOrdersSectionProps {
  halls: Hall[];
  floors: { id: number; number: number; name: string }[];
  selectedHall: Hall | null;
  selectedFloorId: number | null;
  onSelectFloor: (floorId: number | null) => void;
  onHallClick: (hall: Hall) => void;
  loading: boolean;
  dineInSubtab: 'active' | 'archived';
  onSubtabChange: (tab: 'active' | 'archived') => void;
  children: React.ReactNode;
  archivedContent: React.ReactNode;
}

function hallLive(hall: Hall): boolean {
  return Boolean(hall.hasPendingOrders || hall.hasPrintedOrders);
}

export function DineInOrdersSection({
  halls,
  floors,
  selectedHall,
  selectedFloorId,
  onSelectFloor,
  onHallClick,
  loading,
  dineInSubtab,
  onSubtabChange,
  children,
  archivedContent,
}: DineInOrdersSectionProps) {
  const { t } = useTranslation();
  const hallsToShow =
    floors.length > 0 && selectedFloorId != null
      ? halls.filter((h) => h.floor_id === selectedFloorId)
      : halls;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="ow-toolbar">
        <div className={ordersSegWrap}>
          <button
            type="button"
            onClick={() => onSubtabChange('active')}
            className={ordersSegBtn(dineInSubtab === 'active')}
          >
            <span>{t('orders.dineInSubtabActive')}</span>
          </button>
          <button
            type="button"
            onClick={() => onSubtabChange('archived')}
            className={ordersSegBtn(dineInSubtab === 'archived')}
          >
            <span>{t('orders.dineInSubtabArchived')}</span>
          </button>
        </div>
        {dineInSubtab === 'active' && floors.length > 0 && (
          <div className={ordersSegWrap}>
            <button
              type="button"
              onClick={() => onSelectFloor(null)}
              className={ordersSegBtn(selectedFloorId === null)}
            >
              <span>{t('orders.floorAll')}</span>
            </button>
            {floors.map((floor) => (
              <button
                key={floor.id}
                type="button"
                onClick={() => onSelectFloor(floor.id)}
                className={ordersSegBtn(selectedFloorId === floor.id)}
              >
                <span>{floor.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {dineInSubtab === 'active' && (
        <>
          <div className="ow-chips" role="listbox" aria-label={t('orders.chooseHallTitle')}>
            {loading && halls.length === 0 ? (
              <span className="px-2 py-2 text-[13px] text-obsidian/60">{t('orders.loadingHalls')}</span>
            ) : halls.length === 0 ? (
              <span className="px-2 py-2 text-[13px] text-obsidian/60">{t('orders.noHallsYet')}</span>
            ) : hallsToShow.length === 0 ? (
              <span className="px-2 py-2 text-[13px] text-obsidian/60">{t('orders.noHallsOnThisFloor')}</span>
            ) : (
              hallsToShow.map((hall) => {
                const on = selectedHall?.id === hall.id;
                return (
                  <button
                    key={hall.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={`ow-chip ${on ? 'is-on' : ''}`}
                    onClick={() => onHallClick(hall)}
                  >
                    <span className="tabular-nums">{hall.number}</span>
                    <span className="max-w-[9rem] truncate">{hall.name}</span>
                    {hallLive(hall) && (
                      <span className="ow-dots" aria-hidden>
                        {hall.hasPendingOrders ? <span className="ow-dot is-wait" /> : null}
                        {hall.hasPrintedOrders ? <span className="ow-dot is-sent" /> : null}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
          {children}
        </>
      )}

      {dineInSubtab === 'archived' && (
        <div className="min-h-0 flex-1 overflow-auto">{archivedContent}</div>
      )}
    </div>
  );
}
