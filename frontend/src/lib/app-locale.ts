/** BCP 47 base (en, ar, ckb, tr). */
export function languageBase(code: string | undefined | null): string {
  return (code ?? 'en').split('-')[0] ?? 'en';
}

/** localeCompare / Intl.Collator tag for the current UI language. */
export function collatorLocale(code: string | undefined | null): string {
  const base = languageBase(code);
  if (base === 'en') return 'en';
  if (base === 'tr') return 'tr';
  if (base === 'ckb') return 'ckb';
  return 'ar';
}

export function numberFormatLocale(code: string | undefined | null): string {
  const base = languageBase(code);
  if (base === 'en') return 'en-US';
  if (base === 'tr') return 'tr-TR';
  if (base === 'ckb') return 'ckb-IQ';
  return 'ar-IQ';
}

export function dateFormatLocale(code: string | undefined | null): string {
  const base = languageBase(code);
  if (base === 'en') return 'en-GB';
  if (base === 'tr') return 'tr-TR';
  if (base === 'ckb') return 'ckb-IQ';
  return 'ar-IQ';
}
