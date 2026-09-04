'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { ShelfItem } from '../../hooks/useShelves';
import { fetchJson, getServerUrl } from '../../utils';
import { showToast } from '../ui/Toast';
import { useShelvesRefresh } from '../../contexts/ShelvesRefreshContext';
import { useGlobalNumericField } from '../../contexts/GlobalNumericKeypadContext';

interface ScannedItem {
  barcode: string;
  name: string;
  price: number;
  quantity: number;
  availableStock: number;
}

type ModalMode = 'sell' | 'add';

interface NewItemFormData {
  barcode: string;
  name: string;
  price: string;
  quantity: string;
  isInfinite: boolean;
  shelf: string;
}

interface GlobalShelfSaleModalData {
  mode: ModalMode;
  item: ShelfItem | null;
  barcode?: string; // For add mode
  onClose: () => void;
  onSaleComplete?: () => void;
}

let currentModal: GlobalShelfSaleModalData | null = null;
let modalUpdateCallback: ((modal: GlobalShelfSaleModalData | null) => void) | null = null;
let scannedItemsUpdateCallback: ((updater: ScannedItem[] | ((prev: ScannedItem[]) => ScannedItem[])) => void) | null = null;
let scannedItems: ScannedItem[] = [];

// Reset scanned items when modal is closed
function resetScannedItems() {
  scannedItems = [];
  if (scannedItemsUpdateCallback) {
    scannedItemsUpdateCallback([]);
  }
}

export function showGlobalShelfSaleModal(item: ShelfItem, mode: ModalMode = 'sell'): Promise<void> {
  return new Promise((resolve) => {
    // If modal is already open in sell mode, add item to scanned items
    if (currentModal && currentModal.mode === 'sell' && mode === 'sell' && scannedItemsUpdateCallback) {
      const existingIndex = scannedItems.findIndex((si) => si.barcode === item.barcode);
      
      if (existingIndex >= 0) {
        // If exists, increment quantity (update stock from latest item data)
        const existing = scannedItems[existingIndex];
        const newAvailableStock = item.quantity; // Get latest stock from server
        if (existing.quantity >= newAvailableStock) {
          showToast(i18n.t('shelves.toastAvailableStock', { count: newAvailableStock }), 'error');
          return;
        }
        scannedItems = scannedItems.map((si, index) =>
          index === existingIndex
            ? { ...si, quantity: si.quantity + 1, availableStock: newAvailableStock }
            : si
        );
        scannedItemsUpdateCallback([...scannedItems]);
        showToast(i18n.t('shelves.toastQuantityIncreased', { name: item.name }), 'success');
        return;
      } else {
        // New item, add to list
        if (item.quantity <= 0) {
          showToast(i18n.t('shelves.toastOutOfStock'), 'error');
          return;
        }
        scannedItems.push({
          barcode: item.barcode,
          name: item.name,
          price: item.price ?? 0,
          quantity: 1,
          availableStock: item.quantity,
        });
        scannedItemsUpdateCallback([...scannedItems]);
        showToast(i18n.t('shelves.toastProductAdded', { name: item.name }), 'success');
        return;
      }
    }

    // First time opening modal - initialize with the scanned item
    scannedItems = [{
      barcode: item.barcode,
      name: item.name,
      price: item.price ?? 0,
      quantity: 1,
      availableStock: item.quantity,
    }];

    const modal: GlobalShelfSaleModalData = {
      mode,
      item,
      onClose: () => {
        resetScannedItems();
        currentModal = null;
        if (modalUpdateCallback) {
          modalUpdateCallback(null);
        }
        resolve();
      },
      onSaleComplete: () => {
        resetScannedItems();
        currentModal = null;
        if (modalUpdateCallback) {
          modalUpdateCallback(null);
        }
        resolve();
      },
    };
    currentModal = modal;
    if (modalUpdateCallback) {
      modalUpdateCallback(modal);
    }
    if (scannedItemsUpdateCallback) {
      scannedItemsUpdateCallback([...scannedItems]);
    }
  });
}

// New function to open modal in add mode
export function showGlobalShelfAddModal(barcode: string): Promise<void> {
  return new Promise((resolve) => {
    // If modal is already open in add mode, update the barcode (this will trigger form reset via useEffect)
    if (currentModal && currentModal.mode === 'add') {
      currentModal.barcode = barcode;
      if (modalUpdateCallback) {
        modalUpdateCallback({ ...currentModal });
      }
      return;
    }

    // If modal is open in sell mode, close it first
    if (currentModal && currentModal.mode === 'sell') {
      if (currentModal.onClose) {
        currentModal.onClose();
      }
    }

    const modal: GlobalShelfSaleModalData = {
      mode: 'add',
      item: null,
      barcode,
      onClose: () => {
        currentModal = null;
        if (modalUpdateCallback) {
          modalUpdateCallback(null);
        }
        resolve();
      },
      onSaleComplete: () => {
        currentModal = null;
        if (modalUpdateCallback) {
          modalUpdateCallback(null);
        }
        resolve();
      },
    };
    currentModal = modal;
    if (modalUpdateCallback) {
      modalUpdateCallback(modal);
    }
  });
}

export function GlobalShelfSaleModalContainer() {
  const { t } = useTranslation();
  const [modal, setModal] = useState<GlobalShelfSaleModalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentScannedItems, setCurrentScannedItems] = useState<ScannedItem[]>([]);
  const [newItemForm, setNewItemForm] = useState<NewItemFormData>({
    barcode: '',
    name: '',
    price: '',
    quantity: '1',
    isInfinite: true, // Default to infinite
    shelf: '',
  });
  const { triggerRefresh } = useShelvesRefresh();

  const newItemPriceField = useGlobalNumericField(newItemForm.price, (next) =>
    setNewItemForm((prev) => ({ ...prev, price: next })),
  );
  const newItemQtyField = useGlobalNumericField(newItemForm.quantity, (next) =>
    setNewItemForm((prev) => ({ ...prev, quantity: next })),
  );

  useEffect(() => {
    modalUpdateCallback = (newModal: GlobalShelfSaleModalData | null) => {
      setModal(newModal);
      if (!newModal) {
        // Modal closed, reset scanned items
        setCurrentScannedItems([]);
      } else {
        // Modal opened, sync with global scannedItems state
        setCurrentScannedItems([...scannedItems]);
      }
    };

    scannedItemsUpdateCallback = (updater: ScannedItem[] | ((prev: ScannedItem[]) => ScannedItem[])) => {
      if (typeof updater === 'function') {
        setCurrentScannedItems(updater);
      } else {
        setCurrentScannedItems(updater);
      }
    };

    if (currentModal) {
      setModal(currentModal);
      setCurrentScannedItems([...scannedItems]);
      
      // Initialize form for add mode
      if (currentModal.mode === 'add' && currentModal.barcode) {
        setNewItemForm({
          barcode: currentModal.barcode,
          name: '',
          price: '',
          quantity: '1',
          isInfinite: true, // Default to infinite
          shelf: '',
        });
      }
    }

    return () => {
      modalUpdateCallback = null;
      scannedItemsUpdateCallback = null;
    };
  }, []);

  // Update form when modal changes
  useEffect(() => {
    if (modal && modal.mode === 'add' && modal.barcode) {
      setNewItemForm({
        barcode: modal.barcode,
        name: '',
        price: '',
        quantity: '1',
        isInfinite: true, // Default to infinite - resets for each new barcode
        shelf: '',
      });
    }
  }, [modal]);

  const handleRemoveItem = useCallback((barcode: string) => {
    const updated = currentScannedItems.filter((item) => item.barcode !== barcode);
    setCurrentScannedItems(updated);
    scannedItems = updated;
    showToast(i18n.t('shelves.toastItemRemoved'), 'success');
  }, [currentScannedItems]);

  const handleQuantityChange = useCallback((barcode: string, quantity: number) => {
    if (quantity < 1) {
      handleRemoveItem(barcode);
      return;
    }
    const updated = currentScannedItems.map((item) => {
      if (item.barcode === barcode) {
        // Check stock limit
        if (quantity > item.availableStock) {
          showToast(i18n.t('shelves.toastAvailableStock', { count: item.availableStock }), 'error');
          return item;
        }
        return { ...item, quantity };
      }
      return item;
    });
    setCurrentScannedItems(updated);
    scannedItems = updated;
  }, [currentScannedItems, handleRemoveItem]);

  const handleConfirm = useCallback(async () => {
    if (modal?.mode === 'add') {
      // Handle add mode: save new item
      if (!newItemForm.name.trim() || !newItemForm.price.trim()) {
        showToast(i18n.t('shelves.toastFillRequired'), 'error');
        return;
      }

      const priceValue = Number(newItemForm.price);
      
      if (isNaN(priceValue) || priceValue < 0) {
        showToast(i18n.t('shelves.toastInvalidPrice'), 'error');
        return;
      }

      // If not infinite, validate quantity
      let quantityValue: number;
      if (newItemForm.isInfinite) {
        // Use a very large number for infinite (or handle differently in backend)
        quantityValue = 999999;
      } else {
        quantityValue = Number(newItemForm.quantity);
        if (isNaN(quantityValue) || quantityValue < 0 || !Number.isInteger(quantityValue)) {
          showToast(i18n.t('shelves.toastQtyInteger'), 'error');
          return;
        }
      }

      setLoading(true);
      try {
        const serverUrl = getServerUrl();
        await fetchJson<ShelfItem>(`${serverUrl}/shelves`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            barcode: newItemForm.barcode.trim(),
            name: newItemForm.name.trim(),
            price: priceValue,
            quantity: quantityValue,
          }),
        });

        showToast(i18n.t('shelves.toastItemSaved'), 'success');
        triggerRefresh();

        // Reset form and close
        setNewItemForm({
          barcode: '',
          name: '',
          price: '',
          quantity: '1',
          isInfinite: true, // Reset to infinite default
          shelf: '',
        });

        if (modal?.onSaleComplete) {
          modal.onSaleComplete();
        }
      } catch (e: any) {
        console.error(e);
        const errorMsg = e.message || i18n.t('shelves.toastSaveItemError');
        showToast(errorMsg, 'error');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Handle sell mode
    if (currentScannedItems.length === 0) {
      showToast(i18n.t('shelves.toastNoItemsForSale'), 'error');
      return;
    }

    setLoading(true);
    try {
      const serverUrl = getServerUrl();
      
      // Sell all items sequentially
      for (const item of currentScannedItems) {
        await fetchJson<{ item: ShelfItem; sale: any }>(`${serverUrl}/shelves/sell`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ barcode: item.barcode, quantity: item.quantity }),
        });
      }

      showToast(i18n.t('shelves.toastSaleDone'), 'success');

      // Trigger refresh of shelves inventory cache
      triggerRefresh();

      // Reset and close
      resetScannedItems();
      if (modal?.onSaleComplete) {
        modal.onSaleComplete();
      }
    } catch (e: any) {
      console.error(e);
      const errorMsg = e.message || i18n.t('shelves.toastSaleError');
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  }, [currentScannedItems, modal, newItemForm, triggerRefresh]);

  const handleClose = useCallback(() => {
    resetScannedItems();
    if (modal?.onClose) {
      modal.onClose();
    }
  }, [modal]);

  // Calculate totals
  const uniqueCount = useMemo(() => currentScannedItems.length, [currentScannedItems.length]);
  const totalQuantity = useMemo(
    () => currentScannedItems.reduce((sum, item) => sum + item.quantity, 0),
    [currentScannedItems]
  );
  const subtotals = useMemo(
    () => currentScannedItems.map((item) => (item.price ?? 0) * item.quantity),
    [currentScannedItems]
  );
  const total = useMemo(
    () => subtotals.reduce((sum, subtotal) => sum + subtotal, 0),
    [subtotals]
  );

  if (!modal) return null;
  
  // For sell mode, require item
  if (modal.mode === 'sell' && !modal.item) return null;
  
  // For add mode, require barcode
  if (modal.mode === 'add' && !modal.barcode) return null;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-obsidian/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl rounded-soft-xl border border-black/5 bg-white shadow-soft texture-surface max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-black/5 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-soft-lg bg-cyber-aqua/10">
                <span className="text-[20px] leading-tight font-bold text-cyber-aqua">📦</span>
              </div>
              <h3 className="text-[20px] leading-tight font-semibold text-obsidian">
                {modal.mode === 'sell' ? t('shelves.globalModalTitleSell') : t('shelves.globalModalTitleAdd')}
              </h3>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="text-obsidian/70 hover:text-obsidian disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {modal.mode === 'add' ? (
            /* Add Mode - Editable Form */
            <div className="overflow-hidden rounded-soft-xl border border-black/5 bg-white shadow-soft">
              <div className="max-h-[400px] overflow-auto">
                <table className="min-w-full divide-y divide-black/[0.06] text-[15px] leading-normal">
                  <thead className="bg-cloud-soft-white sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-right text-[13px] leading-relaxed font-bold text-obsidian">
                        {t('shelves.catalogItemName')}
                      </th>
                      <th className="px-4 py-3 text-right text-[13px] leading-relaxed font-bold text-obsidian">
                        {t('shelves.barcode')}
                      </th>
                      <th className="px-4 py-3 text-right text-[13px] leading-relaxed font-bold text-obsidian">
                        {t('shelves.price')}
                      </th>
                      <th className="px-4 py-3 text-right text-[13px] leading-relaxed font-bold text-obsidian">
                        {t('shelves.quantity')}
                      </th>
                      <th className="px-4 py-3 text-right text-[13px] leading-relaxed font-bold text-obsidian">
                        {t('shelves.colShelf')}
                      </th>
                      <th className="px-4 py-3 text-left text-[13px] leading-relaxed font-bold text-obsidian">
                        {t('shelves.colActions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.06] bg-white">
                    <tr className="hover:bg-cloud-soft-white/50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <input
                          type="text"
                          value={newItemForm.name}
                          onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                          className="w-full rounded-soft border border-black/5 bg-white px-3 py-2 text-[15px] leading-normal text-obsidian focus:outline-none focus:border-cyber-aqua focus:ring-2 focus:ring-cyber-aqua/10"
                          placeholder={t('shelves.placeholderItemName')}
                          autoFocus
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <input
                          type="text"
                          value={newItemForm.barcode}
                          readOnly
                          className="w-full rounded-soft border border-black/5 bg-cloud-soft-white px-3 py-2 text-[15px] leading-normal font-mono text-obsidian/70 cursor-not-allowed"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={newItemForm.price}
                          onChange={(e) => setNewItemForm({ ...newItemForm, price: e.target.value })}
                          onFocus={newItemPriceField.onFocus}
                          className="w-full rounded-soft border border-black/5 bg-white px-3 py-2 text-[15px] leading-normal text-obsidian focus:outline-none focus:border-cyber-aqua focus:ring-2 focus:ring-cyber-aqua/10"
                          placeholder="0"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setNewItemForm({ ...newItemForm, isInfinite: !newItemForm.isInfinite })}
                            className={`flex items-center gap-1.5 rounded-soft border px-3 py-2 text-[13px] leading-relaxed font-bold ${
                              newItemForm.isInfinite
                                ? 'border-cyber-aqua bg-cyber-aqua/10 text-cyber-aqua'
                                : 'border-black/10 bg-white text-obsidian/70 hover:bg-cloud-soft-white'
                            }`}
                            title={
                              newItemForm.isInfinite
                                ? t('shelves.qtyUnlimitedTitle')
                                : t('shelves.qtyLimitedTitle')
                            }
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2.5}
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 12a3 3 0 11-6 0 3 3 0 016 0zm0 0a3 3 0 106 0 3 3 0 00-6 0z"
                              />
                            </svg>
                            <span>{t('shelves.unlimited')}</span>
                          </button>
                          {!newItemForm.isInfinite && (
                            <input
                              type="text"
                              inputMode="numeric"
                              min="0"
                              step="1"
                              value={newItemForm.quantity}
                              onChange={(e) => setNewItemForm({ ...newItemForm, quantity: e.target.value })}
                              onFocus={newItemQtyField.onFocus}
                              className="flex-1 rounded-soft border border-black/5 bg-white px-3 py-2 text-[15px] leading-normal text-obsidian focus:outline-none focus:border-cyber-aqua focus:ring-2 focus:ring-cyber-aqua/10"
                              placeholder="1"
                            />
                          )}
                          {newItemForm.isInfinite && (
                            <div className="flex-1 rounded-soft border border-cyber-aqua/30 bg-cyber-aqua/5 px-3 py-2 text-[15px] leading-normal font-bold text-cyber-aqua flex items-center justify-center gap-2">
                              <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2.5}
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M9 12a3 3 0 11-6 0 3 3 0 016 0zm0 0a3 3 0 106 0 3 3 0 00-6 0z"
                                />
                              </svg>
                              <span>{t('shelves.unlimited')}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <input
                          type="text"
                          value={newItemForm.shelf}
                          onChange={(e) => setNewItemForm({ ...newItemForm, shelf: e.target.value })}
                          className="w-full rounded-soft border border-black/5 bg-white px-3 py-2 text-[15px] leading-normal text-obsidian focus:outline-none focus:border-cyber-aqua focus:ring-2 focus:ring-cyber-aqua/10"
                          placeholder={t('shelves.shelfOptionalPlaceholder')}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            setNewItemForm({
                              barcode: modal.barcode || '',
                              name: '',
                              price: '',
                              quantity: '1',
                              isInfinite: true, // Reset to infinite default
                              shelf: '',
                            });
                          }}
                          disabled={loading}
                          className="rounded-soft-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-[13px] leading-relaxed font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                          title={t('shelves.resetForm')}
                        >
                          {t('shelves.resetForm')}
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Info area instead of totals */}
              <div className="border-t border-black/5 bg-cloud-soft-white px-6 py-4">
                <p className="text-[15px] leading-normal font-light text-obsidian/70 text-center">
                  {t('shelves.addToStockAfterSave')}
                </p>
              </div>
            </div>
          ) : currentScannedItems.length > 0 ? (
            <div className="overflow-hidden rounded-soft-xl border border-black/5 bg-white shadow-soft">
              <div className="max-h-[400px] overflow-auto">
                <table className="min-w-full divide-y divide-black/[0.06] text-[15px] leading-normal">
                  <thead className="bg-cloud-soft-white sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-right text-[13px] leading-relaxed font-bold text-obsidian">
                        {t('shelves.itemName')}
                      </th>
                      <th className="px-4 py-3 text-right text-[13px] leading-relaxed font-bold text-obsidian">
                        {t('shelves.barcode')}
                      </th>
                      <th className="px-4 py-3 text-right text-[13px] leading-relaxed font-bold text-obsidian">
                        {t('shelves.price')}
                      </th>
                      <th className="px-4 py-3 text-right text-[13px] leading-relaxed font-bold text-obsidian">
                        {t('shelves.quantity')}
                      </th>
                      <th className="px-4 py-3 text-right text-[13px] leading-relaxed font-bold text-obsidian">
                        {t('shelves.colSubtotal')}
                      </th>
                      <th className="px-4 py-3 text-left text-[13px] leading-relaxed font-bold text-obsidian">
                        {t('shelves.colActions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.06] bg-white">
                    {currentScannedItems.map((item, index) => {
                      const price = item.price ?? 0;
                      const subtotal = price * item.quantity;
                      return (
                        <tr key={`${item.barcode}-${index}`} className="hover:bg-cloud-soft-white/50">
                          <td className="whitespace-nowrap px-4 py-3 text-[15px] leading-normal font-bold text-obsidian">
                            {item.name}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-[15px] leading-normal font-mono text-obsidian/70">
                            {item.barcode}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-[15px] leading-normal font-bold text-obsidian">
                            {t('halls.priceWithCurrency', {
                              price: Math.round(price).toString(),
                              currency: t('orders.currency'),
                            })}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.quantity > 1) {
                                    handleQuantityChange(item.barcode, item.quantity - 1);
                                  }
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-soft border border-black/10 bg-white text-obsidian hover:bg-cloud-soft-white disabled:opacity-50"
                                disabled={item.quantity <= 1 || loading}
                              >
                                <span className="text-[16px] font-bold">−</span>
                              </button>
                              <span className="inline-flex items-center rounded-soft-lg px-3 py-1 text-[15px] leading-relaxed font-bold bg-cyber-aqua/10 text-cyber-aqua min-w-[3rem] justify-center">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(item.barcode, item.quantity + 1)}
                                className="flex h-8 w-8 items-center justify-center rounded-soft border border-black/10 bg-white text-obsidian hover:bg-cloud-soft-white disabled:opacity-50"
                                disabled={item.quantity >= item.availableStock || loading}
                              >
                                <span className="text-[16px] font-bold">+</span>
                              </button>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-[15px] leading-normal font-bold text-cyber-aqua">
                            {t('halls.priceWithCurrency', {
                              price: Math.round(subtotal).toString(),
                              currency: t('orders.currency'),
                            })}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.barcode)}
                              disabled={loading}
                              className="rounded-soft-lg border border-red-300 bg-red-50 px-3 py-1.5 text-[13px] leading-relaxed font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                              title={t('halls.delete')}
                            >
                              {t('halls.delete')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="border-t border-black/5 bg-cloud-soft-white px-6 py-4 space-y-3">
                <div className="flex items-center justify-between" dir="rtl">
                  <span className="text-[15px] leading-normal font-bold text-obsidian">
                    {t('shelves.itemsLineCount')}
                  </span>
                  <span className="text-[16px] leading-tight font-bold text-obsidian">
                    {uniqueCount}
                  </span>
                </div>
                <div className="flex items-center justify-between" dir="rtl">
                  <span className="text-[15px] leading-normal font-bold text-obsidian">
                    {t('shelves.totalUnits')}
                  </span>
                  <span className="text-[16px] leading-tight font-bold text-obsidian">
                    {totalQuantity}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-black/10 pt-3" dir="rtl">
                  <span className="text-[18px] leading-tight font-bold text-obsidian">
                    {t('shelves.grandTotal')}
                  </span>
                  <span className="text-[24px] leading-tight font-bold text-cyber-aqua">
                    {t('halls.priceWithCurrency', {
                      price: Math.round(total).toString(),
                      currency: t('orders.currency'),
                    })}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-soft-xl border border-dashed border-black/5 text-[15px] leading-normal font-light text-obsidian/60 bg-white/50">
              {t('shelves.emptyScannedList')}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-black/5 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-soft-lg border border-black/5 bg-white px-5 py-2.5 text-[15px] leading-normal font-bold text-obsidian hover:bg-cloud-soft-white shadow-soft disabled:opacity-50"
          >
            {t('halls.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || (modal.mode === 'sell' && currentScannedItems.length === 0)}
            className="rounded-soft-lg px-5 py-2.5 text-[15px] leading-normal font-bold text-white shadow-soft hover:shadow-soft  bg-cyber-aqua hover:bg-cyber-aqua/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? t('shelves.processing')
              : modal.mode === 'add'
                ? t('shelves.saveItemButton')
                : t('shelves.confirmSaleButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
