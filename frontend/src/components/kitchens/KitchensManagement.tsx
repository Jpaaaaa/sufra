'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Kitchen } from '../../utils';
import { Floor } from '../../hooks/useFloors';
import { getServerUrl, fetchJson } from '../../utils';

interface KitchensManagementProps {
  kitchens: Kitchen[];
  floors: Floor[];
  loading: boolean;
  error: string | null;
  formState: {
    id?: number;
    name: string;
    description: string;
    floor_id?: number | null;
  };
  setFormState: React.Dispatch<React.SetStateAction<{
    id?: number;
    name: string;
    description: string;
    floor_id?: number | null;
  }>>;
  isFormOpen: boolean;
  setIsFormOpen: (open: boolean) => void;
  resetForm: () => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleEdit: (kitchen: Kitchen) => void;
  handleDelete: (kitchen: Kitchen) => Promise<void>;
  toggleActive: (kitchen: Kitchen) => Promise<void>;
}

interface KitchenItem {
  id: number;
  name: string;
  price: number;
  service_types?: ('dine-in' | 'pickup')[];
  available_for_pickup?: boolean;
  available_for_dine_in?: boolean;
}

export default function KitchensManagement({
  kitchens,
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
  toggleActive,
}: KitchensManagementProps) {
  const { t } = useTranslation();
  const [kitchenItems, setKitchenItems] = useState<Record<number, KitchenItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<Record<number, boolean>>({});
  const [expandedKitchens, setExpandedKitchens] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Load items for all kitchens
    const loadKitchenItems = async () => {
      const itemsMap: Record<number, KitchenItem[]> = {};
      const loadingMap: Record<number, boolean> = {};
      
      for (const kitchen of kitchens) {
        loadingMap[kitchen.id] = true;
        try {
          const serverUrl = getServerUrl();
          const items = await fetchJson<KitchenItem[]>(`${serverUrl}/kitchens/${kitchen.id}/items`);
          itemsMap[kitchen.id] = items || [];
        } catch (e) {
          console.error(`Failed to load items for kitchen ${kitchen.id}:`, e);
          itemsMap[kitchen.id] = [];
        } finally {
          loadingMap[kitchen.id] = false;
        }
      }
      
      setKitchenItems(itemsMap);
      setLoadingItems(loadingMap);
    };

    if (kitchens.length > 0) {
      void loadKitchenItems();
    }
  }, [kitchens]);

  const toggleKitchenExpanded = (kitchenId: number) => {
    setExpandedKitchens((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(kitchenId)) {
        newSet.delete(kitchenId);
      } else {
        newSet.add(kitchenId);
      }
      return newSet;
    });
  };

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] leading-normal font-semibold text-slate-900">
            {t('halls.kitchensTitle')}
          </h2>
          <p className="text-[13px] leading-relaxed text-slate-500">
            {t('halls.kitchensSubtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsFormOpen(true);
          }}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-[15px] leading-normal font-medium text-white shadow-sm hover:bg-emerald-700"
        >
          {t('halls.addKitchen')}
        </button>
      </div>

      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4"
        >
          <div className="md:col-span-1">
            <label className="block text-[13px] leading-relaxed font-medium text-slate-700">
              {t('halls.kitchenName')}
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] leading-normal focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={formState.name}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                placeholder={t('halls.kitchenNamePlaceholder')}
              />
            </label>
          </div>
          <div className="md:col-span-1">
            <label className="block text-[13px] leading-relaxed font-medium text-slate-700">
              {t('halls.descriptionOptional')}
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] leading-normal focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={formState.description}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder={t('halls.descriptionPlaceholder')}
              />
            </label>
          </div>
          <div className="md:col-span-1">
            <label className="block text-[13px] leading-relaxed font-medium text-slate-700">
              {t('halls.floor')}
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] leading-normal focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
            </label>
          </div>
          <div className="flex items-end gap-2 md:col-span-1 md:justify-end">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-[15px] leading-normal font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {formState.id ? t('halls.updateKitchen') : t('halls.saveKitchen')}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-[15px] leading-normal font-medium text-slate-700 hover:bg-slate-50"
            >
              {t('halls.cancel')}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] leading-relaxed text-red-700">
          {error}
        </div>
      )}

      {loading && kitchens.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 text-[15px] leading-normal text-slate-500">
          {t('halls.loadingKitchens')}
        </div>
      ) : kitchens.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 text-[15px] leading-normal text-slate-500">
          {t('halls.emptyKitchens')}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {kitchens.map((kitchen) => (
            <div
              key={kitchen.id}
              className="group relative flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm hover:border-orange-400 hover:shadow-lg"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-[24px] leading-tight font-bold text-orange-700">
                {kitchen.name.substring(0, 2)}
              </div>
              <div className="text-center">
                <h3 className="text-[20px] leading-tight font-semibold text-slate-900">
                  {kitchen.name}
                </h3>
                {kitchen.floor && (
                  <p className="text-[13px] leading-relaxed font-medium text-emerald-600 mb-1">
                    {kitchen.floor.name}
                  </p>
                )}
                {kitchen.description && (
                  <p className="text-[13px] leading-relaxed text-slate-500">
                    {kitchen.description}
                  </p>
                )}
                <div className="mt-1 flex items-center justify-center gap-1">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      kitchen.is_active ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  />
                  <span className="text-[13px] leading-relaxed text-slate-600">
                    {kitchen.is_active ? t('halls.statusActive') : t('halls.statusInactive')}
                  </span>
                </div>
                {/* Items count */}
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => toggleKitchenExpanded(kitchen.id)}
                    className="text-[12px] leading-relaxed text-slate-500 hover:text-slate-700"
                  >
                    {t('halls.itemsCountToggle', { count: kitchenItems[kitchen.id]?.length || 0 })}
                    {expandedKitchens.has(kitchen.id) ? ' ▲' : ' ▼'}
                  </button>
                </div>
              </div>
              
              {/* Expanded items list */}
              {expandedKitchens.has(kitchen.id) && (
                <div className="mt-2 w-full border-t border-slate-200 pt-2">
                  {loadingItems[kitchen.id] ? (
                    <div className="text-center text-[12px] text-slate-500">{t('halls.loadingShort')}</div>
                  ) : kitchenItems[kitchen.id] && kitchenItems[kitchen.id].length > 0 ? (
                    <div className="max-h-32 space-y-1 overflow-y-auto">
                      {kitchenItems[kitchen.id].map((item) => {
                        const hasPickup = item.available_for_pickup || item.service_types?.includes('pickup');
                        const hasDineIn = item.available_for_dine_in !== false && (item.available_for_dine_in || item.service_types?.includes('dine-in') || !item.service_types);
                        
                        const serviceTypeBadges: ('dineIn' | 'pickup')[] = [];
                        if (hasDineIn) {
                          serviceTypeBadges.push('dineIn');
                        }
                        if (hasPickup) {
                          serviceTypeBadges.push('pickup');
                        }

                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between rounded bg-slate-50 px-2 py-1.5 text-[12px]"
                          >
                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                              <span className="text-slate-700 font-medium truncate">{item.name}</span>
                              <div className="flex flex-wrap gap-1">
                                {serviceTypeBadges.length > 0 ? (
                                  serviceTypeBadges.map((badgeKey) => (
                                    <span
                                      key={badgeKey}
                                      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                        badgeKey === 'pickup'
                                          ? 'bg-orange-100 text-orange-700'
                                          : 'bg-green-100 text-green-700'
                                      }`}
                                    >
                                      {badgeKey === 'pickup'
                                        ? t('halls.badgePickup')
                                        : t('halls.badgeDineIn')}
                                    </span>
                                  ))
                                ) : (
                                  <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600">
                                    {t('halls.badgeDineIn')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="font-medium text-emerald-600 ml-2 whitespace-nowrap">
                              {t('halls.priceWithCurrency', {
                                price: item.price,
                                currency: t('orders.currency'),
                              })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center text-[12px] text-slate-400">
                      {t('halls.noKitchenItems')}
                    </div>
                  )}
                </div>
              )}
              
              <div className="mt-2 flex flex-wrap justify-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleActive(kitchen)}
                  className={`rounded-lg px-3 py-1.5 text-[13px] leading-relaxed font-medium ${
                    kitchen.is_active
                      ? 'border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {kitchen.is_active ? t('halls.toggleDeactivate') : t('halls.toggleActivate')}
                </button>
                <button
                  type="button"
                  onClick={() => handleEdit(kitchen)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] leading-relaxed font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('halls.edit')}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(kitchen)}
                  className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-[13px] leading-relaxed font-medium text-red-700 hover:bg-red-100"
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

