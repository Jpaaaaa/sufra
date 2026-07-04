'use client';

import { useTranslation } from 'react-i18next';
import { Hall } from '../../utils';

import { Floor } from '../../hooks/useFloors';
import { useGlobalNumericField } from '../../contexts/GlobalNumericKeypadContext';

interface HallsManagementProps {
  halls: Hall[];
  floors: Floor[];
  loading: boolean;
  error: string | null;
  formState: {
    id?: number;
    name: string;
    number: string;
    floor_id?: number | null;
  };
  setFormState: React.Dispatch<React.SetStateAction<{
    id?: number;
    name: string;
    number: string;
    floor_id?: number | null;
  }>>;
  isFormOpen: boolean;
  setIsFormOpen: (open: boolean) => void;
  resetForm: () => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleEdit: (hall: Hall) => void;
  handleDelete: (hall: Hall) => Promise<void>;
  onViewTables: (hall: Hall) => void;
}

export default function HallsManagement({
  halls,
  floors,
  loading,
  error,
  formState,
  setFormState,
  isFormOpen,
  setIsFormOpen,
  resetForm,
  handleSubmit,
  handleEdit,
  handleDelete,
  onViewTables,
}: HallsManagementProps) {
  const { t } = useTranslation();
  const hallNumberField = useGlobalNumericField(formState.number, (next) =>
    setFormState((prev) => ({ ...prev, number: next })),
  );

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] leading-tight font-semibold text-obsidian">
            {t('halls.hallsTitle')}
          </h2>
          <p className="text-[15px] leading-normal font-light text-obsidian/70">
            {t('halls.hallsSubtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsFormOpen(true);
          }}
          className="rounded-soft-lg bg-cyber-aqua px-5 py-3 text-[15px] leading-normal font-bold text-white shadow-soft hover:bg-cyber-aqua/90 hover:shadow-soft"
        >
          {t('halls.addHall')}
        </button>
      </div>

      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="grid gap-4 rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft md:grid-cols-4"
        >
          <div className="md:col-span-1">
            <label className="block mb-2 text-[15px] leading-normal font-bold text-obsidian">
              {t('halls.hallName')}
            </label>
            <input
              type="text"
              className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] leading-normal text-obsidian focus:outline-none focus:border-cyber-aqua focus:ring-2 focus:ring-olive-gold/10"
              value={formState.name}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  name: e.target.value,
                }))
              }
            />
          </div>
          <div className="md:col-span-1">
            <label className="block mb-2 text-[15px] leading-normal font-bold text-obsidian">
              {t('halls.hallNumber')}
            </label>
            <input
              type="text"
              inputMode="numeric"
              className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] leading-normal text-obsidian focus:outline-none focus:border-cyber-aqua focus:ring-2 focus:ring-olive-gold/10"
              value={formState.number}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  number: e.target.value,
                }))
              }
              onFocus={hallNumberField.onFocus}
            />
          </div>
          <div className="md:col-span-1">
            <label className="block mb-2 text-[15px] leading-normal font-bold text-obsidian">
              {t('halls.floor')}
            </label>
            <select
              className="w-full rounded-soft border border-black/5 bg-white px-4 py-3 text-[15px] leading-normal text-obsidian focus:outline-none focus:border-cyber-aqua focus:ring-2 focus:ring-olive-gold/10"
              value={formState.floor_id || ''}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  floor_id: e.target.value ? Number(e.target.value) : null,
                }))
              }
            >
              <option value="">{t('halls.noFloor')}</option>
              {floors.map((floor) => (
                <option key={floor.id} value={floor.id}>
                  {t('halls.floorOptionLabel', { name: floor.name, number: floor.number })}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-3 md:col-span-1 md:justify-end">
            <button
              type="submit"
              disabled={loading}
              className="rounded-soft-lg bg-cyber-aqua px-5 py-3 text-[15px] leading-normal font-bold text-white shadow-soft hover:bg-cyber-aqua/90 disabled:opacity-50 hover:shadow-soft"
            >
              {formState.id ? t('halls.update') : t('halls.save')}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-soft-lg border border-black/5 bg-white px-5 py-3 text-[15px] leading-normal font-bold text-obsidian hover:bg-cloud-soft-white shadow-soft"
            >
              {t('halls.cancel')}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="rounded-soft-lg border border-red-300 bg-red-50 px-4 py-3 text-[15px] leading-normal font-bold text-red-700 shadow-soft">
          {error}
        </div>
      )}

      {loading && halls.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-soft-xl border border-dashed border-black/5 text-[15px] leading-normal font-light text-obsidian/60 bg-white/50">
          {t('halls.loadingHalls')}
        </div>
      ) : halls.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-soft-xl border border-dashed border-black/5 text-[15px] leading-normal font-light text-obsidian/60 bg-white/50">
          {t('halls.emptyHalls')}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {halls.map((hall) => (
            <div
              key={hall.id}
              className="group relative overflow-hidden rounded-2xl bg-white p-1 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all duration-300 ring-1 ring-black/5 hover:ring-cyber-aqua/50"
            >
              {/* Top accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyber-aqua/40 to-cyan-500/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative flex flex-col h-full bg-slate-50/50 rounded-xl p-5">
                {/* Header: Number & Edit Actions */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white shadow-sm ring-1 ring-black/5 text-xl font-bold text-cyber-aqua group-hover:scale-110 transition-transform duration-300">
                    {hall.number}
                  </div>

                  {/* Action Menu (Visible on hover) */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 transform translate-x-2 group-hover:translate-x-0">
                    <button
                      onClick={() => handleEdit(hall)}
                      className="p-2 rounded-lg hover:bg-white hover:text-cyan-600 text-slate-400 transition-colors"
                      title={t('halls.edit')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(hall)}
                      className="p-2 rounded-lg hover:bg-white hover:text-red-600 text-slate-400 transition-colors"
                      title={t('halls.delete')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-cyber-aqua transition-colors">
                    {hall.name}
                  </h3>

                  <div className="flex flex-col gap-2 mt-3">
                    {/* Floor Badge */}
                    {hall.floor && (
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                          <polyline points="9 10 4 15 9 20" />
                          <path d="M20 4v7a4 4 0 0 1-4 4H4" />
                        </svg>
                        <span>{hall.floor.name}</span>
                      </div>
                    )}

                    {/* Tables Count */}
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                        <path d="M3 3h18v18H3zM12 8v8M8 12h8" />
                      </svg>
                      <span>{t('halls.tablesCount', { count: hall.tablesCount ?? 0 })}</span>
                    </div>
                  </div>
                </div>

                {/* Main Action Button */}
                <button
                  onClick={() => onViewTables(hall)}
                  className="mt-5 w-full py-2.5 px-4 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:text-white hover:bg-cyber-aqua hover:border-cyber-aqua transition-all duration-300 shadow-sm flex items-center justify-center gap-2 group/btn"
                >
                  <span>{t('halls.manageTables')}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transform group-hover/btn:-translate-x-1 transition-transform">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

