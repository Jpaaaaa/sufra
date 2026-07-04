'use client';

import { useTranslation } from 'react-i18next';
import { WEEKDAY_VALUES } from '../../utils/weekdays';

export function WeekdayCheckboxes({
  value,
  onChange,
  idPrefix,
}: {
  value: number[];
  onChange: (next: number[]) => void;
  idPrefix: string;
}) {
  const { t } = useTranslation();
  const toggle = (v: number) => {
    const set = new Set(value);
    if (set.has(v)) set.delete(v);
    else set.add(v);
    onChange([...set].sort((a, b) => a - b));
  };

  return (
    <div className="flex flex-wrap gap-3" role="group" aria-label={t('offers.weekdaysGroupAria')}>
      {WEEKDAY_VALUES.map((d) => (
        <label key={d} className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            id={`${idPrefix}-wd-${d}`}
            checked={value.includes(d)}
            onChange={() => toggle(d)}
          />
          <span className="text-[14px] text-obsidian">{t(`offers.weekday${d}`)}</span>
        </label>
      ))}
    </div>
  );
}
