import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AppLanguage } from '../../i18n';

const PANEL_WIDTH = 220;

export const LANGUAGE_OPTIONS: {
  value: AppLanguage;
  labelKey: string;
  nativeName: string;
  short: string;
  dir: 'ltr' | 'rtl';
}[] = [
  { value: 'en', labelKey: 'languageEnglish', nativeName: 'English', short: 'EN', dir: 'ltr' },
  { value: 'ar', labelKey: 'languageArabic', nativeName: 'العربية', short: 'AR', dir: 'rtl' },
  { value: 'ckb', labelKey: 'languageKurdishSorani', nativeName: 'کوردی', short: 'KU', dir: 'rtl' },
  { value: 'tr', labelKey: 'languageTurkish', nativeName: 'Türkçe', short: 'TR', dir: 'ltr' },
];

export function resolveAppLanguage(code: string): AppLanguage {
  const found = LANGUAGE_OPTIONS.find((o) => code === o.value || code.startsWith(`${o.value}-`));
  return found?.value ?? 'en';
}

function LanguageSwitcher({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const listId = useId();
  const { t, i18n } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState({ top: 0, left: 0 });

  const value = useMemo(
    () => resolveAppLanguage(i18n.resolvedLanguage || i18n.language),
    [i18n.language, i18n.resolvedLanguage],
  );
  const current = LANGUAGE_OPTIONS.find((o) => o.value === value) ?? LANGUAGE_OPTIONS[0];

  const placePanel = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    let left = rect.right - PANEL_WIDTH;
    left = Math.max(8, Math.min(left, window.innerWidth - PANEL_WIDTH - 8));
    let top = rect.bottom + 6;
    const estimatedHeight = 8 + LANGUAGE_OPTIONS.length * 44;
    if (top + estimatedHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - estimatedHeight - 6);
    }
    setPanel({ top, left });
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const toggle = () => {
    if (open) {
      close();
      return;
    }
    placePanel();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onScroll = () => close();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, close]);

  const pick = (next: AppLanguage) => {
    close();
    if (next !== value) void i18n.changeLanguage(next);
  };

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      {compact ? null : (
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#4A5668]/80">
          {t('language')}
        </div>
      )}
      <button
        ref={buttonRef}
        type="button"
        aria-label={t('language')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={toggle}
        className="flex h-9 w-full max-w-[13rem] items-center gap-2 rounded-lg border border-black/10 bg-white px-2.5 text-start shadow-sm outline-none hover:bg-cloud-soft-white focus-visible:border-[#2EE7C9] focus-visible:ring-2 focus-visible:ring-[#2EE7C9]/35"
        dir="ltr"
      >
        <Languages className="h-4 w-4 shrink-0 text-[#4A5668]" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#1A1F25]">
          {current.nativeName}
        </span>
        <span className="rounded bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[#4A5668]">
          {current.short}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-[#4A5668]/70 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" onClick={close} aria-hidden />
              <ul
                id={listId}
                role="listbox"
                aria-label={t('language')}
                className="fixed z-[9999] overflow-hidden rounded-xl border border-black/8 bg-white py-1 shadow-2xl"
                style={{ top: panel.top, left: panel.left, width: PANEL_WIDTH }}
              >
                {LANGUAGE_OPTIONS.map((opt) => {
                  const selected = opt.value === value;
                  return (
                    <li key={opt.value} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => pick(opt.value)}
                        className={`flex w-full items-center gap-2 px-3 py-2.5 text-start transition-colors ${
                          selected ? 'bg-[#2EE7C9]/15' : 'hover:bg-cloud-soft-white'
                        }`}
                        dir="ltr"
                      >
                        <span className="w-8 shrink-0 text-[11px] font-bold tracking-wide text-[#4A5668]">
                          {opt.short}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-start text-[13px] font-semibold text-[#1A1F25]">
                          {opt.nativeName}
                        </span>
                        {selected ? (
                          <Check className="h-4 w-4 shrink-0 text-[#0F8F7A]" aria-hidden />
                        ) : (
                          <span className="h-4 w-4 shrink-0" aria-hidden />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

export default memo(LanguageSwitcher);
