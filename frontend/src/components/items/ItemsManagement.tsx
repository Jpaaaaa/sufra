'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Item } from '../../hooks/useItems';
import { getServerUrl } from '../../lib/server-config';
import { Category } from '../../hooks/useCategories';
import { Kitchen } from '../../utils';
import ItemFormModal from './ItemFormModal';
import ItemMenuToggleButton from './ItemMenuToggleButton';
import ItemAdminBadges from './ItemAdminBadges';
import { sortItemsAdminDisplay } from '../../utils/admin-catalog-sort';

interface ItemsManagementProps {
  items: Item[];
  categories: Category[];
  kitchens: Kitchen[];
  loading: boolean;
  error: string | null;
  formState: {
    id?: number;
    name: string;
    price: string;
    categoryId: string;
    kitchen_id: string;
    image_url?: string;
    description: string;
    is_out_of_stock: boolean;
    hidden_from_menu: boolean;
  };
  setFormState: React.Dispatch<React.SetStateAction<{
    id?: number;
    name: string;
    price: string;
    categoryId: string;
    kitchen_id: string;
    image_url?: string;
    description: string;
    is_out_of_stock: boolean;
    hidden_from_menu: boolean;
  }>>;
  isFormOpen: boolean;
  setIsFormOpen: (open: boolean) => void;
  resetForm: () => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleEdit: (item: Item) => void;
  handleDelete: (item: Item) => Promise<void>;
  toggleItemHiddenFromMenu: (item: Item) => Promise<void>;
}

export default function ItemsManagement({
  items,
  categories,
  kitchens,
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
  toggleItemHiddenFromMenu,
}: ItemsManagementProps) {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const getCategoryName = (categoryId?: number | null) => {
    if (!categoryId) return '—';
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.name || '—';
  };

  const getKitchenName = (kitchenId?: number | null) => {
    if (!kitchenId) return '—';
    const kitchen = kitchens.find((k) => k.id === kitchenId);
    return kitchen?.name || '—';
  };

  const getItemImageUrl = (imageUrl?: string | null) => {
    if (!imageUrl) return null;
    
    // Block local file:// URLs for security reasons
    if (imageUrl.startsWith('file://') || imageUrl.startsWith('file:/')) {
      return null;
    }
    
    if (imageUrl.startsWith('/uploads/')) {
      return `${getServerUrl()}${imageUrl}`;
    }
    
    // Only allow http/https URLs or relative paths
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('/')) {
      return imageUrl;
    }
    
    return null;
  };

  // Filter items by category and search
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory = selectedCategory === null || item.categoryId === selectedCategory;
      const matchesSearch = searchQuery === '' || item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  const displayItems = useMemo(
    () => sortItemsAdminDisplay(filteredItems),
    [filteredItems],
  );

  // Group items by category
  const itemsByCategory = useMemo(() => {
    const grouped: { [key: number]: Item[] } = {};
    const uncategorized: Item[] = [];

    displayItems.forEach((item) => {
      if (item.categoryId) {
        if (!grouped[item.categoryId]) {
          grouped[item.categoryId] = [];
        }
        grouped[item.categoryId].push(item);
      } else {
        uncategorized.push(item);
      }
    });

    return { grouped, uncategorized };
  }, [displayItems]);

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] leading-tight font-semibold text-obsidian">
            {t('catalog.itemsTitle')}
          </h2>
          <p className="text-[15px] leading-normal font-light text-obsidian/70">
            {t('catalog.itemsSubtitle')}
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
          {t('catalog.addItem')}
        </button>
      </div>

      <ItemFormModal
        isOpen={isFormOpen}
        onClose={resetForm}
        formState={formState}
        setFormState={setFormState}
        handleSubmit={handleSubmit}
        loading={loading}
        categories={categories}
        kitchens={kitchens}
      />

      {error && (
        <div className="rounded-soft-lg border border-red-300 bg-red-50 px-4 py-3 text-[15px] leading-normal font-bold text-red-700 shadow-soft">
          {error}
        </div>
      )}

      {/* Search and Category Filter */}
      <div className="flex flex-col gap-4">
        <div className="w-full">
          <input
            type="text"
            placeholder={t('catalog.searchItem')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-soft-lg border border-black/5 bg-white px-4 py-3 text-[15px] leading-normal text-obsidian focus:outline-none focus:border-cyber-aqua focus:ring-2 focus:ring-cyber-aqua/10 shadow-soft"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`whitespace-nowrap rounded-full px-5 py-2.5 text-[14px] font-bold shadow-soft hover:shadow-md ${
              selectedCategory === null
                ? 'bg-cyber-aqua text-white shadow-md'
                : 'bg-white text-obsidian border-2 border-cyber-aqua/20 hover:border-cyber-aqua/40 hover:bg-cyber-aqua/5'
            }`}
          >
            {t('catalog.filterAll')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`whitespace-nowrap rounded-full px-5 py-2.5 text-[14px] font-bold shadow-soft hover:shadow-md ${
                selectedCategory === cat.id
                  ? 'bg-cyber-aqua text-white shadow-md'
                  : 'bg-white text-obsidian border-2 border-cyber-aqua/20 hover:border-cyber-aqua/40 hover:bg-cyber-aqua/5'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-soft-xl border border-dashed border-black/5 text-[15px] leading-normal font-light text-obsidian/60 bg-white/50">
          {t('catalog.loadingItems')}
        </div>
      ) : displayItems.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-soft-xl border border-dashed border-black/5 text-[15px] leading-normal font-light text-obsidian/60 bg-white/50">
          {t('catalog.emptyItemsSearch')}
        </div>
      ) : selectedCategory !== null ? (
        // Show items from selected category only (no grouping)
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayItems.map((item) => {
            const imageUrl = getItemImageUrl(item.image_url);
            return (
              <div
                key={item.id}
                className={`group relative bg-white rounded-soft-xl border shadow-soft overflow-hidden hover:shadow-lg ${
                  item.hidden_from_menu || item.is_out_of_stock
                    ? 'border-amber-200/80 ring-1 ring-amber-100/80'
                    : 'border-black/5'
                }`}
              >
                {/* Item Image */}
                <div className="relative h-48 bg-gradient-to-br from-cyber-aqua/10 to-cyber-aqua/5 overflow-hidden">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-16 h-16 text-cyber-aqua/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  {/* Action buttons overlay */}
                  <div className="absolute top-2 left-2 flex gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      className="bg-white/90 backdrop-blur-sm rounded-soft px-3 py-1.5 text-xs font-bold text-obsidian hover:bg-white shadow-soft"
                      title={t('catalog.editItem')}
                    >
                      ✏️ {t('catalog.editItem')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="bg-red-500/90 backdrop-blur-sm rounded-soft px-3 py-1.5 text-xs font-bold text-white hover:bg-red-600 shadow-soft"
                      title={t('catalog.deleteItem')}
                    >
                      🗑️ {t('catalog.deleteItem')}
                    </button>
                  </div>
                </div>

                {/* Item Info */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-[18px] font-bold text-obsidian line-clamp-1">
                      {item.name}
                    </h4>
                    <ItemAdminBadges item={item} />
                  </div>
                  <div className="flex items-center justify-end mb-2">
                    <span className="text-[20px] font-bold text-cyber-aqua">
                      {t('halls.priceWithCurrency', {
                        price: item.price,
                        currency: t('orders.currency'),
                      })}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-black/5">
                    <span className="text-[12px] text-obsidian/50 bg-cloud-soft-white px-2 py-1 rounded-soft">
                      {getCategoryName(item.categoryId)}
                    </span>
                    <span className="text-[12px] text-obsidian/60 bg-cloud-soft-white px-2 py-1 rounded-soft">
                      {t('catalog.kitchenLabel', { name: getKitchenName(item.kitchen_id) })}
                    </span>
                  </div>
                  <ItemMenuToggleButton
                    item={item}
                    loading={loading}
                    onToggle={toggleItemHiddenFromMenu}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Show all items grouped by category (when "All" is selected)
        <div className="space-y-8">
          {/* Items grouped by category */}
          {Object.entries(itemsByCategory.grouped)
            .sort(([idA], [idB]) => {
              const ca = categories.find((c) => c.id === Number(idA));
              const cb = categories.find((c) => c.id === Number(idB));
              return (
                (ca?.sort_order ?? 0) - (cb?.sort_order ?? 0) ||
                Number(idA) - Number(idB)
              );
            })
            .map(([categoryId, categoryItems]) => {
            const category = categories.find((c) => c.id === Number(categoryId));
            return (
              <div key={categoryId} className="space-y-4">
                <h3 className="text-[24px] font-bold text-obsidian border-b-2 border-cyber-aqua pb-2">
                  {category?.name || t('catalog.unknownCategory')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {categoryItems.map((item) => {
                    const imageUrl = getItemImageUrl(item.image_url);
                    return (
                      <div
                        key={item.id}
                        className={`group relative bg-white rounded-soft-xl border shadow-soft overflow-hidden hover:shadow-lg ${
                          item.hidden_from_menu || item.is_out_of_stock
                            ? 'border-amber-200/80 ring-1 ring-amber-100/80'
                            : 'border-black/5'
                        }`}
                      >
                        {/* Item Image */}
                        <div className="relative h-48 bg-gradient-to-br from-cyber-aqua/10 to-cyber-aqua/5 overflow-hidden">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-16 h-16 text-cyber-aqua/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          {/* Action buttons overlay */}
                          <div className="absolute top-2 left-2 flex gap-2 opacity-0 group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => handleEdit(item)}
                              className="bg-white/90 backdrop-blur-sm rounded-soft px-3 py-1.5 text-xs font-bold text-obsidian hover:bg-white shadow-soft"
                              title={t('catalog.editItem')}
                            >
                              ✏️ {t('catalog.editItem')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              className="bg-red-500/90 backdrop-blur-sm rounded-soft px-3 py-1.5 text-xs font-bold text-white hover:bg-red-600 shadow-soft"
                              title={t('catalog.deleteItem')}
                            >
                              🗑️ {t('catalog.deleteItem')}
                            </button>
                          </div>
                        </div>

                        {/* Item Info */}
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-[18px] font-bold text-obsidian line-clamp-1">
                              {item.name}
                            </h4>
                            <ItemAdminBadges item={item} />
                          </div>
                          <div className="flex items-center justify-end mb-2">
                            <span className="text-[20px] font-bold text-cyber-aqua">
                              {t('halls.priceWithCurrency', {
                                price: item.price,
                                currency: t('orders.currency'),
                              })}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-black/5">
                            <span className="text-[12px] text-obsidian/50 bg-cloud-soft-white px-2 py-1 rounded-soft">
                              {getCategoryName(item.categoryId)}
                            </span>
                            <span className="text-[12px] text-obsidian/60 bg-cloud-soft-white px-2 py-1 rounded-soft">
                              {t('catalog.kitchenLabel', { name: getKitchenName(item.kitchen_id) })}
                            </span>
                          </div>
                          <ItemMenuToggleButton
                            item={item}
                            loading={loading}
                            onToggle={toggleItemHiddenFromMenu}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Uncategorized items */}
          {itemsByCategory.uncategorized.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-[24px] font-bold text-obsidian border-b-2 border-cyber-aqua pb-2">
                {t('catalog.uncategorized')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {itemsByCategory.uncategorized.map((item) => {
                  const imageUrl = getItemImageUrl(item.image_url);
                  return (
                    <div
                      key={item.id}
                      className={`group relative bg-white rounded-soft-xl border shadow-soft overflow-hidden hover:shadow-lg ${
                        item.hidden_from_menu || item.is_out_of_stock
                          ? 'border-amber-200/80 ring-1 ring-amber-100/80'
                          : 'border-black/5'
                      }`}
                    >
                      <div className="relative h-48 bg-gradient-to-br from-cyber-aqua/10 to-cyber-aqua/5 overflow-hidden">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Hide broken images gracefully - fallback div will show automatically
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-16 h-16 text-cyber-aqua/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="absolute top-2 left-2 flex gap-2 opacity-0 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => handleEdit(item)}
                            className="bg-white/90 backdrop-blur-sm rounded-soft px-3 py-1.5 text-xs font-bold text-obsidian hover:bg-white shadow-soft"
                            title={t('catalog.editItem')}
                          >
                            ✏️ {t('catalog.editItem')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="bg-red-500/90 backdrop-blur-sm rounded-soft px-3 py-1.5 text-xs font-bold text-white hover:bg-red-600 shadow-soft"
                            title={t('catalog.deleteItem')}
                          >
                            🗑️ {t('catalog.deleteItem')}
                          </button>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-[18px] font-bold text-obsidian line-clamp-1">
                            {item.name}
                          </h4>
                          <ItemAdminBadges item={item} />
                        </div>
                        <div className="flex items-center justify-end mb-2">
                          <span className="text-[20px] font-bold text-cyber-aqua">
                            {t('halls.priceWithCurrency', {
                              price: item.price,
                              currency: t('orders.currency'),
                            })}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-black/5 mb-2">
                          <span className="text-[12px] text-obsidian/50 bg-cloud-soft-white px-2 py-1 rounded-soft">
                            {t('catalog.uncategorized')}
                          </span>
                          <span className="text-[12px] text-obsidian/60 bg-cloud-soft-white px-2 py-1 rounded-soft">
                            {t('catalog.kitchenLabel', { name: getKitchenName(item.kitchen_id) })}
                          </span>
                        </div>
                        <ItemMenuToggleButton
                          item={item}
                          loading={loading}
                          onToggle={toggleItemHiddenFromMenu}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

