import { useTranslation } from 'react-i18next';
import type { ShiftDraft, ShiftOverlapError } from '../shift-validation';

interface Props {
  shift: ShiftDraft;
  index: number;
  overlapError: ShiftOverlapError | null;
  canDelete: boolean;
  disabled: boolean;
  onChange: (patch: Partial<ShiftDraft>) => void;
  onDelete: () => void;
}

export function ShiftDefinitionRow({
  shift,
  index,
  overlapError,
  canDelete,
  disabled,
  onChange,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  return (
    <div className="rounded-soft-lg border border-black/5 bg-cloud-soft-white/80 p-4">
      <div className="mb-3 flex items-center justify-end gap-2">
        {canDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className="rounded-full border border-red-200 px-3 py-1 text-[12px] font-semibold text-red-700"
          >
            {t('settings.shiftDefDelete')}
          </button>
        ) : null}
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-[13px] font-medium text-obsidian">{t('settings.shiftDefName')}</label>
        <input
          type="text"
          value={shift.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t('settings.shiftNamePlaceholder', { number: index + 1 })}
          disabled={disabled}
          className="w-full rounded-soft border border-black/5 px-3 py-2"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[13px] font-medium text-obsidian">{t('settings.shiftStartLabel')}</label>
          <input
            type="time"
            value={shift.start_time}
            onChange={(e) => onChange({ start_time: e.target.value })}
            className="w-full rounded-soft border border-black/5 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-medium text-obsidian">{t('settings.shiftEndLabel')}</label>
          <input
            type="time"
            value={shift.end_time}
            onChange={(e) => onChange({ end_time: e.target.value })}
            className="w-full rounded-soft border border-black/5 px-3 py-2"
          />
        </div>
      </div>
      {overlapError ? (
        <p className="mt-2 text-[13px] font-medium text-red-600">
          {t('settings.shiftOverlapError', {
            row: overlapError.index + 1,
            name: overlapError.name,
            start: overlapError.start,
            end: overlapError.end,
          })}
        </p>
      ) : null}
    </div>
  );
}
