export function formatElapsedShort(since: string, locale: string): string {
  const start = new Date(since).getTime();
  if (Number.isNaN(start)) return '';
  const mins = Math.max(0, Math.floor((Date.now() - start) / 60000));
  const useAr = locale.startsWith('ar');
  const n = (value: number, pad = 0) => {
    const raw = pad > 0 ? String(value).padStart(pad, '0') : String(value);
    return useAr ? toArabicDigits(raw) : raw;
  };

  if (mins < 60) {
    if (useAr) return `${n(mins)}د`;
    if (locale.startsWith('ckb')) return `${mins} خ`;
    return `${mins}m`;
  }

  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${n(h)}:${n(m, 2)}`;
}

function toArabicDigits(value: string): string {
  return value.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d);
}
