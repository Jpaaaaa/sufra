import { useCallback, useState } from 'react';
import { getUiScale, zoomInUiScale, zoomOutUiScale } from '../lib/uiScale';

export function useUiScale() {
  const [scale, setScale] = useState(getUiScale);

  const zoomIn = useCallback(() => {
    setScale(zoomInUiScale());
  }, []);

  const zoomOut = useCallback(() => {
    setScale(zoomOutUiScale());
  }, []);

  return { scale, zoomIn, zoomOut };
}
