import { BadRequestException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';
import {
  DEFAULT_BUSINESS_DAY_START,
  getCurrentBusinessDate,
  isValidHHmm,
} from '../../utils/business-date';

export const SHIFT_MODE_KEY = 'shift_mode';
export const BUSINESS_DAY_START_KEY = 'business_day_start_time';
/** @deprecated Use BUSINESS_DAY_START_KEY */
export const SHIFT_START_KEY = 'shift_start_time';
export const SHIFT_END_KEY = 'shift_end_time';

export type ShiftMode = 'single' | 'multi';

export interface ShiftConfig {
  shift_mode: ShiftMode;
  business_day_start_time: string;
  current_business_date: string;
}

/** Legacy shape for older clients */
export interface ShiftHoursSettings {
  shift_start_time: string;
  shift_end_time: string;
  current_business_date: string;
  shift_mode: ShiftMode;
  business_day_start_time: string;
}

class SettingsService {
  constructor(private readonly db: DatabaseService) {}

  async getSetting(key: string): Promise<string | null> {
    const row = await this.db.get('SELECT value FROM app_settings WHERE key = ?', [key]);
    return row?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db.run(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  }

  private async resolveBusinessDayStart(): Promise<string> {
    const direct = await this.getSetting(BUSINESS_DAY_START_KEY);
    if (direct) return direct;
    const legacy = await this.getSetting(SHIFT_START_KEY);
    return legacy || DEFAULT_BUSINESS_DAY_START;
  }

  async getShiftMode(): Promise<ShiftMode> {
    const mode = await this.getSetting(SHIFT_MODE_KEY);
    return mode === 'multi' ? 'multi' : 'single';
  }

  async getShiftConfig(): Promise<ShiftConfig> {
    const businessDayStart = await this.resolveBusinessDayStart();
    const shift_mode = await this.getShiftMode();
    return {
      shift_mode,
      business_day_start_time: businessDayStart,
      current_business_date: getCurrentBusinessDate(businessDayStart),
    };
  }

  async updateShiftConfig(data: {
    shift_mode: ShiftMode;
    business_day_start_time?: string;
  }): Promise<ShiftConfig> {
    if (data.shift_mode !== 'single' && data.shift_mode !== 'multi') {
      throw new BadRequestException('وضع الوردية غير صالح');
    }

    if (data.shift_mode === 'single') {
      const start = data.business_day_start_time?.trim();
      if (!start || !isValidHHmm(start)) {
        throw new BadRequestException('وقت بداية يوم العمل غير صالح (HH:mm)');
      }
      await this.setSetting(BUSINESS_DAY_START_KEY, start);
      await this.setSetting(SHIFT_START_KEY, start);
    }

    await this.setSetting(SHIFT_MODE_KEY, data.shift_mode);
    return this.getShiftConfig();
  }

  /** Legacy combined response */
  async getShiftHours(): Promise<ShiftHoursSettings> {
    const config = await this.getShiftConfig();
    const end = (await this.getSetting(SHIFT_END_KEY)) || '03:00';
    return {
      shift_mode: config.shift_mode,
      business_day_start_time: config.business_day_start_time,
      shift_start_time: config.business_day_start_time,
      shift_end_time: end,
      current_business_date: config.current_business_date,
    };
  }

  async updateShiftHours(data: {
    shift_mode?: ShiftMode;
    business_day_start_time?: string;
    shift_start_time?: string;
    shift_end_time?: string;
  }): Promise<ShiftHoursSettings> {
    const mode = data.shift_mode ?? (await this.getShiftMode());
    const dayStart = (data.business_day_start_time || data.shift_start_time)?.trim();

    if (mode === 'single') {
      await this.updateShiftConfig({
        shift_mode: 'single',
        business_day_start_time: dayStart,
      });
    } else {
      await this.setSetting(SHIFT_MODE_KEY, 'multi');
    }

    if (data.shift_end_time?.trim() && isValidHHmm(data.shift_end_time.trim())) {
      await this.setSetting(SHIFT_END_KEY, data.shift_end_time.trim());
    }

    return this.getShiftHours();
  }
}

let settingsInstance: SettingsService | null = null;

export function initializeSettings(db: DatabaseService): void {
  settingsInstance = new SettingsService(db);
}

function requireSettings(): SettingsService {
  if (!settingsInstance) {
    throw new Error('Settings not initialized');
  }
  return settingsInstance;
}

export function getShiftConfig(): ReturnType<SettingsService['getShiftConfig']> {
  return requireSettings().getShiftConfig();
}

export function updateShiftConfig(
  ...args: Parameters<SettingsService['updateShiftConfig']>
): ReturnType<SettingsService['updateShiftConfig']> {
  return requireSettings().updateShiftConfig(...args);
}

export function getShiftHours(): ReturnType<SettingsService['getShiftHours']> {
  return requireSettings().getShiftHours();
}

export function updateShiftHours(
  ...args: Parameters<SettingsService['updateShiftHours']>
): ReturnType<SettingsService['updateShiftHours']> {
  return requireSettings().updateShiftHours(...args);
}
