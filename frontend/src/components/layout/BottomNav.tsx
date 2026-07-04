import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { navItems } from './navConfig';

function BottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const pathname = location.pathname;
  const { user } = useAuth();

  const visibleNavItems = useMemo(() => {
    if (!user) return [];
    return navItems.filter((item) => item.roles.includes(user.role));
  }, [user]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <nav
      className="xl:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-1 border-t border-black/5 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-2 safe-area-pb"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex w-full max-w-2xl items-center justify-around gap-1 overflow-x-auto overflow-y-hidden scrollbar-hide">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-3 py-2 transition-colors ${
                active
                  ? 'bg-cyber-aqua/15 text-cyber-aqua'
                  : 'text-obsidian/60 hover:bg-cloud-soft-white hover:text-obsidian'
              }`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-[10px] font-medium leading-tight truncate max-w-[4rem]">
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default memo(BottomNav);
