export type ShiftMode = 'single' | 'multi';

export interface ShiftHoursSettings {
  shift_mode: ShiftMode;
  business_day_start_time: string;
  shift_start_time: string;
  shift_end_time: string;
  current_business_date: string;
}

export interface ShiftDefinition {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  is_active: boolean;
}

export const SHIFT_PRESETS = [
  { id: 'overnight', start: '18:00', end: '03:00', labelKey: 'settings.shiftPresetOvernight' },
  { id: 'close3am', start: '03:00', end: '18:00', labelKey: 'settings.shiftPresetClose3am' },
  { id: 'day', start: '09:00', end: '23:00', labelKey: 'settings.shiftPresetDay' },
] as const;
