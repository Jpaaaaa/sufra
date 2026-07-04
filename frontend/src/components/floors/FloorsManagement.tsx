'use client';

import { useTranslation } from 'react-i18next';
import { Floor } from '../../hooks/useFloors';
import { useGlobalNumericField } from '../../contexts/GlobalNumericKeypadContext';

interface FloorsManagementProps {
  floors: Floor[];
  loading: boolean;
  error: string | null;
  formState: {
    id?: number;
    name: string;
    number: string;
  };
  setFormState: React.Dispatch<React.SetStateAction<{
    id?: number;
    name: string;
    number: string;
  }>>;
  isFormOpen: boolean;
  setIsFormOpen: (open: boolean) => void;
  resetForm: () => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleEdit: (floor: Floor) => void;
  handleDelete: (floor: Floor) => Promise<void>;
}

export default function FloorsManagement({
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
}: FloorsManagementProps) {
  const { t } = useTranslation();
  const floorNumberField = useGlobalNumericField(formState.number, (next) =>
    setFormState((prev) => ({ ...prev, number: next })),
  );

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] leading-tight font-semibold text-obsidian">
            {t('halls.floorTitle')}
          </h2>
          <p className="text-[15px] leading-normal font-light text-obsidian/70">
            {t('halls.floorSubtitle')}
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
          {t('halls.addFloor')}
        </button>
      </div>

      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="grid gap-4 rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft md:grid-cols-3"
        >
          <div className="md:col-span-1">
            <label className="block mb-2 text-[15px] leading-normal font-bold text-obsidian">
              {t('halls.floorName')}
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
              {t('halls.floorNumber')}
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
              onFocus={floorNumberField.onFocus}
            />
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

      {loading && floors.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-soft-xl border border-dashed border-black/5 text-[15px] leading-normal font-light text-obsidian/60 bg-white/50">
          {t('halls.loadingFloors')}
        </div>
      ) : floors.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-soft-xl border border-dashed border-black/5 text-[15px] leading-normal font-light text-obsidian/60 bg-white/50">
          {t('halls.emptyFloors')}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {floors.map((floor) => (
            <div
              key={floor.id}
              className="group relative flex aspect-square flex-col items-center justify-center gap-4 rounded-soft-xl border-2 border-black/5 bg-white p-6 shadow-soft hover:border-cyber-aqua hover:shadow-soft"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-soft-lg bg-cyber-aqua/10 text-[28px] leading-tight font-bold text-cyber-aqua">
                {floor.number}
              </div>
              <div className="text-center">
                <h3 className="text-[20px] leading-tight font-semibold text-obsidian">
                  {floor.name}
                </h3>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleEdit(floor)}
                  className="rounded-soft-lg border border-black/5 bg-white px-3 py-2 text-[13px] leading-relaxed font-bold text-obsidian hover:bg-cloud-soft-white shadow-soft"
                >
                  {t('halls.edit')}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(floor)}
                  className="rounded-soft-lg border border-red-300 bg-red-50 px-3 py-2 text-[13px] leading-relaxed font-bold text-red-700 hover:bg-red-100"
                >
                  {t('halls.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

