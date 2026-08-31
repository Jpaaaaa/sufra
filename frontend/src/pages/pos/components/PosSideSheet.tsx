export function PosSideSheet({
  open,
  wide,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  wide?: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <button type="button" className="pos-sheet-backdrop" aria-label="close" onClick={onClose} />
      <aside className={`pos-sheet ${wide ? 'is-wide' : ''}`} role="dialog" aria-label={title}>
        <div className="flex min-h-[48px] items-center justify-between border-b border-black/5 px-4">
          <h2 className="text-[16px] font-bold">{title}</h2>
          <button type="button" className="pos-topbar-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        {footer && <div className="p-3">{footer}</div>}
      </aside>
    </>
  );
}
