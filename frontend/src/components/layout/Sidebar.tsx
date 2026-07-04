import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { navItems } from './navConfig';
import { getEmployeeDisplayName, roleLabelAr } from '../../lib/userDisplay';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

function Sidebar({ isOpen = true }: SidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const pathname = location.pathname;
  const { user, logout } = useAuth();

  // Filter nav items based on user role
  const visibleNavItems = useMemo(() => {
    if (!user) return [];
    return navItems.filter((item) => item.roles.includes(user.role));
  }, [user]);

  // Compute active states once using useMemo - only recalculates when pathname changes
  const activeStates = useMemo(() => {
    const states: Record<string, boolean> = {};
    visibleNavItems.forEach((item) => {
      states[item.href] =
        item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
    });
    return states;
  }, [pathname, visibleNavItems]);

  return (
    <aside
      className={`
        fixed lg:static
        top-0 right-0
        h-full w-64 flex flex-col flex-shrink-0 overflow-hidden border-l border-black/5 bg-white shadow-soft z-50
        ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        lg:translate-x-0
      `}
      style={{
        transition: 'transform 0.3s ease-in-out',
      }}
    >
      {/* Logo Section */}
      <div className="flex h-20 items-center justify-center border-b border-black/5 px-4">
        <div className="text-center">
          <span className="block text-[16px] leading-normal font-semibold text-obsidian leading-tight">Sufra</span>
          <span className="block text-[13px] leading-relaxed font-normal text-graphite leading-relaxed">{t('loginTagline')}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4">
        <ul className="space-y-2">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeStates[item.href];

            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={`sidebar-item group relative flex items-center gap-3 rounded-soft-lg px-3 py-3 text-[15px] leading-normal ${
                    isActive
                      ? 'sidebar-item-active bg-cyber-aqua/15 text-obsidian font-semibold'
                      : 'text-obsidian/65 font-medium hover:text-obsidian'
                  }`}
                  style={isActive ? { 
                    borderLeft: '3px solid #2EE7C9'
                  } : {
                    borderLeft: '3px solid transparent'
                  }}
                >
                  <span
                    className={`sidebar-icon flex h-9 w-9 items-center justify-center rounded-soft ${
                      isActive
                        ? 'text-cyber-aqua'
                        : 'text-obsidian/55 group-hover:text-obsidian'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="truncate">{t(item.labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Info */}
      {user && (
        <div className="border-t border-black/5 px-4 py-3 space-y-2">
          <div className="rounded-soft-lg bg-cloud-soft-white px-3 py-2 border border-black/5">
            <p className="text-xs font-medium text-obsidian/55 mb-1">{t('layout.employeeLabel')}</p>
            <p className="text-sm font-semibold text-obsidian">{getEmployeeDisplayName(user.username)}</p>
            <p className="text-xs text-cyber-aqua mt-1">{roleLabelAr(user.role)}</p>
          </div>
          <button
            onClick={logout}
            className="w-full rounded-soft-lg bg-red-50 hover:bg-red-100 px-3 py-2 text-sm font-medium text-red-700 border border-red-200"
          >
            {t('layout.logout')}
          </button>
        </div>
      )}
    </aside>
  );
}

export default memo(Sidebar);
