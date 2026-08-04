import { useEffect } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  imageSrc: string | null;
  loading: boolean;
  title?: string;
  onPrint?: () => void;
  printing?: boolean;
};

export default function SettingsRecipePrintPreviewModal({
  open,
  onClose,
  imageSrc,
  loading,
  title = 'معاينة الطباعة',
  onPrint,
  printing = false,
}: Props) {
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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] max-w-lg overflow-auto rounded-soft-xl border border-black/10 bg-white p-4 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[15px] font-medium text-obsidian">{title}</span>
          <div className="flex flex-wrap items-center gap-2">
            {onPrint && !loading && imageSrc ? (
              <button
                type="button"
                onClick={onPrint}
                disabled={printing}
                className="rounded-full bg-cyber-aqua px-4 py-1.5 text-[14px] font-medium text-charcoal-graphite shadow-soft hover:opacity-90 disabled:opacity-50"
              >
                {printing ? 'جاري الطباعة…' : 'طباعة'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-3 py-1.5 text-[14px] text-obsidian/80 hover:bg-black/5"
            >
              إغلاق
            </button>
          </div>
        </div>
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyber-aqua border-t-transparent" />
          </div>
        ) : imageSrc ? (
          <img
            src={imageSrc}
            alt={title}
            className="mx-auto max-h-[min(70vh,800px)] w-auto max-w-full border border-black/10 bg-white"
          />
        ) : (
          <p className="py-8 text-center text-[14px] text-graphite">لا توجد صورة.</p>
        )}
      </div>
    </div>
  );
}
