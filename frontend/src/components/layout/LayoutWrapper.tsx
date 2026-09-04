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
    <main
      className="flex w-full overflow-hidden"
      style={{
        height: 'calc(100dvh / var(--sufra-ui-scale, 1))',
        maxHeight: 'calc(100dvh / var(--sufra-ui-scale, 1))',
      }}
    >
      {/* Sidebar - visible only on desktop (xl: 1280px+) */}
      <div className="hidden xl:block xl:flex-shrink-0">
        <Sidebar isOpen={true} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-cloud-soft-white">
        <div
          className={
            location.pathname.startsWith('/orders')
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
              : 'flex-1 overflow-y-auto pb-24 xl:pb-0'
          }
        >
          {children}
        </div>

        <BottomNav />
        {location.pathname.startsWith('/pos') ? null : <TabletZoomControls />}
      </div>
    </main>
  );
}

