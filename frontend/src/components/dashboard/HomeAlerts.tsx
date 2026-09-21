import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock3, Printer, Tag } from 'lucide-react';
import { homeUi } from './home-ui';
import type { HomeOverview } from './useHomeOverview';

function HomeAlerts({ overview }: { overview: HomeOverview }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { shiftOpen, live, agingTables, itemsWithoutPrice } = overview;

  const alerts = useMemo(() => {
    const list: { id: string; label: string; count: number; href: string; icon: typeof Printer }[] = [];
    if (!shiftOpen) {
      list.push({ id: 'shift', label: t('home.alertShiftClosed'), count: 1, href: '/settings/shift', icon: Clock3 });
    }
    if (live.printerStatus === 'error') {
      list.push({ id: 'printer', label: t('home.alertPrinter'), count: 1, href: '/settings', icon: Printer });
    }
    if (agingTables.length > 0) {
      list.push({
        id: 'aging',
        label: t('home.alertAgingTables'),
        count: agingTables.length,
        href: '/orders',
        icon: AlertTriangle,
      });
    }
    if (itemsWithoutPrice > 0) {
      list.push({
        id: 'price',
        label: t('home.alertNoPrice'),
        count: itemsWithoutPrice,
        href: '/items',
        icon: Tag,
      });
    }
    return list;
  }, [agingTables.length, itemsWithoutPrice, live.printerStatus, shiftOpen, t]);

  if (alerts.length === 0) return null;

  return (
    <section className={`${homeUi.surface} p-3`}>
      <h2 className={`${homeUi.sectionTitle} px-1 pb-3`}>{t('home.alertsTitle')}</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {alerts.map((alert) => {
          const Icon = alert.icon;
          return (
            <button
              key={alert.id}
              type="button"
              onClick={() => navigate(alert.href)}
              className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-start hover:bg-amber-50"
            >
              <span className="inline-flex min-w-0 items-center gap-2 text-[13px] font-medium text-obsidian">
                <Icon className="h-4 w-4 flex-shrink-0 text-amber-600" />
                <span className="truncate">{alert.label}</span>
              </span>
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-500 px-2 text-[12px] font-bold tabular-nums text-white">
                {alert.count}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default memo(HomeAlerts);
