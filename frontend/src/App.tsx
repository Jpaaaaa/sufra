import { useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ToastContainer } from './components/ui/Toast';
import { ConfirmDialogContainer } from './components/ui/ConfirmDialog';
import { AlertDialogContainer } from './components/ui/AlertDialog';
import PasswordDialog from './components/ui/PasswordDialog';
import { AuthProvider } from './contexts/AuthContext';
import { GlobalNumericKeypadProvider } from './contexts/GlobalNumericKeypadContext';
import { BarcodeListenerProvider } from './contexts/BarcodeListenerContext';
import { ShelvesRefreshProvider } from './contexts/ShelvesRefreshContext';
import { GlobalShelfSaleModalContainer } from './components/shelves/GlobalShelfSaleModal';
import { BarcodeSaleHandler } from './components/shelves/BarcodeSaleHandler';
import LayoutWrapper from './components/layout/LayoutWrapper';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { RequireRole } from './components/auth/RequireRole';
import { LicenseRouteGuard } from './license/LicenseRouteGuard';

const PosLayout = lazy(() => import('./pages/pos/PosLayout'));
const PosFloorPage = lazy(() => import('./pages/pos/PosFloorPage'));
const PosTablePage = lazy(() => import('./pages/pos/PosTablePage'));

// Lazy-loaded pages for smaller initial bundle (better for low-end devices)
const LicenseActivationPage = lazy(() => import('./license/LicenseActivationPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const HomePage = lazy(() => import('./pages/dashboard/HomePage'));
const OrdersPage = lazy(() => import('./pages/orders/OrdersPage'));
const TablesPage = lazy(() => import('./pages/tables/TablesPage'));
const HallsPage = lazy(() => import('./pages/halls/HallsPage'));
const ItemsPage = lazy(() => import('./pages/items/ItemsPage'));
const OffersPage = lazy(() => import('./pages/offers/OffersPage'));
const ShelvesPage = lazy(() => import('./pages/shelves/ShelvesPage'));
const FinancePage = lazy(() => import('./pages/finance/FinancePage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const SettingsUsersPage = lazy(() => import('./pages/settings/SettingsUsersPage'));
const SettingsServerPage = lazy(() => import('./pages/settings/SettingsServerPage'));
const SettingsRecipePrintPage = lazy(() => import('./pages/settings/SettingsRecipePrintPage'));
const SettingsLicenseUpdatesPage = lazy(() => import('./pages/settings/SettingsLicenseUpdatesPage'));
const SettingsShiftPage = lazy(() => import('./pages/settings/SettingsShiftPage'));
const SettingsBackupPage = lazy(() => import('./pages/settings/SettingsBackupPage'));
const RecipesPage = lazy(() => import('./pages/recipes/RecipesPage'));
const DiningPage = lazy(() => import('./pages/dining/DiningPage'));

const PageLoader = () => (
  <div className="flex min-h-[200px] items-center justify-center" aria-hidden="true">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyber-aqua border-t-transparent" />
  </div>
);

function App() {
  /* Tablet viewport + orientation - vertical (portrait) vs horizontal (landscape) */
  useEffect(() => {
    const updateTabletClass = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isTablet = w >= 768 && w < 1280;
      const isPortrait = h > w;
      document.documentElement.classList.toggle('tablet-viewport', isTablet);
      document.documentElement.classList.toggle('tablet-portrait', isTablet && isPortrait);
    };
    updateTabletClass();
    window.addEventListener('resize', updateTabletClass);
    window.addEventListener('orientationchange', updateTabletClass);
    return () => {
      window.removeEventListener('resize', updateTabletClass);
      window.removeEventListener('orientationchange', updateTabletClass);
    };
  }, []);

  return (
    <AuthProvider>
      <GlobalNumericKeypadProvider>
      <ShelvesRefreshProvider>
            <BarcodeListenerProvider>
            <HashRouter future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}>
              <ToastContainer />
              <ConfirmDialogContainer />
              <AlertDialogContainer />
              <PasswordDialog />
              <GlobalShelfSaleModalContainer />
              <BarcodeSaleHandler />
            
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/license" element={<LicenseActivationPage />} />
                <Route element={<LicenseRouteGuard />}>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/setup/server" element={<SettingsServerPage />} />

                  <Route
                    element={
                      <ProtectedRoute>
                        <RequireRole allow={['waiter', 'cashier', 'manager', 'admin']}>
                          <PosLayout />
                        </RequireRole>
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/pos" element={<Navigate to="/pos/floor" replace />} />
                    <Route path="/pos/floor" element={<PosFloorPage />} />
                    <Route path="/pos/table/:hallId/:tableId" element={<PosTablePage />} />
                  </Route>

                  <Route
                    element={
                      <ProtectedRoute>
                        <LayoutWrapper>
                          <Outlet />
                        </LayoutWrapper>
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/" element={<HomePage />} />
                    <Route path="/orders" element={<OrdersPage />} />
                    <Route path="/tables" element={<TablesPage />} />
                    <Route path="/halls" element={<HallsPage />} />
                    <Route path="/items" element={<ItemsPage />} />
                    <Route path="/offers" element={<OffersPage />} />
                    <Route path="/shelves" element={<ShelvesPage />} />
                    <Route path="/finance" element={<FinancePage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/settings/users" element={<SettingsUsersPage />} />
                    <Route path="/settings/server" element={<SettingsServerPage />} />
                    <Route path="/settings/activity-log" element={<Navigate to="/settings" replace />} />
                    <Route path="/settings/recipe-print" element={<SettingsRecipePrintPage />} />
                    <Route path="/settings/license-updates" element={<SettingsLicenseUpdatesPage />} />
                    <Route path="/settings/shift" element={<SettingsShiftPage />} />
                    <Route path="/settings/backup" element={<SettingsBackupPage />} />
                    <Route path="/marketing" element={<Navigate to="/" replace />} />
                    <Route path="/recipes" element={<RecipesPage />} />
                    <Route path="/dining" element={<DiningPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Route>
              </Routes>
            </Suspense>
            </HashRouter>
            </BarcodeListenerProvider>
          </ShelvesRefreshProvider>
      </GlobalNumericKeypadProvider>
      </AuthProvider>
  );
}

export default App;
