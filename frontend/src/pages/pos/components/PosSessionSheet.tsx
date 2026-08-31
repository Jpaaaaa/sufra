import { useEffect, useMemo, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { showConfirm } from '../../../components/ui/ConfirmDialog';
import { LANGUAGE_OPTIONS, resolveAppLanguage } from '../../../components/i18n/LanguageSwitcher';
import { useAuth } from '../../../contexts/AuthContext';
import type { AppLanguage } from '../../../i18n';
import { resolveAppVersion } from '../../../lib/brand';
import { getEmployeeDisplayName, roleLabelAr } from '../../../lib/userDisplay';
import { PosSideSheet } from './PosSideSheet';

export function PosSessionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [version, setVersion] = useState('');
  const lang = useMemo(
    () => resolveAppLanguage(i18n.resolvedLanguage || i18n.language),
    [i18n.language, i18n.resolvedLanguage],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void resolveAppVersion().then((v) => {
      if (!cancelled) setVersion(v);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!user) return null;

  const displayName = getEmployeeDisplayName(user.username);
  const role = roleLabelAr(user.role);

  const onLogout = async () => {
    const ok = await showConfirm({
      title: t('layout.logout'),
      message: t('pos.logoutConfirm'),
      confirmText: t('layout.logout'),
      cancelText: t('pos.cancel'),
      confirmColor: 'danger',
    });
    if (!ok) return;
    logout();
  };

  return (
    <PosSideSheet
      open={open}
      title={t('pos.session')}
      onClose={onClose}
      footer={
        <button type="button" className="pos-logout-btn" onClick={() => void onLogout()}>
          <LogOut className="h-5 w-5" aria-hidden />
          {t('layout.logout')}
        </button>
      }
    >
      <div className="px-4 py-3">
        <div className="text-[16px] font-bold">{displayName}</div>
        <div className="mt-1 text-[13px] font-semibold text-[color:var(--pos-aqua)]">{role}</div>
        {version ? (
          <div className="mt-3 text-[13px] text-graphite tabular-nums">
            {t('pos.version')}: {version}
          </div>
        ) : null}
        <div className="pos-lang" role="group" aria-label={t('language')}>
          <div className="pos-lang-label">{t('language')}</div>
          <div className="pos-lang-row">
            {LANGUAGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`pos-lang-btn ${lang === opt.value ? 'is-active' : ''}`}
                aria-pressed={lang === opt.value}
                onClick={() => void i18n.changeLanguage(opt.value as AppLanguage)}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </PosSideSheet>
  );
}
