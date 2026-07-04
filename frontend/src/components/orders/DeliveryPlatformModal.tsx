import { memo, useEffect, useState } from 'react';

export interface DeliveryPlatformOption {
  id: number;
  name: string;
  commission_percent: number;
}

interface DeliveryPlatformModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: DeliveryPlatformOption[];
  selectedId: number | null;
  onApply: (id: number | null) => void;
}

export const DeliveryPlatformModal = memo(function DeliveryPlatformModal({
  isOpen,
  onClose,
  options,
  selectedId,
  onApply,
}: DeliveryPlatformModalProps) {
  const [draftId, setDraftId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraftId(selectedId);
    }
  }, [isOpen, selectedId]);

  const handleApply = () => {
    onApply(draftId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[9999] bg-obsidian/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed left-1/2 top-1/2 z-[10000] w-[min(360px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-black/10 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <h3 className="mb-4 text-[18px] font-bold text-obsidian">منصة التوصيل</h3>
        <p className="mb-3 text-[13px] leading-relaxed text-obsidian/65">
          اختر التطبيق (طلبات، توترز، …). تُطبَّق عمولة المنصة على المجموع. يمكنك لاحقاً تعديل الخصم يدوياً من زر العمولة.
        </p>
        <select
          value={draftId ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            setDraftId(v === '' ? null : parseInt(v, 10));
          }}
          className="mb-5 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[16px] text-obsidian focus:outline-none focus:border-cyber-aqua"
        >
          <option value="">بدون منصة (مباشر)</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.commission_percent}%
            </option>
          ))}
        </select>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-black/10 px-4 py-2 text-[15px] font-bold text-obsidian hover:bg-black/5"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-xl bg-cyber-aqua px-5 py-2 text-[15px] font-bold text-white shadow-soft hover:bg-cyber-aqua/90"
          >
            تطبيق
          </button>
        </div>
      </div>
    </>
  );
});
