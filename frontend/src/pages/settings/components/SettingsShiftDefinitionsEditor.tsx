import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getServerUrl, fetchJson } from '../../../utils';
import { showToast } from '../../../components/ui/Toast';
import { settingsUi } from '../settings-ui';
import type { ShiftDefinition } from '../settings-shift-types';
import {
  applyAutoShiftNames,
} from '../shift-auto-names';
import {
  createEmptyShift,
  shiftsFromDefinitions,
  validateShifts,
  type ShiftDraft,
} from '../shift-validation';
import { ShiftDefinitionRow } from './ShiftDefinitionRow';
import { ShiftTimelineBar } from './ShiftTimelineBar';

interface Props {
  definitions: ShiftDefinition[];
  onChanged: () => void;
}

export interface SettingsShiftDefinitionsEditorHandle {
  saveAll: () => Promise<boolean>;
}

async function putShiftDefinitions(shifts: Array<{
  id?: number;
  name: string;
  start_time: string;
  end_time: string;
  sort_order?: number;
}>) {
  const serverUrl = getServerUrl();
  return fetchJson(`${serverUrl}/settings/shift-definitions/bulk`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shifts }),
  });
}

export const SettingsShiftDefinitionsEditor = forwardRef<SettingsShiftDefinitionsEditorHandle, Props>(
  function SettingsShiftDefinitionsEditor({ definitions, onChanged }, ref) {
    const { t } = useTranslation();
    const [rows, setRows] = useState<ShiftDraft[]>(() => shiftsFromDefinitions(definitions));
    const [busy, setBusy] = useState(false);

    const autoName = (index: number) => t('settings.shiftAutoName', { number: index + 1 });

    useEffect(() => {
      setRows(applyAutoShiftNames(shiftsFromDefinitions(definitions), autoName));
    }, [definitions, t]);

    const validation = useMemo(() => validateShifts(rows), [rows]);

    const persistRows = async (nextRows: ShiftDraft[], options?: { silent?: boolean }): Promise<boolean> => {
      const named = applyAutoShiftNames(nextRows, autoName);

      if (named.length === 0) {
        await putShiftDefinitions([]);
        onChanged();
        if (!options?.silent) showToast(t('settings.shiftDefClearOk'), 'success');
        return true;
      }

      const nextValidation = validateShifts(named);
      if (nextValidation.hasBlockingErrors) {
        if (!options?.silent) showToast(t('settings.shiftFixErrors'), 'error');
        return false;
      }

      await putShiftDefinitions(
        named.map((row, index) => ({
          id: row.id,
          name: row.name.trim(),
          start_time: row.start_time,
          end_time: row.end_time,
          sort_order: index,
        })),
      );
      onChanged();
      if (!options?.silent) showToast(t('settings.shiftDefSaveAllOk'), 'success');
      return true;
    };

    useImperativeHandle(ref, () => ({
      saveAll: () => persistRows(rows),
    }));

    const updateRow = (index: number, patch: Partial<ShiftDraft>) => {
      setRows((prev) =>
        applyAutoShiftNames(
          prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
          autoName,
        ),
      );
    };

    const addRow = () => {
      setRows((prev) => applyAutoShiftNames([...prev, createEmptyShift(prev.length)], autoName));
    };

    const removeRow = async (index: number) => {
      const next = applyAutoShiftNames(
        rows.filter((_, i) => i !== index),
        autoName,
      );
      setRows(next);
      setBusy(true);
      try {
        await persistRows(next, { silent: true });
        showToast(t('settings.shiftDefDeleteOk'), 'success');
      } catch (error: any) {
        showToast(error?.message || t('settings.shiftDefSaveFailed'), 'error');
        onChanged();
      } finally {
        setBusy(false);
      }
    };

    const saveAll = async () => {
      setBusy(true);
      try {
        await persistRows(rows);
      } catch (error: any) {
        showToast(error?.message || t('settings.shiftDefSaveFailed'), 'error');
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="space-y-4">
        <p className="text-[14px] text-obsidian/70">{t('settings.shiftMultiLede')}</p>

        <div className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-[14px] text-graphite">{t('settings.shiftDefEmpty')}</p>
          ) : null}
          {rows.map((row, index) => (
            <ShiftDefinitionRow
              key={row.id ?? `new-${index}`}
              shift={row}
              index={index}
              overlapError={validation.rowErrors[index]}
              canDelete
              disabled={busy}
              onChange={(patch) => updateRow(index, patch)}
              onDelete={() => void removeRow(index)}
            />
          ))}
        </div>

        <button type="button" onClick={addRow} disabled={busy} className={settingsUi.ctaSecondary}>
          + {t('settings.shiftDefAdd')}
        </button>

        <ShiftTimelineBar shifts={rows} />

        {validation.gaps.length > 0 ? (
          <div className="rounded-soft-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-[13px] text-amber-900">
            {validation.gaps.map((gap) => (
              <p key={`${gap.start}-${gap.end}`}>
                {t('settings.shiftGapWarning', { start: gap.start, end: gap.end })}
              </p>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void saveAll()}
          disabled={busy || validation.hasBlockingErrors}
          className={settingsUi.ctaPrimary}
        >
          {busy ? t('settings.saving') : t('settings.shiftSaveAll')}
        </button>
      </div>
    );
  },
);
