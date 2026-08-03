import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { useUiScale } from '../../hooks/useUiScale';

interface SidebarViewControlsProps {
  collapsed?: boolean;
}

function SidebarViewControls({ collapsed = false }: SidebarViewControlsProps) {
  const { t } = useTranslation();
  const { zoomIn, zoomOut } = useUiScale();

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  const controls = [
    {
      key: 'zoom-out',
      label: t('layout.zoomOut'),
      icon: ZoomOut,
      onClick: zoomOut,
    },
    {
      key: 'zoom-in',
      label: t('layout.zoomIn'),
      icon: ZoomIn,
      onClick: zoomIn,
    },
    {
      key: 'reload',
      label: t('layout.reload'),
      icon: RefreshCw,
      onClick: reload,
    },
  ] as const;

  return (
    <div
      role="group"
      aria-label={t('layout.viewControls')}
      className={`border-t border-black/5 px-3 py-2 ${collapsed ? 'space-y-1' : 'space-y-0.5'}`}
    >
      {controls.map(({ key, label, icon: Icon, onClick }) => (
        <button
          key={key}
          type="button"
          onClick={onClick}
          aria-label={label}
          title={label}
          className={`flex w-full items-center rounded-soft-lg text-sm font-medium text-obsidian/65 transition-colors hover:bg-cyber-aqua/10 hover:text-obsidian ${
            collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
          }`}
        >
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-soft text-obsidian/55">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          {!collapsed && <span className="truncate">{label}</span>}
        </button>
      ))}
    </div>
  );
}

export default memo(SidebarViewControls);
