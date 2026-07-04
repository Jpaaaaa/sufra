import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, GripVertical, X } from 'lucide-react';
import type { Category } from '../../hooks/useCategories';

function moveIndex<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface CategorySortModalProps {
  open: boolean;
  categories: Category[];
  loading: boolean;
  onClose: () => void;
  onSave: (orderedIds: number[]) => Promise<void>;
}

export default function CategorySortModal({
  open,
  categories,
  loading,
  onClose,
  onSave,
}: CategorySortModalProps) {
  const { t } = useTranslation();
  const [ordered, setOrdered] = useState<Category[]>([]);
  const [dragId, setDragId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setOrdered(
        [...categories].sort((a, b) => (a.sort_order ?? a.id) - (b.sort_order ?? b.id)),
      );
      setDragId(null);
    }
  }, [open, categories]);

  const moveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setOrdered((prev) => moveIndex(prev, index, index - 1));
  }, []);

  const moveDown = useCallback((index: number) => {
    setOrdered((prev) => {
      if (index >= prev.length - 1) return prev;
      return moveIndex(prev, index, index + 1);
    });
  }, []);

  const handleDragStart = (id: number) => {
    setDragId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetId: number) => {
    if (dragId === null || dragId === targetId) return;
    setOrdered((prev) => {
      const from = prev.findIndex((c) => c.id === dragId);
      const to = prev.findIndex((c) => c.id === targetId);
      if (from < 0 || to < 0) return prev;
      return moveIndex(prev, from, to);
    });
    setDragId(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(ordered.map((c) => c.id));
      onClose();
    } catch {
      // Error toast from caller; keep modal open
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-sort-title"
    >
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-soft-xl border border-black/10 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
          <h2 id="category-sort-title" className="text-[18px] font-bold text-obsidian">
            {t('catalog.sortModalTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-soft-lg p-2 text-obsidian/60 hover:bg-black/5 hover:text-obsidian"
            aria-label={t('catalog.close')}
          >
            <X size={20} />
          </button>
        </div>

        <p className="px-5 pt-3 text-[14px] leading-relaxed text-obsidian/65">
          {t('catalog.sortModalHint')}
        </p>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-2">
            {ordered.map((cat, index) => (
              <li
                key={cat.id}
                draggable
                onDragStart={() => handleDragStart(cat.id)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(cat.id)}
                className={`flex items-center gap-2 rounded-soft-lg border border-black/5 bg-cloud-soft-white px-3 py-2.5 shadow-sm transition-colors ${
                  dragId === cat.id ? 'border-cyber-aqua/50 bg-cyber-aqua/5' : ''
                }`}
              >
                <span
                  className="cursor-grab touch-none text-obsidian/35 active:cursor-grabbing"
                  title={t('catalog.drag')}
                >
                  <GripVertical size={18} />
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-soft bg-cyber-aqua/15 text-[13px] font-bold text-cyber-aqua">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold text-obsidian">{cat.name}</span>
                <div className="flex shrink-0 flex-col gap-0.5">
                  <button
                    type="button"
                    disabled={index === 0 || saving}
                    onClick={() => moveUp(index)}
                    className="rounded-md p-1 text-obsidian/50 hover:bg-white hover:text-cyber-aqua disabled:opacity-25"
                    aria-label={t('catalog.moveUp')}
                  >
                    <ChevronUp size={18} />
                  </button>
                  <button
                    type="button"
                    disabled={index >= ordered.length - 1 || saving}
                    onClick={() => moveDown(index)}
                    className="rounded-md p-1 text-obsidian/50 hover:bg-white hover:text-cyber-aqua disabled:opacity-25"
                    aria-label={t('catalog.moveDown')}
                  >
                    <ChevronDown size={18} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end gap-2 border-t border-black/5 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-soft-lg border border-black/10 bg-white px-4 py-2.5 text-[15px] font-bold text-obsidian hover:bg-cloud-soft-white"
          >
            {t('halls.cancel')}
          </button>
          <button
            type="button"
            disabled={saving || loading || ordered.length === 0}
            onClick={() => void handleSave()}
            className="rounded-soft-lg bg-cyber-aqua px-5 py-2.5 text-[15px] font-bold text-white shadow-soft hover:bg-cyber-aqua/90 disabled:opacity-50"
          >
            {saving ? t('catalog.savingOrder') : t('catalog.saveOrder')}
          </button>
        </div>
      </div>
    </div>
  );
}
