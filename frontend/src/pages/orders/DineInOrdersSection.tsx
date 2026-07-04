import { useTranslation } from 'react-i18next';
import type { Hall } from '../../utils';
import { FLOOR_COLORS } from './constants';

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

  const renderHallButton = (hall: Hall, color: string, isSelected: boolean) => {
    const hasOrders = hall.hasPendingOrders || hall.hasPrintedOrders;
    return (
      <button
        key={hall.id}
        type="button"
        onClick={() => onHallClick(hall)}
        className={`group relative flex flex-col items-center justify-between rounded-xl border p-5 overflow-hidden aspect-square transition-shadow ${
          isSelected ? 'border-emerald-300 bg-emerald-50/50 hover:shadow-md' : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-md'
        }`}
        style={!isSelected ? { borderColor: `${color}50` } : undefined}
      >
        {hasOrders && (
          <div className="absolute top-3 right-3 flex gap-1.5 z-10">
            {hall.hasPendingOrders && <span className="w-2 h-2 rounded-full bg-amber-500" />}
            {hall.hasPrintedOrders && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
          </div>
        )}
        <div className="flex-1 flex items-center justify-center w-full">
          <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="max-w-[80px] max-h-[80px]">
            <rect x="22" y="28" width="56" height="52" rx="4" fill="#E8E6E3" stroke={isSelected ? '#047857' : color} strokeWidth="2" />
            <rect x="38" y="55" width="24" height="25" rx="2" fill="#D6D3D1" stroke={isSelected ? '#047857' : color} strokeWidth="1.5" />
          </svg>
        </div>
        <div className={`w-full rounded-lg px-3 py-2.5 mt-2 border border-stone-100 ${isSelected ? 'bg-emerald-100/80' : 'bg-stone-50'}`}>
          <p className={`text-center text-[15px] font-semibold truncate tabular-nums ${isSelected ? 'text-emerald-800' : 'text-stone-700'}`}>
            {hall.number} · {hall.name}
          </p>
          {hasOrders && (
            <p className="text-center text-[11px] font-medium text-stone-500 mt-0.5">
              {hall.hasPendingOrders && hall.hasPrintedOrders
                ? t('orders.hallStatusActive')
                : hall.hasPendingOrders
                  ? t('orders.hallStatusWaiting')
                  : t('orders.hallStatusPrinted')}
            </p>
          )}
        </div>
      </button>
    );
  };

  return (
    <>
      <div className="mb-6 flex justify-center">
        <div className="inline-flex gap-2 rounded-soft-xl border-2 border-cyber-aqua/30 bg-white p-1 shadow-soft">
          <button
            type="button"
            onClick={() => onSubtabChange('active')}
            className={`flex items-center gap-2 rounded-soft-lg px-6 py-3 text-[15px] leading-normal font-bold ${
              dineInSubtab === 'active' ? 'bg-cyber-aqua text-charcoal-graphite shadow-soft' : 'text-obsidian/70 hover:bg-cloud-soft-white hover:text-obsidian'
            }`}
          >
            <span>{t('orders.dineInSubtabActive')}</span>
          </button>
          <button
            type="button"
            onClick={() => onSubtabChange('archived')}
            className={`flex items-center gap-2 rounded-soft-lg px-6 py-3 text-[15px] leading-normal font-bold ${
              dineInSubtab === 'archived' ? 'bg-cyber-aqua text-charcoal-graphite shadow-soft' : 'text-obsidian/70 hover:bg-cloud-soft-white hover:text-obsidian'
            }`}
          >
            <span>{t('orders.dineInSubtabArchived')}</span>
          </button>
        </div>
      </div>

      {dineInSubtab === 'active' && floors.length > 0 && (
        <div className="mb-6 flex justify-center">
          <div className="inline-flex flex-wrap justify-center gap-2 rounded-soft-xl border-2 border-cyber-aqua/30 bg-white p-1 shadow-soft">
            <button
              type="button"
              onClick={() => onSelectFloor(null)}
              className={`flex items-center gap-2 rounded-soft-lg px-6 py-3 text-[15px] leading-normal font-bold ${
                selectedFloorId === null ? 'bg-cyber-aqua text-charcoal-graphite shadow-soft' : 'text-obsidian/70 hover:bg-cloud-soft-white hover:text-obsidian'
              }`}
            >
              <span>{t('orders.floorAll')}</span>
            </button>
            {floors.map((floor) => (
              <button
                key={floor.id}
                type="button"
                onClick={() => onSelectFloor(floor.id)}
                className={`flex items-center gap-2 rounded-soft-lg px-6 py-3 text-[15px] leading-normal font-bold ${
                  selectedFloorId === floor.id ? 'bg-cyber-aqua text-charcoal-graphite shadow-soft' : 'text-obsidian/70 hover:bg-cloud-soft-white hover:text-obsidian'
                }`}
              >
                <span>{floor.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {dineInSubtab === 'active' && (
        <>
          <div className="rounded-soft-xl border border-black/5 bg-cloud-soft-white p-6 shadow-soft">
            <h2 className="text-[20px] leading-tight font-semibold text-obsidian mb-4">{t('orders.chooseHallTitle')}</h2>
            {loading && halls.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-[15px] leading-normal font-light text-obsidian/60">{t('orders.loadingHalls')}</div>
            ) : halls.length === 0 ? (
              <div className="flex h-32 items-center justify-center rounded-soft-lg border border-dashed border-black/5 text-[15px] leading-normal font-light text-obsidian/60 bg-white/50">
                {t('orders.noHallsYet')}
              </div>
            ) : floors.length > 0 && selectedFloorId != null ? (
              hallsToShow.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-soft-lg border border-dashed border-black/5 text-[15px] leading-normal font-light text-obsidian/60 bg-white/50">
                  {t('orders.noHallsOnThisFloor')}
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {hallsToShow.map((hall) => {
                    const floor = floors.find((f) => f.id === hall.floor_id);
                    const floorIdx = floor ? floors.findIndex((f) => f.id === floor.id) : 0;
                    const color = FLOOR_COLORS[floorIdx % FLOOR_COLORS.length];
                    return renderHallButton(hall, color, selectedHall?.id === hall.id);
                  })}
                </div>
              )
            ) : floors.length > 0 && selectedFloorId === null ? (
              <div className="space-y-8">
                {floors.map((floor, floorIdx) => {
                  const hallsOnFloor = halls.filter((h) => h.floor_id === floor.id);
                  if (hallsOnFloor.length === 0) return null;
                  const color = FLOOR_COLORS[floorIdx % FLOOR_COLORS.length];
                  return (
                    <div key={floor.id}>
                      <div className="mb-3 flex items-center gap-2 rounded-soft-lg px-3 py-1.5 w-fit" style={{ backgroundColor: `${color}18` }}>
                        <span className="text-[28px] font-bold tabular-nums" style={{ color }}>{floor.number}</span>
                        <span className="text-[13px] text-obsidian/70">{floor.name}</span>
                      </div>
                      <div className="grid gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {hallsOnFloor.map((hall) => renderHallButton(hall, color, selectedHall?.id === hall.id))}
                      </div>
                    </div>
                  );
                })}
                {halls.filter((h) => h.floor_id == null).length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center gap-2 rounded-soft-lg px-3 py-1.5 w-fit bg-black/5">
                      <span className="text-[20px] font-bold text-obsidian/70">—</span>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {halls.filter((h) => h.floor_id == null).map((hall) => renderHallButton(hall, '#64748b', selectedHall?.id === hall.id))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {halls.map((hall) => renderHallButton(hall, '#64748b', selectedHall?.id === hall.id))}
              </div>
            )}
          </div>
          {children}
        </>
      )}

      {dineInSubtab === 'archived' && archivedContent}
    </>
  );
}
