'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from 'react';
import NumericKeypad from '../components/ui/NumericKeypad';

type OpenPayload = {
  initial: string;
  setValue: (next: string) => void;
};

type GlobalNumericKeypadContextValue = {
  openKeypad: (payload: OpenPayload) => void;
  closeKeypad: () => void;
};

const GlobalNumericKeypadContext = createContext<GlobalNumericKeypadContextValue | null>(null);

export function GlobalNumericKeypadProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const sessionRef = useRef<OpenPayload | null>(null);

  const closeKeypad = useCallback(() => {
    setOpen(false);
    sessionRef.current = null;
  }, []);

  const openKeypad = useCallback((payload: OpenPayload) => {
    sessionRef.current = payload;
    setDraft(payload.initial);
    setOpen(true);
  }, []);

  const updateDraft = useCallback((next: string) => {
    setDraft(next);
    sessionRef.current?.setValue(next);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeKeypad();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeKeypad]);

  const value = useMemo(
    () => ({ openKeypad, closeKeypad }),
    [openKeypad, closeKeypad],
  );

  return (
    <GlobalNumericKeypadContext.Provider value={value}>
      {children}
      {open && (
        <div
          dir="ltr"
          className="fixed inset-0 z-[10100] flex items-start justify-start bg-obsidian/40 p-4 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="لوحة أرقام"
        >
          <button
            type="button"
            className="absolute inset-0 z-0 cursor-default"
            aria-label="إغلاق"
            onClick={() => closeKeypad()}
          />
          <div
            className="relative z-10 w-full max-w-[320px] shadow-2xl"
            dir="ltr"
            onClick={(e) => e.stopPropagation()}
          >
            <NumericKeypad
              value={draft}
              onChange={updateDraft}
              onConfirm={() => closeKeypad()}
              disabled={false}
              title="إدخال رقم"
              className="!bg-white"
            />
          </div>
        </div>
      )}
    </GlobalNumericKeypadContext.Provider>
  );
}

/** Attach to numeric inputs (not inside [data-skip-global-keypad]). Opens popup keypad + select-all on focus. */
export function useGlobalNumericField(
  value: string | number,
  setValue: (next: string) => void,
): { onFocus: (e: FocusEvent<HTMLInputElement>) => void } {
  const ctx = useContext(GlobalNumericKeypadContext);
  const valueRef = useRef(String(value));
  valueRef.current = String(value);

  const onFocus = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      e.currentTarget.select();
      if (!ctx) return;
      if (e.currentTarget.closest('[data-skip-global-keypad]')) return;
      ctx.openKeypad({
        initial: valueRef.current,
        setValue,
      });
    },
    [ctx, setValue],
  );

  return { onFocus };
}
