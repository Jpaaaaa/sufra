import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { useUiScale } from '../../hooks/useUiScale';
import RailHoverLabel from './RailHoverLabel';

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
      className={`flex items-center border-t border-black/5 ${
        collapsed ? 'flex-col gap-0.5 px-1 py-1.5' : 'justify-around px-2 py-1.5'
      }`}
    >
      {controls.map(({ key, label, icon: Icon, onClick }) => (
        <RailHoverLabel key={key} label={label} enabled>
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="flex h-8 w-8 items-center justify-center rounded-soft-lg text-graphite transition-colors hover:bg-cyber-aqua/10 hover:text-obsidian/80"
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        </RailHoverLabel>
      ))}
    </div>
  );
}

export default memo(SidebarViewControls);
