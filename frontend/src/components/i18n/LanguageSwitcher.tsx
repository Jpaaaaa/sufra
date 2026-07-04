import { memo, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppLanguage } from '../../i18n';

const OPTIONS: { value: AppLanguage; labelKey: string }[] = [
  { value: 'en', labelKey: 'languageEnglish' },
  { value: 'ar', labelKey: 'languageArabic' },
  { value: 'ckb', labelKey: 'languageKurdishSorani' },
];

function resolveAppLanguage(code: string): AppLanguage {
  const found = OPTIONS.find((o) => code === o.value || code.startsWith(`${o.value}-`));
  return found?.value ?? 'en';
}

function LanguageSwitcher({ className = '' }: { className?: string }) {
  const id = useId();
  const { t, i18n } = useTranslation();
  const value = useMemo(() => resolveAppLanguage(i18n.resolvedLanguage || i18n.language), [
    i18n.language,
    i18n.resolvedLanguage,
  ]);

  return (
    <label
      className={`flex min-w-0 flex-col gap-0.5 text-left ${className}`}
      htmlFor={id}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#4A5668]/80">
        {t('language')}
      </span>
      <select
        id={id}
        value={value}
        onChange={(e) => void i18n.changeLanguage(e.target.value as AppLanguage)}
        className="max-w-[11rem] truncate rounded-lg border border-black/10 bg-white/90 py-1.5 pl-2 pr-7 text-xs font-medium text-[#1A1F25] shadow-sm backdrop-blur-sm outline-none hover:bg-white focus:border-[#2EE7C9] focus:ring-1 focus:ring-[#2EE7C9]/40"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {t(opt.labelKey)}
          </option>
        ))}
      </select>
    </label>
  );
}

export default memo(LanguageSwitcher);
