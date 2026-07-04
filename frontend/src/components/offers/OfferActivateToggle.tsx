'use client';

import { useTranslation } from 'react-i18next';

/** Single control: click to flip active state */
export function OfferActivateToggle({
  active,
  disabled,
  onToggle,
}: {
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`rounded-lg px-3 py-1.5 text-[13px] font-bold transition-colors disabled:opacity-50 ${
        active
          ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
          : 'bg-emerald-600 text-white hover:bg-emerald-700'
      }`}
    >
      {active ? t('offers.deactivate') : t('offers.activate')}
    </button>
  );
}
