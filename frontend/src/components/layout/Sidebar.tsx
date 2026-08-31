import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { navItems } from './navConfig';
import SidebarBrand from './SidebarBrand';
import SidebarSession from './SidebarSession';
import SidebarViewControls from './SidebarViewControls';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

function Sidebar({ isOpen = true }: SidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const pathname = location.pathname;
  const { user } = useAuth();

  const visibleNavItems = useMemo(() => {
    if (!user) return [];
    return navItems.filter((item) => item.roles.includes(user.role));
  }, [user]);

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
        fixed xl:static
        top-0 right-0
        z-50 flex h-full w-64 flex-shrink-0 flex-col overflow-hidden
        border-l border-black/5 bg-white/70 shadow-soft backdrop-blur-xl
        ${isOpen ? 'translate-x-0' : 'translate-x-full xl:translate-x-0'}
        xl:translate-x-0
      `}
      aria-label={t('layout.sidebarLabel')}
      style={{ transition: 'transform 0.3s ease-in-out' }}
    >
      <SidebarBrand />

      <div className="sidebar-nav-wrap min-h-0 flex-1">
        <nav className="sidebar-nav-scroll h-full px-3 py-4" aria-label={t('layout.navLabel')}>
          <ul className="space-y-1.5">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeStates[item.href];

              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className={`sidebar-item group relative flex items-center gap-3 rounded-soft-lg px-3 py-2.5 text-[15px] leading-normal ${
                      isActive
                        ? 'sidebar-item-active bg-cyber-aqua/15 font-semibold text-obsidian/80'
                        : 'font-medium text-graphite hover:bg-cyber-aqua/8 hover:text-obsidian/80'
                    }`}
                    style={
                      isActive
                        ? { borderLeft: '3px solid #2EE7C9' }
                        : { borderLeft: '3px solid transparent' }
                    }
                  >
                    <span
                      className={`sidebar-icon flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-soft ${
                        isActive
                          ? 'text-cyber-aqua'
                          : 'text-graphite group-hover:text-obsidian/70'
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
      </div>

      <div className="flex-shrink-0 border-t border-black/5">
        <SidebarSession />
        <SidebarViewControls />
      </div>
    </aside>
  );
}

export default memo(Sidebar);
