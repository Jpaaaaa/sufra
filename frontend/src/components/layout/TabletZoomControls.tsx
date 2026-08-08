import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Plus, RefreshCw } from 'lucide-react';
import { useUiScale } from '../../hooks/useUiScale';
import { UI_SCALE_MAX, UI_SCALE_MIN } from '../../lib/uiScale';

/**
 * Calculator-style zoom controls for tablet/mobile (bottom-nav layout).
 * Desktop already has zoom in the sidebar.
 */
function TabletZoomControls() {
  const { t } = useTranslation();
  const { scale, zoomIn, zoomOut } = useUiScale();

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  const pct = Math.round(scale * 100);
  const atMin = scale <= UI_SCALE_MIN + 0.001;
  const atMax = scale >= UI_SCALE_MAX - 0.001;

  return (
    <div
      role="group"
      aria-label={t('layout.viewControls')}
      className="xl:hidden fixed z-[60] flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_8px_28px_rgba(0,0,0,0.14)]"
      style={{
        left: 'max(0.75rem, env(safe-area-inset-left))',
        bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <button
        type="button"
        onClick={zoomIn}
        disabled={atMax}
        aria-label={t('layout.zoomIn')}
        title={t('layout.zoomIn')}
        className="flex h-11 w-11 items-center justify-center text-obsidian transition-colors hover:bg-cyber-aqua/10 active:bg-cyber-aqua/15 disabled:opacity-35"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
      </button>

      <div
        className="border-y border-black/8 px-1 py-1.5 text-center text-[11px] font-bold tabular-nums text-obsidian/70"
        aria-live="polite"
      >
        {pct}%
      </div>

      <button
        type="button"
        onClick={zoomOut}
        disabled={atMin}
        aria-label={t('layout.zoomOut')}
        title={t('layout.zoomOut')}
        className="flex h-11 w-11 items-center justify-center text-obsidian transition-colors hover:bg-cyber-aqua/10 active:bg-cyber-aqua/15 disabled:opacity-35"
      >
        <Minus className="h-5 w-5" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={reload}
        aria-label={t('layout.reload')}
        title={t('layout.reload')}
        className="flex h-10 w-11 items-center justify-center border-t border-black/8 text-obsidian/55 transition-colors hover:bg-black/[0.04] active:bg-black/[0.06]"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export default memo(TabletZoomControls);
