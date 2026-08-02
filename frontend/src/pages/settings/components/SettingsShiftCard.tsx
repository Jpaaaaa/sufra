import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getServerUrl, fetchJson } from '../../../utils';
import { showToast } from '../../../components/ui/Toast';
import { settingsUi } from '../settings-ui';
import type { ShiftDefinition, ShiftHoursSettings, ShiftMode } from '../settings-shift-types';
import { SHIFT_PRESETS } from '../settings-shift-types';
import {
  SettingsShiftDefinitionsEditor,
  type SettingsShiftDefinitionsEditorHandle,
} from './SettingsShiftDefinitionsEditor';

export function SettingsShiftCard() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<ShiftMode>('single');
  const [dayStart, setDayStart] = useState('03:00');
  const [currentBusinessDate, setCurrentBusinessDate] = useState('');
  const [definitions, setDefinitions] = useState<ShiftDefinition[]>([]);
  const shiftEditorRef = useRef<SettingsShiftDefinitionsEditorHandle>(null);

  const load = async () => {
    try {
      setLoading(true);
      const serverUrl = getServerUrl();
      const [hours, defs] = await Promise.all([
        fetchJson<ShiftHoursSettings>(`${serverUrl}/settings/shift-hours`),
        fetchJson<ShiftDefinition[]>(`${serverUrl}/settings/shift-definitions`),
      ]);
      setMode(hours.shift_mode || 'single');
      setDayStart(hours.business_day_start_time || hours.shift_start_time || '03:00');
      setCurrentBusinessDate(hours.current_business_date);
      setDefinitions(Array.isArray(defs) ? defs : []);
    } catch (error) {
      console.error('Failed to load shift settings:', error);
      showToast(t('settings.shiftLoadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === 'multi' && shiftEditorRef.current) {
        const shiftsSaved = await shiftEditorRef.current.saveAll();
        if (!shiftsSaved) return;
      }

      const serverUrl = getServerUrl();
      const data = await fetchJson<ShiftHoursSettings>(`${serverUrl}/settings/shift-hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_mode: mode,
          business_day_start_time: dayStart,
        }),
      });
      setCurrentBusinessDate(data.current_business_date);
      showToast(t('settings.shiftSaveOk'), 'success');
    } catch (error: any) {
      showToast(error?.message || t('settings.shiftSaveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={settingsUi.surface} aria-label={t('settings.shiftCardTitle')}>
      <div className={`${settingsUi.surfaceHead} bg-gradient-to-l from-cyber-aqua/10 via-white to-cloud-soft-white`}>
        <div>
          <h2 className={settingsUi.surfaceTitle}>{t('settings.shiftCardTitle')}</h2>
          <p className={settingsUi.surfaceLede}>{t('settings.shiftCardLede')}</p>
        </div>
      </div>
      <div className={settingsUi.surfacePad}>
        {loading ? (
          <p className="text-[15px] text-graphite">{t('settings.loading')}</p>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-[13px] font-medium uppercase tracking-wide text-obsidian/55">
                {t('settings.shiftModeLabel')}
              </p>
              <div className="flex flex-wrap gap-3">
                {(['single', 'multi'] as ShiftMode[]).map((m) => (
                  <label key={m} className="flex cursor-pointer items-center gap-2 rounded-full border border-black/10 px-4 py-2">
                    <input
                      type="radio"
                      name="shiftMode"
                      checked={mode === m}
                      onChange={() => setMode(m)}
                    />
                    <span className="text-[14px] font-medium">
                      {m === 'single' ? t('settings.shiftModeSingle') : t('settings.shiftModeMulti')}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {mode === 'single' ? (
              <>
                <div>
                  <label className="mb-2 block text-[14px] font-medium text-obsidian">
                    {t('settings.businessDayStartLabel')}
                  </label>
                  <input
                    type="time"
                    value={dayStart}
                    onChange={(e) => setDayStart(e.target.value)}
                    className="w-full max-w-xs rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px]"
                  />
                  <p className="mt-2 text-[13px] text-obsidian/65">{t('settings.businessDayStartHint')}</p>
                </div>
                <div>
                  <p className="mb-2 text-[13px] font-medium uppercase tracking-wide text-obsidian/55">
                    {t('settings.shiftPresetsLabel')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SHIFT_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setDayStart(preset.start)}
                        className="rounded-full border border-black/10 bg-cloud-soft-white px-4 py-2 text-[14px] font-medium"
                      >
                        {t(preset.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <SettingsShiftDefinitionsEditor ref={shiftEditorRef} definitions={definitions} onChanged={load} />
            )}

            {currentBusinessDate ? (
              <div className={settingsUi.metaPanel}>
                <p className={settingsUi.label}>{t('settings.shiftPreviewLabel')}</p>
                <p className="mt-2 text-[15px] font-medium text-obsidian">
                  {t('settings.shiftPreview', { date: currentBusinessDate })}
                </p>
              </div>
            ) : null}

            <button type="button" onClick={handleSave} disabled={saving} className={settingsUi.ctaPrimary}>
              {saving ? t('settings.saving') : t('settings.saveSettings')}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
