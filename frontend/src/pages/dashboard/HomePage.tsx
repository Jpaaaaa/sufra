import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import WelcomeSection from '../../components/dashboard/WelcomeSection';
import SummaryCards from '../../components/dashboard/SummaryCards';
import HomeAdvertisementSlider from '../../components/dashboard/HomeAdvertisementSlider';
import OpenTablesNow from '../../components/dashboard/OpenTablesNow';
import RecentOrders from '../../components/dashboard/RecentOrders';
import QuickActionBar from '../../components/dashboard/QuickActionBar';
import QuickInsights from '../../components/dashboard/QuickInsights';
import SystemStatusAccordion from '../../components/dashboard/SystemStatusAccordion';
import InstallPWABox from '../../components/dashboard/InstallPWABox';
import NotificationPanel from '../../components/dashboard/NotificationPanel';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { homeUi } from '../../components/dashboard/home-ui';

export default function HomePage() {
  return (
    <ProtectedRoute>
      <HomeDashboard />
    </ProtectedRoute>
  );
}

function HomeDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/orders');
    }
  }, [user, navigate]);

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col bg-cloud-soft-white">
      <Header title={t('nav.home')} actions={<NotificationPanel />} />

      <main className="flex-1 py-4 md:py-5">
        <div className={`${homeUi.page} px-4 md:px-5 lg:px-6`}>
          <WelcomeSection />
        </div>

        {/* Full-bleed ad band — directly after welcome */}
        <div className="mt-4 w-full">
          <HomeAdvertisementSlider />
        </div>

        <div className={`${homeUi.page} mt-4 px-4 md:px-5 lg:px-6`}>
          <SummaryCards />
          <QuickActionBar />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <OpenTablesNow />
            <RecentOrders />
          </div>

          <QuickInsights />
          <SystemStatusAccordion />
          <InstallPWABox />
        </div>
      </main>

      <Footer />
    </div>
  );
}
