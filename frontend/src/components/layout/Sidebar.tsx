import { memo, useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';

import { navItems } from './navConfig';

import { getEmployeeDisplayName, roleLabelAr } from '../../lib/userDisplay';

import SidebarViewControls from './SidebarViewControls';



interface SidebarProps {

  isOpen?: boolean;

  onClose?: () => void;

}



function Sidebar({ isOpen = true }: SidebarProps) {

  const { t } = useTranslation();

  const location = useLocation();

  const pathname = location.pathname;

  const { user, logout } = useAuth();



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

      <div className="flex h-20 flex-shrink-0 items-center justify-center border-b border-black/5 px-4">

        <div className="text-center">

          <span className="block text-[16px] font-semibold leading-tight text-obsidian">Sufra</span>

          <span className="block text-[13px] font-normal leading-relaxed text-graphite">{t('loginTagline')}</span>

        </div>

      </div>



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

                        ? 'sidebar-item-active bg-cyber-aqua/15 font-semibold text-obsidian'

                        : 'font-medium text-obsidian/65 hover:text-obsidian'

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

      </div>



      {user && (

        <div className="flex-shrink-0 border-t border-black/5 px-4 py-3 space-y-2">

          <div className="rounded-soft-lg border border-black/5 bg-cloud-soft-white/80 px-3 py-2 backdrop-blur-sm">

            <p className="mb-1 text-xs font-medium text-obsidian/55">{t('layout.employeeLabel')}</p>

            <p className="text-sm font-semibold text-obsidian">{getEmployeeDisplayName(user.username)}</p>

            <p className="mt-1 text-xs text-cyber-aqua">{roleLabelAr(user.role)}</p>

          </div>

          <button

            type="button"

            onClick={logout}

            className="w-full rounded-soft-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"

          >

            {t('layout.logout')}

          </button>

        </div>

      )}



      <SidebarViewControls />

    </aside>

  );

}



export default memo(Sidebar);

