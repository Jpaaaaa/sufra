import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ar from './locales/ar.json';
import ckb from './locales/ckb.json';
import { applyDocumentLanguage, attachLanguagePersistence } from './lib/apply-document-language';

export const SUPPORTED_LANGUAGES = ['en', 'ar', 'ckb'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = 'sufra-ui-language';

function readStoredLanguage(): AppLanguage | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && SUPPORTED_LANGUAGES.includes(raw as AppLanguage)) {
      return raw as AppLanguage;
    }
  } catch {
    /* ignore */
  }
  return null;
}

const initialLng = readStoredLanguage() ?? 'en';

i18n.use(initReactI18next).init({
  lng: initialLng,
  fallbackLng: {
    ckb: ['ar', 'en'],
    default: ['en'],
  },
  supportedLngs: [...SUPPORTED_LANGUAGES],
  resources: {
    en: { translation: en },
    ar: { translation: ar },
    ckb: { translation: ckb },
  },
  interpolation: { escapeValue: false },
});

attachLanguagePersistence(i18n, STORAGE_KEY);
applyDocumentLanguage(i18n.language);

export default i18n;
