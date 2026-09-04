import { memo, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppLanguage } from '../../i18n';

export const LANGUAGE_OPTIONS: { value: AppLanguage; labelKey: string }[] = [
  { value: 'en', labelKey: 'languageEnglish' },
  { value: 'ar', labelKey: 'languageArabic' },
  { value: 'ckb', labelKey: 'languageKurdishSorani' },
];

export function resolveAppLanguage(code: string): AppLanguage {
  const found = LANGUAGE_OPTIONS.find((o) => code === o.value || code.startsWith(`${o.value}-`));
  return found?.value ?? 'en';
}

function LanguageSwitcher({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const id = useId();
  const { t, i18n } = useTranslation();
  const value = useMemo(() => resolveAppLanguage(i18n.resolvedLanguage || i18n.language), [
    i18n.language,
    i18n.resolvedLanguage,
  ]);

  return (
    <label
      className={`flex min-w-0 flex-col gap-0.5 text-start ${compact ? 'justify-center' : ''} ${className}`}
      htmlFor={id}
    >
      {compact ? null : (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#4A5668]/80">
          {t('language')}
        </span>
      )}
      <select
        id={id}
        value={value}
        aria-label={t('language')}
        onChange={(e) => void i18n.changeLanguage(e.target.value as AppLanguage)}
        className="max-w-[11rem] truncate rounded-lg border border-black/10 bg-white py-1.5 ps-2 pe-7 text-xs font-medium text-[#1A1F25] shadow-sm outline-none hover:bg-white focus:border-[#2EE7C9] focus:ring-1 focus:ring-[#2EE7C9]/40"
      >
        {LANGUAGE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {t(opt.labelKey)}
          </option>
        ))}
      </select>
    </label>
  );
}

export default memo(LanguageSwitcher);
