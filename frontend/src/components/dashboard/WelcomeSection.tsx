'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Wifi, WifiOff, Clock3 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getEmployeeDisplayName } from '../../lib/userDisplay';
import { APP_BRAND_NAME } from '../../lib/brand';
import type { Shift } from '../../contexts/ShiftContext';
import { getServerUrl, fetchJson } from '../../utils';
import { homeUi } from './home-ui';

function greetingKey(hour: number): 'welcomeMorning' | 'welcomeAfternoon' | 'welcomeEvening' {
  if (hour < 12) return 'welcomeMorning';
  if (hour < 17) return 'welcomeAfternoon';
  return 'welcomeEvening';
}

function formatClock(now: Date): { time: string; date: string } {
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const time = `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const date = `${days[now.getDay()]}, ${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
  return { time, date };
}

function WelcomeSection() {
  const { t } = useTranslation();
  const { user, token } = useAuth();
  const [restaurantName, setRestaurantName] = useState(APP_BRAND_NAME);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof window !== 'undefined' && window.sufra?.recipePrint?.getSettings) {
          const s = await window.sufra.recipePrint.getSettings();
          const name = s.restaurantName?.trim();
          if (!cancelled && name) setRestaurantName(name);
        }
      } catch {
        // keep brand fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadShift = async () => {
      if (!token) {
        if (!cancelled) setShiftOpen(false);
        return;
      }
      try {
        const shift = await fetchJson<Shift | null>(`${getServerUrl()}/shifts/active`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setShiftOpen(!!shift && shift.status === 'open');
      } catch {
        if (!cancelled) setShiftOpen(false);
      }
    };
    loadShift();
    const interval = window.setInterval(loadShift, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      try {
        await fetchJson(`${getServerUrl()}/health`);
        if (!cancelled) setOnline(true);
      } catch {
        if (!cancelled) setOnline(false);
      }
    };
    ping();
    const interval = window.setInterval(ping, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const displayName = useMemo(
    () => (user ? getEmployeeDisplayName(user.username) : '—'),
    [user],
  );
  const clock = formatClock(now);

  return (
    <section className={`${homeUi.surface} px-4 py-3.5 md:px-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-obsidian/45">
            {t(`home.${greetingKey(now.getHours())}`)}
          </p>
          <h2 className="mt-0.5 truncate text-[20px] font-semibold tracking-tight text-obsidian">
            {displayName}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-obsidian/55">
            <span className="inline-flex items-center gap-1.5 font-medium text-obsidian/70">
              <Building2 className="h-3.5 w-3.5 text-cyber-aqua" aria-hidden />
              {restaurantName}
            </span>
            <span className="hidden text-obsidian/20 sm:inline">|</span>
            <span>
              {t('home.welcomeBranch')} <span className="tabular-nums text-obsidian/40">—</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`${homeUi.chip} ${shiftOpen ? homeUi.chipOk : homeUi.chipMuted}`}>
            <Clock3 className="h-3 w-3" aria-hidden />
            {shiftOpen ? t('home.shiftOpen') : t('home.shiftClosed')}
          </span>
          <span className={`${homeUi.chip} ${online ? homeUi.chipOk : homeUi.chipDanger}`}>
            {online ? <Wifi className="h-3 w-3" aria-hidden /> : <WifiOff className="h-3 w-3" aria-hidden />}
            {online ? t('home.connectionOnline') : t('home.connectionOffline')}
          </span>
          <div className="ms-1 rounded-lg border border-black/5 bg-cloud-soft-white px-3 py-1.5 text-end">
            <div className="text-[15px] font-bold tabular-nums leading-none text-obsidian">{clock.time}</div>
            <div className="mt-0.5 text-[11px] font-medium text-obsidian/45">{clock.date}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(WelcomeSection);
