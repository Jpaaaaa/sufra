import { useTranslation } from 'react-i18next';

/** Number and date locales for order amounts (IQD) in the UI */
export function useOrderLocale() {
  const { i18n } = useTranslation();
  const code = i18n.resolvedLanguage ?? i18n.language;
  const numberLocale = code.startsWith('en') ? 'en-US' : code.startsWith('ckb') ? 'ckb-IQ' : 'ar-IQ';
  const dateLocale = code.startsWith('en') ? 'en-GB' : code.startsWith('ckb') ? 'ckb-IQ' : 'ar-IQ';
  return { numberLocale, dateLocale };
}
