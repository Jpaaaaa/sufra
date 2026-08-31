import { useTranslation } from 'react-i18next';
import type { FloorOption } from '../../../hooks/useOrders';
import type { Hall } from '../../../utils';

export function PosHallRail({
  halls,
  floors,
  selectedHallId,
  selectedFloorId,
  onSelectHall,
  onSelectFloor,
}: {
  halls: Hall[];
  floors: FloorOption[];
  selectedHallId: number | null;
  selectedFloorId: number | null;
  onSelectHall: (hall: Hall) => void;
  onSelectFloor: (floorId: number | null) => void;
}) {
  const { t } = useTranslation();
  const visibleHalls =
    selectedFloorId == null ? halls : halls.filter((h) => h.floor_id === selectedFloorId);

  return (
    <nav className="pos-rail" aria-label={t('pos.halls')}>
      {floors.length > 1 && (
        <>
          <div className="pos-rail-label">{t('pos.floors')}</div>
          {floors.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`pos-hall-btn ${selectedFloorId === f.id ? 'is-active' : ''}`}
              onClick={() => onSelectFloor(f.id)}
            >
              <div className="text-[20px] font-bold leading-none tabular-nums">{f.number}</div>
              <div className="mt-1 truncate text-[13px]">
                {f.name?.trim() || t('pos.floorLevel', { number: f.number })}
              </div>
            </button>
          ))}
          <button
            type="button"
            className={`pos-hall-btn ${selectedFloorId == null ? 'is-active' : ''}`}
            onClick={() => onSelectFloor(null)}
          >
            <div className="truncate text-[13px] font-bold">{t('pos.allFloors')}</div>
          </button>
        </>
      )}
      <div className="pos-rail-label">{t('pos.halls')}</div>
      {visibleHalls.map((hall) => (
        <button
          key={hall.id}
          type="button"
          className={`pos-hall-btn ${selectedHallId === hall.id ? 'is-active' : ''}`}
          onClick={() => onSelectHall(hall)}
        >
          <div className="text-[20px] font-bold leading-none tabular-nums">{hall.number}</div>
          <div className="mt-1 truncate text-[13px]">{hall.name}</div>
          <div className="mt-1 flex gap-1">
            {hall.hasPendingOrders && (
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            )}
            {hall.hasPrintedOrders && (
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            )}
          </div>
        </button>
      ))}
    </nav>
  );
}
