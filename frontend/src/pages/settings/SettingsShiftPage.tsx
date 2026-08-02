import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import SettingsTabs from '../../components/tabs/SettingsTabs';
import { useAuth } from '../../contexts/AuthContext';
import { settingsUi } from './settings-ui';
import { SettingsShiftCard } from './components/SettingsShiftCard';

export default function SettingsShiftPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'manager') {
      navigate('/settings/server', { replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="flex flex-1 flex-col bg-cloud-soft-white">
      <Header title={t('nav.settings')} />
      <main className="flex-1 p-6">
        <section className="mx-auto max-w-7xl">
          <SettingsTabs />

          <div className={`${settingsUi.pageBanner} mb-8 mt-6`}>
            <h1 className={settingsUi.pageBannerTitle}>{t('settings.shiftPageTitle')}</h1>
            <p className={settingsUi.pageBannerLede}>{t('settings.shiftPageLede')}</p>
          </div>

          <SettingsShiftCard />
        </section>
      </main>
      <Footer />
    </div>
  );
}
