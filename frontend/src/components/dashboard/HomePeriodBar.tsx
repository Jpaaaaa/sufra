import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock3, Wifi, WifiOff } from 'lucide-react';
import { dateFormatLocale } from '../../lib/app-locale';
import { homeUi } from './home-ui';
import type { HomePeriodId } from './home-period';
import { parseIsoDate } from './home-period';
import type { HomeOverview } from './useHomeOverview';

const PERIODS: HomePeriodId[] = ['today', 'yesterday', 'week', 'month', 'custom'];

function formatUpdated(updatedAt: Date | null, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (!updatedAt) return t('home.lastUpdatedNever');
  const mins = Math.floor((Date.now() - updatedAt.getTime()) / 60000);
  if (mins < 1) return t('home.lastUpdatedJustNow');
  return t('home.lastUpdatedMins', { count: mins });
}

function HomePeriodBar({ overview }: { overview: HomeOverview }) {
  const { t, i18n } = useTranslation();
  const { period, customDate, setCustomDate, selectPeriod, range, updatedAt, shiftOpen, online } = overview;
  const locale = dateFormatLocale(i18n.language);
  const labelDate = parseIsoDate(range.to).toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => selectPeriod(id)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
              period === id
                ? 'bg-obsidian text-white shadow-soft'
                : 'bg-white text-obsidian/65 ring-1 ring-black/5 hover:bg-white hover:text-obsidian'
            }`}
          >
            {t(`home.period_${id}`)}
          </button>
        ))}
        {period === 'custom' ? (
          <input
            type="date"
            value={customDate || range.from}
            onChange={(e) => {
              setCustomDate(e.target.value);
              selectPeriod('custom');
            }}
            className="rounded-full border border-black/10 bg-white px-3 py-1 text-[12px] font-medium text-obsidian"
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className={`${homeUi.chip} ${shiftOpen ? homeUi.chipOk : homeUi.chipWarn}`}>
          <Clock3 className="h-3 w-3" aria-hidden />
          {shiftOpen ? t('home.shiftOpen') : t('home.shiftClosed')}
        </span>
        <span className={`${homeUi.chip} ${online ? homeUi.chipOk : homeUi.chipDanger}`}>
          {online ? <Wifi className="h-3 w-3" aria-hidden /> : <WifiOff className="h-3 w-3" aria-hidden />}
          {online ? t('home.connectionOnline') : t('home.connectionOffline')}
        </span>
        <span className="text-obsidian/50">
          {t('home.periodMeta', { date: labelDate })}
          <span className="mx-1.5 text-obsidian/25">·</span>
          {formatUpdated(updatedAt, t)}
        </span>
      </div>
    </section>
  );
}

export default memo(HomePeriodBar);
