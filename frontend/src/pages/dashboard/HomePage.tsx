import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import HeaderStatus from '../../components/dashboard/HeaderStatus';
import SystemStatusCard from '../../components/dashboard/SystemStatusCard';
import SummaryCards from '../../components/dashboard/SummaryCards';
import OpenTablesNow from '../../components/dashboard/OpenTablesNow';
import RecentOrders from '../../components/dashboard/RecentOrders';
import QuickActionBar from '../../components/dashboard/QuickActionBar';
import InstallPWABox from '../../components/dashboard/InstallPWABox';
import NotificationPanel from '../../components/dashboard/NotificationPanel';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';

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

  // Redirect non-admin users to orders page (only admin can access home screen)
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/orders');
    }
  }, [user, navigate]);

  // Don't render dashboard for non-admin users
  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col bg-cloud-soft-white">
      <Header title={t('nav.home')} actions={<NotificationPanel />} />

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-7xl space-y-8">
          {/* Header Area */}
          <section>
            <HeaderStatus />
          </section>

          {/* Quick Action Bar */}
          <section>
            <QuickActionBar />
          </section>

          {/* Summary Cards */}
          <section>
            <SummaryCards />
          </section>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-8">
              {/* System Status Card */}
              <section>
                <SystemStatusCard />
              </section>

              {/* Open Tables Now */}
              <section>
                <OpenTablesNow />
              </section>
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              {/* Recent Orders */}
              <section>
                <RecentOrders />
              </section>
            </div>
          </div>

          {/* PWA Install Card (Tablet Only) */}
          <section>
            <InstallPWABox />
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
