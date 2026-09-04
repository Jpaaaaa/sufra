import { useEffect, useState } from 'react';
import { Home, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/AuthContext';
import { APP_BRAND_NAME } from '../../../lib/brand';
import { getEmployeeDisplayName, roleLabelAr } from '../../../lib/userDisplay';
import { PosConnectionDot } from './PosConnectionDot';
import { PosSessionSheet } from './PosSessionSheet';
import { PosZoomControls } from './PosZoomControls';

const LOGO_SRC = `${import.meta.env.BASE_URL}logo/logo.png`;

export function PosTopBar({
  title,
  onBack,
  extra,
  showBrandText = true,
  sessionDetail = false,
  homeOpensSession = false,
}: {
  title: string;
  onBack: () => void;
  extra?: React.ReactNode;
  showBrandText?: boolean;
  sessionDetail?: boolean;
  homeOpensSession?: boolean;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [brandName, setBrandName] = useState(APP_BRAND_NAME);
  const [logoOk, setLogoOk] = useState(true);
  const [sessionOpen, setSessionOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await window.sufra?.recipePrint?.getSettings?.();
        const name = s?.restaurantName?.trim() ?? '';
        if (!cancelled) setBrandName(name || APP_BRAND_NAME);
      } catch {
        if (!cancelled) setBrandName(APP_BRAND_NAME);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = user ? getEmployeeDisplayName(user.username) : '';
  const role = user ? roleLabelAr(user.role) : '';
  const initial = displayName.trim().charAt(0) || '?';

  return (
    <header className="pos-topbar">
      <button
        type="button"
        className="pos-topbar-home"
        onClick={() => {
          onBack();
          if (homeOpensSession) setSessionOpen(true);
        }}
        aria-label={title}
      >
        <Home className="h-4 w-4" aria-hidden />
      </button>
      {showBrandText && logoOk && (
        <span className="pos-logo-mark">
          <img
            src={LOGO_SRC}
            alt={t('layout.logoAlt')}
            onError={() => setLogoOk(false)}
          />
        </span>
      )}
      {showBrandText && (
        <span className="pos-brand-text" title={brandName}>
          {brandName}
        </span>
      )}
      <div className="pos-topbar-title tabular-nums">{title}</div>
      {extra ? <div className="pos-topbar-search">{extra}</div> : null}
      <PosZoomControls />
      <button
        type="button"
        className="pos-topbar-home"
        onClick={() => window.location.reload()}
        aria-label={t('pos.reload')}
      >
        <RotateCw className="h-4 w-4" aria-hidden />
      </button>
      <PosConnectionDot />
      {user && (
        <button
          type="button"
          className="pos-session-chip"
          onClick={() => setSessionOpen(true)}
          aria-label={t('pos.session')}
        >
          <span className="pos-session-initial">{initial}</span>
          <span className={`pos-session-meta ${sessionDetail ? 'is-on' : ''}`}>
            <span className="truncate text-[13px] font-semibold leading-tight">{displayName}</span>
            <span className="truncate text-[13px] font-semibold leading-tight text-[color:var(--pos-aqua)]">
              {role}
            </span>
          </span>
        </button>
      )}
      <PosSessionSheet open={sessionOpen} onClose={() => setSessionOpen(false)} />
    </header>
  );
}
