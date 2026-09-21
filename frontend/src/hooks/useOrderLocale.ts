import { useTranslation } from 'react-i18next';
import { dateFormatLocale, numberFormatLocale } from '../lib/app-locale';

/** Number and date locales for order amounts (IQD) in the UI */
export function useOrderLocale() {
  const { i18n } = useTranslation();
  const code = i18n.resolvedLanguage ?? i18n.language;
  return {
    numberLocale: numberFormatLocale(code),
    dateLocale: dateFormatLocale(code),
  };
}
