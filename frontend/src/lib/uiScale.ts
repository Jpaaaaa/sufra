const STORAGE_KEY = 'sufra-ui-scale';
const LEGACY_STORAGE_KEY = 'sufra-page-zoom';

export const UI_SCALE_MIN = 0.75;
export const UI_SCALE_MAX = 1.5;
export const UI_SCALE_STEP = 0.1;
export const UI_SCALE_DEFAULT = 1;

function clampScale(value: number): number {
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, Math.round(value * 100) / 100));
}

function readStoredScale(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return UI_SCALE_DEFAULT;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? clampScale(parsed) : UI_SCALE_DEFAULT;
  } catch {
    return UI_SCALE_DEFAULT;
  }
}

export function applyUiScale(scale: number): number {
  const next = clampScale(scale);
  document.documentElement.style.fontSize = `${next * 100}%`;
  document.documentElement.style.zoom = '';
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // ignore quota / private mode
  }
  return next;
}

export function applyStoredUiScale(): number {
  return applyUiScale(readStoredScale());
}

export function getUiScale(): number {
  return readStoredScale();
}

export function zoomInUiScale(): number {
  return applyUiScale(readStoredScale() + UI_SCALE_STEP);
}

export function zoomOutUiScale(): number {
  return applyUiScale(readStoredScale() - UI_SCALE_STEP);
}
