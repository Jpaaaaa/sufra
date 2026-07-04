'use client';

import { Hall, TableEntity } from '../../utils';

interface TablesModalProps {
  hall: Hall;
  tables: TableEntity[];
  loading: boolean;
  onSelectTable: (table: TableEntity) => void;
  onClose: () => void;
}

// SVG Table Icon Component
function TableIcon({ tableName }: { tableName: string | null | undefined }) {
  const displayName = tableName || '?';
  return (
    <div className="relative flex items-center justify-center">
      <svg
        width="72"
        height="72"
        viewBox="0 0 72 72"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Table top - modern rounded design */}
        <ellipse
          cx="36"
          cy="28"
          rx="28"
          ry="18"
          fill="white"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-slate-300"
        />
        {/* Table top inner highlight */}
        <ellipse
          cx="36"
          cy="24"
          rx="22"
          ry="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.3"
          className="text-slate-300"
        />
        {/* Table base/stand - modern single pedestal */}
        <path
          d="M 36 46 Q 36 50 32 50 L 32 60 Q 32 64 36 64 Q 40 64 40 60 L 40 50 Q 36 50 36 46 Z"
          fill="currentColor"
          className="text-slate-400"
        />
        {/* Table number badge - modern design */}
        <circle
          cx="36"
          cy="28"
          r="16"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
          className="text-slate-400"
        />
      </svg>
      {/* Table number text */}
      <span className="absolute text-[18px] font-bold text-slate-700">
        {displayName}
      </span>
    </div>
  );
}

export default function TablesModal({
  hall,
  tables,
  loading,
  onSelectTable,
  onClose,
}: TablesModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
          <div>
            <h2 className="text-[20px] leading-tight font-semibold text-slate-900">
              اختر الطاولة - {hall.name}
            </h2>
            <p className="text-[13px] leading-relaxed text-slate-500">
              صالة رقم {hall.number}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-[15px] leading-normal font-medium text-slate-700 hover:bg-slate-50"
          >
            إغلاق
          </button>
        </header>

        <main className="max-h-[500px] overflow-auto p-6">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-[15px] leading-normal text-slate-500">
              جاري تحميل الطاولات...
            </div>
          ) : tables.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 text-[15px] leading-normal text-slate-500">
              لا توجد طاولات في هذه الصالة
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {tables.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => onSelectTable(table)}
                  className="group flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm hover:border-blue-400 hover:shadow-md"
                >
                  <TableIcon tableName={table.name} />
                  
                  {table.name && (
                    <p className="text-center text-[12px] leading-tight font-medium text-slate-600">
                      {table.name}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

