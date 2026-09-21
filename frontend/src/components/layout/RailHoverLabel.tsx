import { memo, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const SHOW_DELAY_MS = 120;

function isRtl(): boolean {
  return document.documentElement.getAttribute('dir') === 'rtl';
}

function RailHoverLabel({
  label,
  enabled,
  children,
}: {
  label: string;
  enabled: boolean;
  children: ReactNode;
}) {
  const tipId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const delayRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, rtl: true });

  const clearDelay = useCallback(() => {
    if (delayRef.current != null) {
      window.clearTimeout(delayRef.current);
      delayRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearDelay();
    setOpen(false);
  }, [clearDelay]);

  const show = useCallback(() => {
    if (!enabled) return;
    clearDelay();
    delayRef.current = window.setTimeout(() => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const rtl = isRtl();
      const gap = 10;
      setPos({
        top: r.top + r.height / 2,
        left: rtl ? r.left - gap : r.right + gap,
        rtl,
      });
      setOpen(true);
      delayRef.current = null;
    }, SHOW_DELAY_MS);
  }, [clearDelay, enabled]);

  useEffect(() => {
    if (!enabled) hide();
  }, [enabled, hide]);

  useEffect(() => () => clearDelay(), [clearDelay]);

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {enabled && open
        ? createPortal(
            <span
              id={tipId}
              role="tooltip"
              className="pointer-events-none fixed z-[80] max-w-[13.5rem] rounded-xl border border-black/[0.06] bg-white px-3 py-1.5 text-start text-[12.5px] font-semibold leading-snug text-obsidian shadow-[0_8px_28px_rgba(26,31,37,0.14)]"
              style={{
                top: pos.top,
                left: pos.left,
                transform: pos.rtl ? 'translate(-100%, -50%)' : 'translateY(-50%)',
              }}
            >
              <span
                className="absolute start-[-4px] top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-b border-s border-black/[0.06] bg-white"
                aria-hidden
              />
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

export default memo(RailHoverLabel);
