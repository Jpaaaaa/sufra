import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import TabletZoomControls from './TabletZoomControls';

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const location = useLocation();

  const isLoginPage = location.pathname === '/login';
  const isMarketingPage = location.pathname === '/marketing';

  if (isLoginPage || isMarketingPage) {
    return <>{children}</>;
  }

  return (
    <main className="flex h-screen w-full overflow-hidden">
      {/* Sidebar - visible only on desktop (xl: 1280px+) */}
      <div className="hidden xl:block xl:flex-shrink-0">
        <Sidebar isOpen={true} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden bg-cloud-soft-white">
        <div className="flex-1 overflow-y-auto pb-24 xl:pb-0">
          {children}
        </div>

        {/* Bottom nav bar - visible only on mobile/tablet */}
        <BottomNav />
        <TabletZoomControls />
      </div>
    </main>
  );
}

