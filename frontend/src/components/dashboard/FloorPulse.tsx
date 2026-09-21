import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Package, Truck } from 'lucide-react';
import { homeUi } from './home-ui';
import type { HomeOverview } from './useHomeOverview';

function FloorPulse({ overview }: { overview: HomeOverview }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { halls, pickupActive, deliveryActive, live } = overview;
  const total = live.occupiedTables + live.emptyTables;

  return (
    <section className={`${homeUi.surface} p-3`}>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h2 className={homeUi.sectionTitle}>{t('home.floorPulseTitle')}</h2>
        <span className={`${homeUi.chip} ${homeUi.chipMuted} tabular-nums`}>
          {t('home.summaryOccupiedHint', { occupied: live.occupiedTables, total })}
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {halls.length === 0 ? (
          <p className={`${homeUi.emptyTitle} px-2 py-4`}>{t('home.floorPulseEmpty')}</p>
        ) : (
          halls.map((hall) => {
            const pct = hall.total > 0 ? Math.round((hall.occupied / hall.total) * 100) : hall.occupied > 0 ? 100 : 0;
            return (
              <button
                key={hall.id}
                type="button"
                onClick={() => navigate('/pos/floor')}
                className="min-w-[140px] flex-1 rounded-xl bg-cloud-soft-white px-3 py-2.5 text-start hover:bg-[#EEF2FF]"
              >
                <p className="truncate text-[13px] font-semibold text-obsidian">{hall.name}</p>
                <p className="mt-1 text-[18px] font-bold tabular-nums text-obsidian">
                  {hall.occupied}
                  {hall.total > 0 ? (
                    <span className="text-[12px] font-medium text-obsidian/40"> / {hall.total}</span>
                  ) : null}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-cyber-aqua" style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })
        )}

        <button
          type="button"
          onClick={() => navigate('/orders')}
          className="min-w-[120px] rounded-xl bg-[#FFF4E5] px-3 py-2.5 text-start"
        >
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-800">
            <Package className="h-3.5 w-3.5" />
            {t('home.floorPickup')}
          </span>
          <p className="mt-1 text-[18px] font-bold tabular-nums text-obsidian">{pickupActive}</p>
        </button>
        <button
          type="button"
          onClick={() => navigate('/orders')}
          className="min-w-[120px] rounded-xl bg-[#E8F1FF] px-3 py-2.5 text-start"
        >
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-sky-800">
            <Truck className="h-3.5 w-3.5" />
            {t('home.floorDelivery')}
          </span>
          <p className="mt-1 text-[18px] font-bold tabular-nums text-obsidian">{deliveryActive}</p>
        </button>
      </div>
    </section>
  );
}

export default memo(FloorPulse);
