'use client';

import { useTranslation } from 'react-i18next';
import { getServerUrl } from '../../lib/server-config';
import { useGlobalNumericField } from '../../contexts/GlobalNumericKeypadContext';

import ItemOptionsSection from './ItemOptionsSection';
import type { Item } from '../../hooks/useItems';

interface Category {
  id: number;
  name: string;
}

interface Kitchen {
  id: number;
  name: string;
}

interface ItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
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
    has_options: boolean;
    option_groups: import('../../lib/item-options').ItemOptionGroupDraft[];
  };
  setFormState: React.Dispatch<React.SetStateAction<ItemFormModalProps['formState']>>;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  loading: boolean;
  categories: Category[];
  kitchens: Kitchen[];
  allItems: Item[];
}

function getItemImageUrl(imageUrl?: string | null) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('file://') || imageUrl.startsWith('file:/')) return null;
  if (imageUrl.startsWith('/uploads/')) return `${getServerUrl()}${imageUrl}`;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('/')) {
    return imageUrl;
  }
  return null;
}

export default function ItemFormModal({
  isOpen,
  onClose,
  formState,
  setFormState,
  handleSubmit,
  loading,
  categories,
  kitchens,
  allItems,
}: ItemFormModalProps) {
  const { t, i18n } = useTranslation();
  const priceField = useGlobalNumericField(formState.price, (next) =>
    setFormState((prev) => ({ ...prev, price: next })),
  );

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[9999] bg-obsidian/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed left-1/2 top-1/2 z-[10000] w-[min(640px,95vw)] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        dir={i18n.dir()}
      >
        <div className="max-h-[90vh] overflow-y-auto p-6">
          <h3 className="mb-4 text-[20px] font-bold text-obsidian">
            {formState.id ? t('catalog.modalEditItem') : t('catalog.modalAddItem')}
          </h3>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-[15px] font-bold text-obsidian">{t('catalog.itemName')}</label>
              <input
                type="text"
                className="input-soft w-full"
                value={formState.name}
                onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t('catalog.itemNamePlaceholder')}
              />
            </div>
            <div>
              <label className="mb-2 block text-[15px] font-bold text-obsidian">
                {t('catalog.priceLabel', { currency: t('orders.currency') })}
              </label>
              <input
                type="text"
                inputMode="decimal"
                className="input-soft w-full"
                value={formState.price}
                onChange={(e) => setFormState((prev) => ({ ...prev, price: e.target.value }))}
                onFocus={priceField.onFocus}
                placeholder="50"
              />
            </div>
            <div>
              <label className="mb-2 block text-[15px] font-bold text-obsidian">{t('catalog.category')}</label>
              <select
                className="input-soft w-full"
                value={formState.categoryId}
                onChange={(e) => setFormState((prev) => ({ ...prev, categoryId: e.target.value }))}
              >
                <option value="">{t('catalog.selectCategory')}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-[15px] font-bold text-obsidian">{t('catalog.kitchen')}</label>
              <select
                className="input-soft w-full"
                value={formState.kitchen_id}
                onChange={(e) => setFormState((prev) => ({ ...prev, kitchen_id: e.target.value }))}
              >
                <option value="">{t('catalog.selectKitchen')}</option>
                {kitchens.map((k) => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-4">
              <label className="mb-2 block text-[15px] font-bold text-obsidian">{t('catalog.description')}</label>
              <textarea
                value={formState.description ?? ''}
                onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={t('catalog.descriptionPlaceholder')}
                rows={2}
                className="input-soft w-full resize-none"
              />
            </div>
            <div className="md:col-span-4">
              <label className="mb-2 block text-[15px] font-bold text-obsidian">{t('catalog.itemImage')}</label>
              <div className="space-y-3">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        alert(t('catalog.alertFileTooBig'));
                        return;
                      }
                      if (!file.type.match(/^image\/(jpg|jpeg|png|gif|webp)$/)) {
                        alert(t('catalog.alertFileType'));
                        return;
                      }
                      const formData = new FormData();
                      formData.append('image', file);
                      try {
                        const serverUrl = getServerUrl();
                        const token = localStorage.getItem('sufra_auth_token');
                        const res = await fetch(`${serverUrl}/items/upload`, {
                          method: 'POST',
                          headers: token ? { Authorization: `Bearer ${token}` } : {},
                          body: formData,
                        });
                        if (!res.ok) {
                          const text = await res.text();
                          console.error('[items/upload]', res.status, text);
                          let message = t('catalog.uploadFailedHttp', { status: res.status });
                          try {
                            const body = JSON.parse(text) as {
                              error?: string;
                              message?: string | string[];
                              details?: string;
                            };
                            if (typeof body.error === 'string' && body.error) {
                              message = t('catalog.uploadFailedWith', { message: body.error });
                            } else if (body.message) {
                              message = t('catalog.uploadFailedWith', {
                                message: Array.isArray(body.message) ? body.message.join(', ') : body.message,
                              });
                            }
                            if (import.meta.env.DEV && body.details) {
                              console.error('[items/upload] details:', body.details);
                            }
                          } catch {
                            const trimmed = text.trim();
                            if (trimmed) {
                              message = t('catalog.uploadFailedWith', {
                                message: `${trimmed.slice(0, 280)}${trimmed.length > 280 ? '…' : ''}`,
                              });
                            }
                          }
                          throw new Error(message);
                        }
                        const data = await res.json();
                        setFormState((prev) => ({ ...prev, image_url: data.imageUrl }));
                      } catch (err) {
                        console.error(err);
                        const msg =
                          err instanceof Error
                            ? err.message
                            : t('catalog.uploadFailedRetry');
                        alert(msg);
                      }
                    }}
                  />
                  <div className="flex cursor-pointer items-center justify-center gap-2 rounded-soft border-2 border-dashed border-cyber-aqua/30 bg-cyber-aqua/5 px-4 py-3 text-[15px] font-medium text-obsidian hover:border-cyber-aqua hover:bg-cyber-aqua/10">
                    <svg className="h-5 w-5 text-cyber-aqua" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{t('catalog.chooseImageFile')}</span>
                  </div>
                </label>
                {formState.image_url && (
                  <div className="relative inline-block">
                    <img
                      src={getItemImageUrl(formState.image_url) || ''}
                      alt="Preview"
                      className="h-32 w-32 rounded-soft border border-black/5 object-cover shadow-soft"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <button
                      type="button"
                      onClick={() => setFormState((prev) => ({ ...prev, image_url: '' }))}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                      title={t('catalog.removeImage')}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
            <ItemOptionsSection
              formState={formState}
              setFormState={setFormState}
              allItems={allItems}
              loading={loading}
            />
            <div className="md:col-span-4">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={formState.is_out_of_stock}
                  onChange={(e) => setFormState((prev) => ({ ...prev, is_out_of_stock: e.target.checked }))}
                  className="h-5 w-5 cursor-pointer rounded border-black/20 text-cyber-aqua focus:ring-2 focus:ring-cyber-aqua/20"
                />
                <span className="text-[15px] font-bold text-obsidian">{t('catalog.outOfStock')}</span>
              </label>
            </div>
            <div className="flex gap-3 md:col-span-4 md:justify-end">
              <button type="button" onClick={onClose} className="btn-ghost">
                {t('halls.cancel')}
              </button>
              <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
                {formState.id ? t('halls.update') : t('halls.save')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
