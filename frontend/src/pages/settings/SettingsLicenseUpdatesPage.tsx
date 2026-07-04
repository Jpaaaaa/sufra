import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import SettingsTabs from '../../components/tabs/SettingsTabs';
import { useAuth } from '../../contexts/AuthContext';
import { settingsUi } from './settings-ui';
import { SettingsLicenseCard } from './components/SettingsLicenseCard';
import { SettingsUpdatesCard } from './components/SettingsUpdatesCard';

export default function SettingsLicenseUpdatesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'manager') {
      navigate('/settings/server', { replace: true });
    }
  }, [user, navigate]);

  const hasDesktopBridge = Boolean(window.amaan?.licenseGetStatus || window.amaan?.updateGetState);

  return (
    <div className="flex flex-1 flex-col bg-cloud-soft-white">
      <Header title={t('nav.settings')} />
      <main className="flex-1 p-6">
        <section className="mx-auto max-w-7xl">
          <SettingsTabs />

          <div className={`${settingsUi.pageBanner} mb-8 mt-6`}>
            <h1 className={settingsUi.pageBannerTitle}>{t('settings.licenseUpdatesPageTitle')}</h1>
            <p className={settingsUi.pageBannerLede}>{t('settings.licenseUpdatesPageLede')}</p>
          </div>

          {!hasDesktopBridge ? (
            <p className="mb-8 rounded-soft-lg border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-[15px] font-medium text-amber-950">
              {t('settings.licenseUpdatesDesktopHint')}
            </p>
          ) : null}

          <div className="flex flex-col gap-8">
            <SettingsLicenseCard />
            <SettingsUpdatesCard />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
