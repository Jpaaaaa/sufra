'use client';

import { Hall, TableEntity } from '../../utils';

interface TableSelectorProps {
  hall: Hall;
  tables: TableEntity[];
  loading: boolean;
  onSelectTable: (table: TableEntity) => void;
  onBack: () => void;
}

// Flat table icon - no text, label goes below
function TableIcon() {
  const strokeColor = '#78716c';
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="18" y="35" width="64" height="22" rx="4" fill="#E8E6E3" stroke={strokeColor} strokeWidth="2" />
      <line x1="28" y1="57" x2="28" y2="88" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="72" y1="57" x2="72" y2="88" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="38" y1="57" x2="38" y2="85" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <line x1="62" y1="57" x2="62" y2="85" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export default function TableSelector({
  hall,
  tables,
  loading,
  onSelectTable,
  onBack,
}: TableSelectorProps) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[20px] leading-tight font-semibold text-slate-900">
            اختر الطاولة
          </h2>
          <p className="text-[13px] leading-relaxed text-slate-500">
            الصالة: {hall.name} · رقم {hall.number}
            {hall.floor && <> · الطابق: {hall.floor.name}</>}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-[15px] leading-normal font-medium text-slate-700 hover:bg-slate-50"
        >
          ← رجوع للصالات
        </button>
      </div>

      {loading && tables.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 text-[15px] leading-normal text-slate-500">
          جاري تحميل الطاولات...
        </div>
      ) : tables.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 text-[15px] leading-normal text-slate-500">
          لا توجد طاولات في هذه الصالة.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {tables.map((table) => (
            <button
              key={table.id}
              type="button"
              onClick={() => onSelectTable(table)}
              className="group flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-300 hover:shadow-md transition-shadow"
            >
              <TableIcon />
              <p className="text-center text-[14px] font-semibold text-stone-700 truncate w-full">
                {table.name || `طاولة ${table.number}`}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

