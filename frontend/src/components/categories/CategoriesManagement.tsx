'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutList, Package, Hash, Search } from 'lucide-react';
import { Category } from '../../hooks/useCategories';
import CategorySortModal from './CategorySortModal';
import { sortCategoriesAdminDisplay } from '../../utils/admin-catalog-sort';

interface CategoriesManagementProps {
  categories: Category[];
  loading: boolean;
  error: string | null;
  formState: {
    id?: number;
    name: string;
  };
  setFormState: React.Dispatch<React.SetStateAction<{
    id?: number;
    name: string;
  }>>;
  isFormOpen: boolean;
  setIsFormOpen: (open: boolean) => void;
  resetForm: () => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleEdit: (category: Category) => void;
  handleDelete: (category: Category) => Promise<void>;
  reorderCategories: (ids: number[]) => Promise<void>;
  onCategoriesOrderSaved?: () => void;
  toggleCategoryMenuActive: (category: Category) => Promise<void>;
}

export default function CategoriesManagement({
  categories,
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
  reorderCategories,
  onCategoriesOrderSaved,
  toggleCategoryMenuActive,
}: CategoriesManagementProps) {
  const { t } = useTranslation();
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const sortedCategories = useMemo(
    () => sortCategoriesAdminDisplay(categories),
    [categories],
  );

  const filteredSortedCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedCategories;
    return sortedCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [sortedCategories, searchQuery]);

  const handleSaveOrder = async (ids: number[]) => {
    await reorderCategories(ids);
    onCategoriesOrderSaved?.();
  };

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[20px] leading-tight font-semibold text-obsidian">
            {t('catalog.categoriesTitle')}
          </h2>
          <p className="text-[15px] leading-normal font-light text-obsidian/70">
            {t('catalog.categoriesSubtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSortModalOpen(true)}
            disabled={categories.length < 2}
            className="inline-flex items-center gap-2 rounded-soft-lg border border-black/10 bg-white px-4 py-3 text-[15px] font-bold text-obsidian shadow-soft hover:border-cyber-aqua/40 hover:bg-cloud-soft-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <LayoutList size={18} className="text-cyber-aqua" />
            {t('catalog.sortCategories')}
          </button>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setIsFormOpen(true);
            }}
            className="rounded-soft-lg bg-cyber-aqua px-5 py-3 text-[15px] leading-normal font-bold text-white shadow-soft hover:bg-cyber-aqua/90 hover:shadow-soft"
          >
            {t('catalog.addCategory')}
          </button>
        </div>
      </div>

      <CategorySortModal
        open={sortModalOpen}
        categories={categories}
        loading={loading}
        onClose={() => setSortModalOpen(false)}
        onSave={handleSaveOrder}
      />

      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="grid gap-4 rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft md:grid-cols-2"
        >
          <div className="md:col-span-1">
            <label className="mb-2 block text-[15px] leading-normal font-bold text-obsidian">
              {t('catalog.categoryName')}
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
              placeholder={t('catalog.categoryPlaceholder')}
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

      {loading && categories.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-soft-xl border border-dashed border-black/5 text-[15px] leading-normal font-light text-obsidian/60 bg-white/50">
          {t('catalog.loadingCategories')}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-soft-xl border border-dashed border-black/5 text-[15px] leading-normal font-light text-obsidian/60 bg-white/50">
          {t('catalog.emptyCategories')}
        </div>
      ) : (
        <>
          <div className="relative w-full">
            <Search
              className="pointer-events-none absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-obsidian/35"
              aria-hidden
            />
            <input
              type="search"
              autoComplete="off"
              placeholder={t('catalog.searchCategory')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-soft-lg border border-black/5 bg-white py-3 pl-4 pr-11 text-[15px] leading-normal text-obsidian shadow-soft focus:outline-none focus:border-cyber-aqua focus:ring-2 focus:ring-cyber-aqua/10"
            />
          </div>

          {filteredSortedCategories.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-soft-xl border border-dashed border-black/5 text-[15px] leading-normal font-light text-obsidian/60 bg-white/50">
              {t('catalog.searchNoCategories')}
            </div>
          ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSortedCategories.map((category, index) => (
            <div
              key={category.id}
              className={`group relative flex flex-col overflow-hidden rounded-soft-xl border bg-white p-4 shadow-soft transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] ${
                category.is_menu_active
                  ? 'border-black/5 hover:border-cyber-aqua/35'
                  : 'border-amber-200/80 ring-1 ring-amber-100/80 hover:border-amber-300/60'
              }`}
            >
              <div className="absolute start-0 top-0 h-1 w-full bg-gradient-to-l from-cyber-aqua/50 to-cyan-500/30 opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-soft-lg bg-cyber-aqua/10 text-[15px] font-bold text-cyber-aqua">
                    {category.name.substring(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-[16px] font-bold text-obsidian">{category.name}</h3>
                      {!category.is_menu_active && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-[9px] font-bold text-gray-700">
                          {t('catalog.notOnMenu')}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-col gap-1.5 text-[12px] font-medium text-obsidian/55">
                      <div className="flex items-center gap-2">
                        <Hash size={13} className="shrink-0 text-cyber-aqua/70" />
                        <span>
                          {t('catalog.orderPosition', {
                            position: index + 1,
                            total: filteredSortedCategories.length,
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package size={13} className="shrink-0 text-cyber-aqua/70" />
                        <span>
                          {t('catalog.categoryItems', { count: category.item_count })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleEdit(category)}
                    className="rounded-soft-lg border border-black/5 bg-white px-2.5 py-1.5 text-[12px] font-bold text-obsidian hover:bg-cloud-soft-white"
                    title={t('halls.edit')}
                  >
                    {t('halls.edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(category)}
                    className="rounded-soft-lg border border-red-300 bg-red-50 px-2.5 py-1.5 text-[12px] font-bold text-red-700 hover:bg-red-100"
                    title={t('halls.delete')}
                  >
                    {t('halls.delete')}
                  </button>
                </div>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => void toggleCategoryMenuActive(category)}
                className={`mt-4 w-full rounded-soft-lg py-2.5 text-[13px] font-bold transition-colors ${
                  category.is_menu_active
                    ? 'border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                    : 'border border-cyber-aqua/35 bg-cyber-aqua/10 text-cyber-aqua hover:bg-cyber-aqua/15'
                }`}
              >
                {category.is_menu_active
                  ? t('catalog.hideFromOrderMenu')
                  : t('catalog.showInOrderMenu')}
              </button>
            </div>
          ))}
        </div>
          )}
        </>
      )}
    </div>
  );
}
