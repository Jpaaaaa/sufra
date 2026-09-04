import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { navGroups } from './navConfig';
import SidebarBrand from './SidebarBrand';
import SidebarSession from './SidebarSession';
import SidebarViewControls from './SidebarViewControls';

const RAIL_WIDTH = '4.5rem';
const FULL_WIDTH = '16.5rem';
const AUTO_COLLAPSE_MS = 4000;

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

function Sidebar({ isOpen = true }: SidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const pathname = location.pathname;
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const collapseTimer = useRef<number | null>(null);

  const clearCollapseTimer = useCallback(() => {
    if (collapseTimer.current != null) {
      window.clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
  }, []);

  const scheduleAutoCollapse = useCallback(() => {
    clearCollapseTimer();
    collapseTimer.current = window.setTimeout(() => {
      setExpanded(false);
      collapseTimer.current = null;
    }, AUTO_COLLAPSE_MS);
  }, [clearCollapseTimer]);

  const collapse = useCallback(() => {
    clearCollapseTimer();
    setExpanded(false);
  }, [clearCollapseTimer]);

  const expand = useCallback(() => {
    setExpanded(true);
    scheduleAutoCollapse();
  }, [scheduleAutoCollapse]);

  const toggleExpanded = useCallback(() => {
    if (expanded) {
      collapse();
    } else {
      expand();
    }
  }, [expanded, collapse, expand]);

  useEffect(() => {
    return () => clearCollapseTimer();
  }, [clearCollapseTimer]);

  useEffect(() => {
    collapse();
  }, [pathname, collapse]);

  const visibleGroups = useMemo(() => {
    if (!user) return [];
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.roles.includes(user.role)),
      }))
      .filter((group) => group.items.length > 0);
  }, [user]);

  const activeStates = useMemo(() => {
    const states: Record<string, boolean> = {};
    visibleGroups.forEach((group) => {
      group.items.forEach((item) => {
        states[item.href] =
          item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
      });
    });
    return states;
  }, [pathname, visibleGroups]);

  return (
    <aside
      className={`
        relative flex h-full flex-shrink-0 flex-col overflow-hidden
        border-s border-black/[0.06] bg-white
        ${isOpen ? 'translate-x-0' : 'translate-x-full xl:translate-x-0'}
      `}
      style={{
        width: expanded ? FULL_WIDTH : RAIL_WIDTH,
        transition: 'width 0.2s ease',
      }}
      aria-label={t('layout.sidebarLabel')}
      aria-expanded={expanded}
    >
      <SidebarBrand
        collapsed={!expanded}
        onBrandClick={toggleExpanded}
        toggle={
          <button
            type="button"
            onClick={toggleExpanded}
            title={expanded ? t('layout.unpinSidebar') : t('layout.pinSidebar')}
            aria-label={expanded ? t('layout.unpinSidebar') : t('layout.pinSidebar')}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-graphite hover:bg-black/[0.05] hover:text-obsidian"
          >
            {expanded ? (
              <PanelLeftClose className="h-4 w-4 rtl:rotate-180" aria-hidden />
            ) : (
              <PanelLeftOpen className="h-4 w-4 rtl:rotate-180" aria-hidden />
            )}
          </button>
        }
      />

      <div className="sidebar-nav-wrap min-h-0 flex-1">
        <nav
          className={`sidebar-nav-scroll h-full py-3 ${expanded ? 'px-2.5' : 'px-1.5'}`}
          aria-label={t('layout.navLabel')}
        >
          {visibleGroups.map((group, gi) => (
            <div key={group.id} className={gi > 0 ? 'mt-3' : ''}>
              {expanded && group.labelKey ? (
                <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-obsidian/35">
                  {t(group.labelKey)}
                </p>
              ) : gi > 0 ? (
                <div className="mx-2 mb-2 border-t border-black/[0.06]" />
              ) : null}

              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeStates[item.href];
                  const label = t(item.labelKey);

                  return (
                    <li key={item.href}>
                      <Link
                        to={item.href}
                        title={label}
                        className={`sidebar-item group relative flex items-center rounded-xl text-[13.5px] leading-snug ${
                          expanded ? 'gap-2.5 px-2 py-1.5' : 'justify-center px-1 py-1.5'
                        } ${
                          isActive
                            ? 'sidebar-item-active bg-cyber-aqua/12 font-semibold text-obsidian'
                            : 'font-medium text-graphite hover:bg-black/[0.04] hover:text-obsidian'
                        }`}
                      >
                        {isActive ? (
                          <span className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-cyber-aqua" />
                        ) : null}
                        <span
                          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                            isActive
                              ? 'bg-cyber-aqua text-white'
                              : 'bg-black/[0.035] text-obsidian/55 group-hover:bg-cyber-aqua/12 group-hover:text-obsidian/80'
                          }`}
                        >
                          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                        </span>
                        {expanded ? (
                          <span className="min-w-0 flex-1 truncate">{label}</span>
                        ) : (
                          <span className="sr-only">{label}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="flex-shrink-0 border-t border-black/[0.06]">
        <SidebarSession collapsed={!expanded} />
        <SidebarViewControls collapsed={!expanded} />
      </div>
    </aside>
  );
}

export default memo(Sidebar);
