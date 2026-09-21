import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getEmployeeDisplayName, roleLabelAr } from '../../lib/userDisplay';
import RailHoverLabel from './RailHoverLabel';

function SidebarSession({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  if (!user) return null;

  const displayName = getEmployeeDisplayName(user.username);
  const initial = displayName.trim().charAt(0) || '?';

  return (
    <div
      className={`flex items-center py-2.5 ${
        collapsed ? 'flex-col gap-1.5 px-1' : 'gap-2 px-3'
      }`}
    >
      <RailHoverLabel label={displayName} enabled={collapsed}>
        <span
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cyber-aqua/15 text-[13px] font-semibold text-obsidian ring-1 ring-cyber-aqua/20"
          aria-hidden
        >
          {initial}
        </span>
      </RailHoverLabel>
      {!collapsed ? (
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-obsidian/80">{displayName}</p>
          <p className="truncate text-[11px] leading-tight text-cyber-aqua">{roleLabelAr(user.role)}</p>
        </div>
      ) : null}
      <RailHoverLabel label={t('layout.logout')} enabled>
        <button
          type="button"
          onClick={logout}
          aria-label={t('layout.logout')}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-soft-lg text-red-600 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </RailHoverLabel>
    </div>
  );
}

export default memo(SidebarSession);
