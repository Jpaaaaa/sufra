import type { ShiftDraft } from '../shift-validation';
import { isInShiftWindow, isValidHHmm, timeToMinutes } from '../shift-validation';

const COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#6366f1'];

interface Props {
  shifts: ShiftDraft[];
}

export function ShiftTimelineBar({ shifts }: Props) {
  const complete = shifts.filter(
    (s) => s.name.trim() && isValidHHmm(s.start_time) && isValidHHmm(s.end_time) && s.start_time !== s.end_time,
  );

  if (!complete.length) return null;

  const segments: Array<{ left: number; width: number; color: string; label: string }> = [];

  complete.forEach((shift, index) => {
    const start = timeToMinutes(shift.start_time);
    const end = timeToMinutes(shift.end_time);
    const color = COLORS[index % COLORS.length];

    if (start < end) {
      segments.push({
        left: (start / 1440) * 100,
        width: ((end - start) / 1440) * 100,
        color,
        label: shift.name,
      });
    } else {
      segments.push({
        left: (start / 1440) * 100,
        width: ((1440 - start) / 1440) * 100,
        color,
        label: shift.name,
      });
      if (end > 0) {
        segments.push({
          left: 0,
          width: (end / 1440) * 100,
          color,
          label: shift.name,
        });
      }
    }
  });

  const gapMask = new Array(144).fill(false);
  complete.forEach((shift) => {
    const start = timeToMinutes(shift.start_time);
    const end = timeToMinutes(shift.end_time);
    for (let m = 0; m < 1440; m += 10) {
      if (isInShiftWindow(m, start, end)) gapMask[Math.floor(m / 10)] = true;
    }
  });

  return (
    <div className="space-y-2">
      <div className="relative h-6 overflow-hidden rounded-full bg-obsidian/10">
        {segments.map((seg, i) => (
          <div
            key={`${seg.label}-${i}`}
            className="absolute top-0 h-full opacity-85"
            style={{ left: `${seg.left}%`, width: `${seg.width}%`, backgroundColor: seg.color }}
            title={seg.label}
          />
        ))}
        {gapMask.some((c) => !c) ? (
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.06)_4px,rgba(0,0,0,0.06)_8px)]" />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3 text-[12px] text-obsidian/65">
        {complete.map((shift, index) => (
          <span key={shift.id ?? index} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            {shift.name} ({shift.start_time}–{shift.end_time})
          </span>
        ))}
      </div>
    </div>
  );
}
