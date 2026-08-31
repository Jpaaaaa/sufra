import { Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUiScale } from '../../../hooks/useUiScale';
import { UI_SCALE_MAX, UI_SCALE_MIN } from '../../../lib/uiScale';

export function PosZoomControls() {
  const { t } = useTranslation();
  const { scale, zoomIn, zoomOut } = useUiScale();
  const atMin = scale <= UI_SCALE_MIN + 0.001;
  const atMax = scale >= UI_SCALE_MAX - 0.001;

  return (
    <div className="pos-topbar-zoom" role="group" aria-label={t('layout.viewControls')}>
      <button type="button" onClick={zoomOut} disabled={atMin} aria-label={t('layout.zoomOut')}>
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <span className="pos-zoom-pct tabular-nums">{Math.round(scale * 100)}%</span>
      <button type="button" onClick={zoomIn} disabled={atMax} aria-label={t('layout.zoomIn')}>
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
