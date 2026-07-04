'use client';

/**
 * Touch-friendly numeric entry. Parent owns the string value (e.g. price draft).
 * Use onMouseDown preventDefault on buttons so paired inputs don't lose focus.
 */
interface NumericKeypadProps {
  value: string;
  onChange: (next: string) => void;
  onConfirm?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}

function applyKey(current: string, key: string): string {
  if (key === 'clear') return '';
  if (key === 'back') return current.slice(0, -1);
  if (key === '.') {
    if (current.includes('.')) return current;
    return current === '' ? '0.' : `${current}.`;
  }
  if (key === '000') {
    if (current === '' || current === '0') return '000';
    return current + '000';
  }
  if (/^\d$/.test(key)) {
    if (current === '0' && key !== '0') return key;
    if (current === '0' && key === '0') return '0';
    return current + key;
  }
  return current;
}

export default function NumericKeypad({
  value,
  onChange,
  onConfirm,
  disabled,
  title,
  className = '',
}: NumericKeypadProps) {
  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', 'back'],
  ] as const;

  const press = (key: string) => {
    if (disabled) return;
    onChange(applyKey(value, key));
  };

  return (
    <div
      className={`rounded-soft-xl border border-black/10 bg-cloud-soft-white p-3 shadow-soft ${className}`}
      dir="ltr"
    >
      {title && (
        <p className="mb-3 border-b border-black/5 pb-2 text-center text-[12px] font-medium text-obsidian/70">
          {title}
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {keys.flatMap((row) =>
          row.map((k) => (
            <button
              key={k}
              type="button"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => press(k)}
              className="flex h-12 min-w-[3rem] items-center justify-center rounded-soft-lg border border-black/10 bg-white text-[18px] font-semibold text-obsidian shadow-sm transition hover:bg-cyber-aqua/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {k === 'back' ? '⌫' : k}
            </button>
          )),
        )}
      </div>
      <div className="mt-2">
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => press('000')}
          className="flex h-12 w-full items-center justify-center rounded-soft-lg border border-black/10 bg-white text-[17px] font-bold tracking-widest text-obsidian shadow-sm transition hover:bg-cyber-aqua/10 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          000
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => press('clear')}
          className="rounded-soft-lg border border-black/10 bg-white py-3 text-[13px] font-bold text-obsidian/80 shadow-sm hover:bg-red-50 hover:text-red-800 disabled:opacity-40"
        >
          مسح
        </button>
        {onConfirm && (
          <button
            type="button"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onConfirm?.()}
            className="rounded-soft-lg bg-cyber-aqua py-3 text-[13px] font-bold text-charcoal-graphite shadow-soft hover:opacity-90 disabled:opacity-40"
          >
            حفظ
          </button>
        )}
      </div>
    </div>
  );
}
