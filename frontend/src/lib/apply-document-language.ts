import type { i18n as I18nType } from 'i18next';

/** Sorani uses Arabic script (RTL), same as Arabic. */
const RTL_BASE = new Set(['ar', 'ckb']);

export function applyDocumentLanguage(language: string): void {
  const base = language.split('-')[0] ?? language;
  const dir = RTL_BASE.has(base) ? 'rtl' : 'ltr';
  document.documentElement.lang = language;
  document.documentElement.dir = dir;
}

export function attachLanguagePersistence(i18n: I18nType, storageKey: string): void {
  i18n.on('languageChanged', (lng) => {
    try {
      localStorage.setItem(storageKey, lng);
    } catch {
      /* ignore private mode / quota */
    }
    applyDocumentLanguage(lng);
  });
}
