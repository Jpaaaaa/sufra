'use client';

import { Hall } from '../../utils';

interface HallSelectorProps {
  halls: Hall[];
  loading: boolean;
  onSelectHall: (hall: Hall) => void;
}

export default function HallSelector({ halls, loading, onSelectHall }: HallSelectorProps) {
  if (loading && halls.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 text-[15px] leading-normal text-slate-500">
        جاري تحميل الصالات...
      </div>
    );
  }

  if (halls.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 text-[15px] leading-normal text-slate-500">
        لا توجد صالات بعد. قم بإضافة صالات من الهيكل التنظيمي للمطعم.
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-[20px] leading-tight font-semibold text-slate-900">
        اختر الصالة
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {halls.map((hall) => (
          <button
            key={hall.id}
            type="button"
            onClick={() => onSelectHall(hall)}
            className="group flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm hover:border-emerald-400 hover:shadow-lg"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-[28px] leading-tight font-bold text-emerald-700">
              {hall.number}
            </div>
            <h3 className="text-[20px] leading-tight font-semibold text-slate-900">
              {hall.name}
            </h3>
            {hall.floor && (
              <p className="text-[13px] leading-tight text-slate-500">
                الطابق: {hall.floor.name}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

