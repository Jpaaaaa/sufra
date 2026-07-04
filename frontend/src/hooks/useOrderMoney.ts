import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrderLocale } from './useOrderLocale';

/** IQD display for order UI (locale-aware numbers + translated currency suffix). */
export function useOrderMoney() {
  const { t } = useTranslation();
  const { numberLocale } = useOrderLocale();
  return useCallback(
    (amount: number) => {
      const n = Math.round(amount);
      return `${n.toLocaleString(numberLocale)} ${t('orders.currency')}`;
    },
    [t, numberLocale],
  );
}
