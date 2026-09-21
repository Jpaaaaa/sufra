import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import SummaryCards from '../../components/dashboard/SummaryCards';
import HomeAdvertisementSlider from '../../components/dashboard/HomeAdvertisementSlider';
import OpenTablesNow from '../../components/dashboard/OpenTablesNow';
import RecentOrders from '../../components/dashboard/RecentOrders';
import QuickActionBar from '../../components/dashboard/QuickActionBar';
import SystemStatusAccordion from '../../components/dashboard/SystemStatusAccordion';
import InstallPWABox from '../../components/dashboard/InstallPWABox';
import NotificationPanel from '../../components/dashboard/NotificationPanel';
import HomePeriodBar from '../../components/dashboard/HomePeriodBar';
import FloorPulse from '../../components/dashboard/FloorPulse';
import HomeAlerts from '../../components/dashboard/HomeAlerts';
import HomeInsights from '../../components/dashboard/HomeInsights';
import { useHomeOverview } from '../../components/dashboard/useHomeOverview';
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
  const overview = useHomeOverview();

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
      <Header title={t('home.overviewTitle')} actions={<NotificationPanel />} />

      <main className="flex-1 py-4 md:py-5">
        <div className={`${homeUi.page} px-4 md:px-5 lg:px-6`}>
          <HomePeriodBar overview={overview} />
          <SummaryCards overview={overview} />
          <FloorPulse overview={overview} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <HomeAdvertisementSlider variant="card" />
            <QuickActionBar overview={overview} />
          </div>

          <HomeAlerts overview={overview} />
          <HomeInsights overview={overview} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <OpenTablesNow />
            <RecentOrders />
          </div>

          <SystemStatusAccordion />
          <InstallPWABox />
        </div>
      </main>

      <Footer />
    </div>
  );
}
