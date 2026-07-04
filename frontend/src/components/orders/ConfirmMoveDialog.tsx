import { useTranslation } from 'react-i18next';

interface ConfirmMoveDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmMoveDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: ConfirmMoveDialogProps) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-obsidian/80 p-4"
      onClick={onCancel}
    >
      <div
        className="rounded-xl border border-black/10 bg-white shadow-xl max-w-sm w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[18px] font-bold text-obsidian mb-2">{title}</h3>
        <p className="text-[14px] text-obsidian/70 mb-5">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-stone-200 px-4 py-2.5 text-[15px] font-medium text-obsidian/70 hover:bg-stone-50"
          >
            {t('orders.moveDialogCancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-cyber-aqua px-4 py-2.5 text-[15px] font-bold text-white hover:bg-cyber-aqua/90"
          >
            {t('orders.moveDialogConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
