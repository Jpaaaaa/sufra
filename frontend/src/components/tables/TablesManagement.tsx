'use client';

import { useTranslation } from 'react-i18next';
import { Hall, TableEntity } from '../../utils';
import { useGlobalNumericField } from '../../contexts/GlobalNumericKeypadContext';

interface TablesManagementProps {
  halls: Hall[];
  selectedHall: Hall | null;
  setSelectedHall: (hall: Hall | null) => void;
  tables: TableEntity[];
  loading: boolean;
  error: string | null;
  tableFormState: {
    id?: number;
    number: number;
    name: string;
  };
  setTableFormState: React.Dispatch<React.SetStateAction<{
    id?: number;
    number: number;
    name: string;
  }>>;
  handleSubmitTable: (e: React.FormEvent) => Promise<void>;
  handleEditTable: (table: TableEntity) => void;
  handleDeleteTable: (table: TableEntity) => Promise<void>;
}

export default function TablesManagement({
  halls,
  selectedHall,
  setSelectedHall,
  tables,
  loading,
  error,
  tableFormState,
  setTableFormState,
  handleSubmitTable,
  handleEditTable,
  handleDeleteTable,
}: TablesManagementProps) {
  const { t } = useTranslation();
  const tableNumberField = useGlobalNumericField(String(tableFormState.number), (s) =>
    setTableFormState((prev) => ({ ...prev, number: parseInt(s, 10) || 1 })),
  );

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h2 className="text-[16px] leading-normal font-semibold text-slate-900">
            {t('halls.tablesMgmtTitle')}
          </h2>
          {selectedHall ? (
            <p className="text-[13px] leading-relaxed text-slate-500">
              {t('halls.selectedHallLine', {
                name: selectedHall.name,
                number: selectedHall.number,
              })}
            </p>
          ) : (
            <p className="text-[13px] leading-relaxed text-slate-500">
              {t('halls.pickHallFromList')}
            </p>
          )}
        </div>
        {halls.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-[13px] leading-relaxed font-medium text-slate-700">
              {t('halls.chooseHall')}
            </label>
            <select
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] leading-normal focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={selectedHall?.id ?? ''}
              onChange={(e) => {
                const hallId = Number(e.target.value);
                const hall = halls.find((h) => h.id === hallId);
                if (hall) {
                  setSelectedHall(hall); // This updates global store, which triggers useEffect to load tables
                  setTableFormState({ id: undefined, number: 1, name: '' });
                }
              }}
            >
              <option value="">{t('halls.selectHallPlaceholder')}</option>
              {halls.map((hall) => (
                <option key={hall.id} value={hall.id}>
                  {t('halls.hallOptionShort', { name: hall.name, number: hall.number })}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {halls.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800">
          {t('halls.noHallsForTables', { tab: t('halls.tabHalls') })}
        </div>
      ) : !selectedHall ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800">
          {t('halls.selectHallAbove')}
        </div>
      ) : (
        <>
          <form
            onSubmit={handleSubmitTable}
            className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3"
          >
            {/* When editing, show number field. When creating, number is auto 1,2,3... */}
            {tableFormState.id !== undefined ? (
              <div>
                <label className="block text-[13px] leading-relaxed font-medium text-slate-700">
                  {t('halls.tableNumber')} <span className="text-red-500">*</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    min="1"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] leading-normal focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={tableFormState.number}
                    onChange={(e) =>
                      setTableFormState((prev) => ({
                        ...prev,
                        number: parseInt(e.target.value, 10) || 1,
                      }))
                    }
                    onFocus={tableNumberField.onFocus}
                  />
                </label>
              </div>
            ) : (
              <div className="flex items-end">
                <p className="text-[13px] leading-relaxed text-slate-600">
                  {t('halls.autoTableNumberHint')}
                </p>
              </div>
            )}
            <div>
              <label className="block text-[13px] leading-relaxed font-medium text-slate-700">
                {t('halls.tableNameOptional')}
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] leading-normal focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={tableFormState.name}
                  onChange={(e) =>
                    setTableFormState((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="flex items-end gap-2 md:col-span-1 md:justify-end">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-[15px] leading-normal font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {tableFormState.id ? t('halls.updateTable') : t('halls.addTable')}
              </button>
              <button
                type="button"
                onClick={() =>
                  setTableFormState({
                    id: undefined,
                    number: 1,
                    name: '',
                  })
                }
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-[15px] leading-normal font-medium text-slate-700 hover:bg-slate-50"
              >
                {t('halls.cancel')}
              </button>
            </div>
          </form>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] leading-relaxed text-red-700">
              {error}
            </div>
          )}

          {loading && tables.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 text-[15px] leading-normal text-slate-500">
              {t('halls.loadingTables')}
            </div>
          ) : tables.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 text-center">
              <p className="text-[15px] leading-normal font-semibold text-amber-800">
                {t('halls.emptyTablesTitle')}
              </p>
              <p className="text-[13px] leading-relaxed text-amber-700">
                {t('halls.emptyTablesHint')}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {tables.map((table) => (
                <div
                  key={table.id}
                  className="group relative flex flex-col items-center justify-between rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all duration-300 ring-1 ring-black/5 hover:ring-amber-400/50 h-40"
                >
                  {/* Top accent bar */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400/40 to-yellow-500/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-2xl" />

                  {/* Edit/Delete Actions (Top Right - Hover Only) */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => handleEditTable(table)}
                      className="p-1.5 rounded-md hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors"
                      title={t('halls.edit')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteTable(table)}
                      className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                      title={t('halls.delete')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>

                  {/* Main Content: Number */}
                  <div className="flex-1 flex flex-col items-center justify-center w-full mt-2">
                    <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 text-amber-500 group-hover:bg-amber-100 group-hover:scale-110 transition-all duration-300 mb-2 ring-1 ring-amber-100 group-hover:ring-amber-200">
                      <span className="text-2xl font-bold">{table.number}</span>
                      {/* Subtle table icon background opacity */}
                      <svg className="absolute inset-0 w-full h-full opacity-10 p-3" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="2" y="8" width="20" height="8" rx="2" />
                        <path d="M4 16v3a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-3" />
                        <path d="M17 16v3a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-3" />
                      </svg>
                    </div>

                    {/* Name/Label */}
                    <div className="text-center px-2 w-full">
                      <p className="text-sm font-medium text-slate-700 truncate group-hover:text-amber-600 transition-colors">
                        {table.name || t('orders.tableDefaultName', { number: table.number })}
                      </p>
                    </div>
                  </div>

                  {/* Status/Footer Line */}
                  <div className="w-12 h-1 rounded-full bg-slate-100 group-hover:bg-amber-200 transition-colors duration-300 mb-1"></div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

