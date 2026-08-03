'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type ItemOptionGroupDraft,
  apiGroupsToDraft,
  createTemplateGroup,
  draftGroupsToApi,
  calculateLinePrice,
  formatItemDisplayName,
  getDefaultSelections,
} from '../../lib/item-options';
import type { Item, ItemFormState } from '../../hooks/useItems';

interface ItemOptionsSectionProps {
  formState: Pick<ItemFormState, 'id' | 'name' | 'price' | 'has_options' | 'option_groups'>;
  setFormState: React.Dispatch<React.SetStateAction<ItemFormState>>;
  allItems: Item[];
  loading: boolean;
}

export default function ItemOptionsSection({
  formState,
  setFormState,
  allItems,
  loading,
}: ItemOptionsSectionProps) {
  const { t } = useTranslation();

  const preview = useMemo(() => {
    if (!formState.has_options || !formState.option_groups.length) return null;
    const groups = draftGroupsToApi(formState.option_groups);
    const basePrice = Number(formState.price) || 0;
    const selected = getDefaultSelections(groups);
    const linePrice = calculateLinePrice(basePrice, groups, selected);
    const displayName = formatItemDisplayName(formState.name || t('catalog.itemName'), selected);
    return { displayName, linePrice };
  }, [formState.has_options, formState.option_groups, formState.price, formState.name, t]);

  const copySources = allItems.filter((i) => i.id !== formState.id && i.has_options);

  const addTemplate = (template: 'sizes' | 'flavors' | 'extras') => {
    setFormState((prev) => ({
      ...prev,
      has_options: true,
      option_groups: [
        ...prev.option_groups,
        createTemplateGroup(template, prev.option_groups.length, t),
      ],
    }));
  };

  const updateGroup = (index: number, patch: Partial<ItemOptionGroupDraft>) => {
    setFormState((prev) => ({
      ...prev,
      option_groups: prev.option_groups.map((g, i) => (i === index ? { ...g, ...patch } : g)),
    }));
  };

  const removeGroup = (index: number) => {
    setFormState((prev) => {
      const next = prev.option_groups.filter((_, i) => i !== index);
      return { ...prev, option_groups: next, has_options: next.length > 0 };
    });
  };

  const moveGroup = (index: number, dir: -1 | 1) => {
    setFormState((prev) => {
      const next = [...prev.option_groups];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return {
        ...prev,
        option_groups: next.map((g, i) => ({ ...g, sort_order: i })),
      };
    });
  };

  const updateOption = (
    groupIndex: number,
    optionIndex: number,
    patch: Partial<ItemOptionGroupDraft['options'][number]>,
  ) => {
    setFormState((prev) => ({
      ...prev,
      option_groups: prev.option_groups.map((g, gi) =>
        gi !== groupIndex
          ? g
          : {
              ...g,
              options: g.options.map((o, oi) => (oi === optionIndex ? { ...o, ...patch } : o)),
            },
      ),
    }));
  };

  const addOption = (groupIndex: number) => {
    setFormState((prev) => ({
      ...prev,
      option_groups: prev.option_groups.map((g, gi) =>
        gi !== groupIndex
          ? g
          : {
              ...g,
              options: [
                ...g.options,
                {
                  name: '',
                  price: g.pricing_mode === 'inherit' ? '0' : '',
                  is_default: false,
                  is_out_of_stock: false,
                  sort_order: g.options.length,
                },
              ],
            },
      ),
    }));
  };

  const removeOption = (groupIndex: number, optionIndex: number) => {
    setFormState((prev) => ({
      ...prev,
      option_groups: prev.option_groups.map((g, gi) =>
        gi !== groupIndex
          ? g
          : { ...g, options: g.options.filter((_, oi) => oi !== optionIndex) },
      ),
    }));
  };

  const setDefaultOption = (groupIndex: number, optionIndex: number) => {
    setFormState((prev) => ({
      ...prev,
      option_groups: prev.option_groups.map((g, gi) =>
        gi !== groupIndex
          ? g
          : {
              ...g,
              options: g.options.map((o, oi) => ({ ...o, is_default: oi === optionIndex })),
            },
      ),
    }));
  };

  const handleCopyFrom = async (sourceId: number) => {
    if (!formState.id) return;
    try {
      const { fetchJson, getServerUrl } = await import('../../utils');
      const item = await fetchJson<Item>(
        `${getServerUrl()}/items/${formState.id}/copy-options-from/${sourceId}`,
        { method: 'POST' },
      );
      setFormState((prev) => ({
        ...prev,
        has_options: Boolean(item.has_options),
        option_groups: apiGroupsToDraft(item.option_groups),
      }));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="md:col-span-4 space-y-4 rounded-xl border border-black/10 bg-cloud-soft-white/50 p-4">
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={formState.has_options}
          onChange={(e) =>
            setFormState((prev) => ({
              ...prev,
              has_options: e.target.checked,
              option_groups: e.target.checked ? prev.option_groups : [],
            }))
          }
          className="h-5 w-5 cursor-pointer rounded border-black/20 text-cyber-aqua focus:ring-2 focus:ring-cyber-aqua/20"
        />
        <span className="text-[15px] font-bold text-obsidian">{t('catalog.itemHasOptions')}</span>
      </label>

      {formState.has_options && (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => addTemplate('sizes')} className="btn-ghost text-[13px]">
              {t('catalog.templateSizes')}
            </button>
            <button type="button" onClick={() => addTemplate('flavors')} className="btn-ghost text-[13px]">
              {t('catalog.templateFlavors')}
            </button>
            <button type="button" onClick={() => addTemplate('extras')} className="btn-ghost text-[13px]">
              {t('catalog.templateExtras')}
            </button>
          </div>

          {formState.id && copySources.length > 0 && (
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-obsidian/70">
                {t('catalog.copyOptionsFrom')}
              </label>
              <select
                className="input-soft w-full max-w-sm"
                defaultValue=""
                onChange={(e) => {
                  const id = Number(e.target.value);
                  if (id) void handleCopyFrom(id);
                  e.target.value = '';
                }}
                disabled={loading}
              >
                <option value="">{t('catalog.selectItem')}</option>
                {copySources.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formState.option_groups.map((group, gi) => (
            <div key={gi} className="rounded-lg border border-black/10 bg-white p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  className="input-soft flex-1 min-w-[120px]"
                  value={group.name}
                  onChange={(e) => updateGroup(gi, { name: e.target.value })}
                  placeholder={t('catalog.optionGroupName')}
                />
                <button type="button" onClick={() => moveGroup(gi, -1)} className="btn-ghost px-2 text-[12px]">
                  {t('catalog.moveUp')}
                </button>
                <button type="button" onClick={() => moveGroup(gi, 1)} className="btn-ghost px-2 text-[12px]">
                  {t('catalog.moveDown')}
                </button>
                <button
                  type="button"
                  onClick={() => removeGroup(gi)}
                  className="text-[12px] font-bold text-red-600 hover:text-red-700"
                >
                  {t('catalog.removeOptionGroup')}
                </button>
              </div>

              <div className="space-y-2">
                {group.options.map((opt, oi) => (
                  <div key={oi} className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      className="input-soft flex-1 min-w-[100px]"
                      value={opt.name}
                      onChange={(e) => updateOption(gi, oi, { name: e.target.value })}
                      placeholder={t('catalog.optionName')}
                    />
                    {group.pricing_mode !== 'inherit' && (
                      <input
                        type="text"
                        inputMode="decimal"
                        className="input-soft w-24"
                        value={opt.price}
                        onChange={(e) => updateOption(gi, oi, { price: e.target.value })}
                        placeholder={group.pricing_mode === 'add' ? '+0' : '0'}
                      />
                    )}
                    {group.max_select === 1 && group.min_select >= 1 && (
                      <label className="flex items-center gap-1 text-[12px] whitespace-nowrap">
                        <input
                          type="radio"
                          name={`default-${gi}`}
                          checked={opt.is_default}
                          onChange={() => setDefaultOption(gi, oi)}
                        />
                        {t('catalog.defaultOption')}
                      </label>
                    )}
                    <label className="flex items-center gap-1 text-[12px] whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={opt.is_out_of_stock}
                        onChange={(e) => updateOption(gi, oi, { is_out_of_stock: e.target.checked })}
                      />
                      {t('catalog.optionOutOfStock')}
                    </label>
                    <button
                      type="button"
                      onClick={() => removeOption(gi, oi)}
                      className="text-red-500 text-[12px]"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addOption(gi)} className="text-[13px] text-cyber-aqua font-bold">
                  + {t('catalog.addOption')}
                </button>
              </div>
            </div>
          ))}

          {preview && (
            <p className="text-[14px] text-obsidian/80 rounded-lg bg-cyber-aqua/10 px-3 py-2">
              {t('catalog.optionsPreview', {
                name: preview.displayName,
                price: preview.linePrice.toLocaleString(),
                currency: t('orders.currency'),
              })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
