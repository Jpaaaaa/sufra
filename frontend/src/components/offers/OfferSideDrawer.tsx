'use client';

import { useEffect, useRef } from 'react';

interface OfferSideDrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  footer?: React.ReactNode;
  widthClassName?: string;
  children: React.ReactNode;
}

/** RTL-friendly side drawer for Offers V2. */
export function OfferSideDrawer({
  open,
  title,
  onClose,
  footer,
  widthClassName = 'w-full max-w-xl',
  children,
}: OfferSideDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex justify-start" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-obsidian/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={`relative flex h-full ${widthClassName} flex-col bg-white shadow-2xl`}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-black/8 px-5 py-4">
          <h2 className="text-[18px] font-bold text-obsidian">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[18px] text-obsidian/50 hover:bg-black/[0.04]"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex-shrink-0 border-t border-black/8 bg-white px-5 py-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
