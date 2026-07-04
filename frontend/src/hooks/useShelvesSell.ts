import { useState, useEffect, useCallback } from 'react';
import { fetchJson, getServerUrl } from '../utils';
import { ShelfItem } from './useShelves';
import { showToast } from '../components/ui/Toast';

export interface ShelfSale {
  id: number;
  shelf_item_id: number;
  quantity: number;
  price: number;
  created_at: string;
  item_name: string;
  item_barcode: string;
}

export function useShelvesSell() {
  const [todaySales, setTodaySales] = useState<ShelfSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTodaySales = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const serverUrl = getServerUrl();
      const sales = await fetchJson<ShelfSale[]>(`${serverUrl}/shelves/sales/today`);
      setTodaySales(sales);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'تعذر تحميل المبيعات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTodaySales();
  }, [loadTodaySales]);

  const sellItem = useCallback(async (barcode: string, quantity: number = 1) => {
    setLoading(true);
    setError(null);
    try {
      const serverUrl = getServerUrl();
      const result = await fetchJson<{ item: ShelfItem; sale: ShelfSale }>(`${serverUrl}/shelves/sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode, quantity }),
      });
      
      showToast(`تم بيع ${result.item.name} بنجاح`, 'success');
      await loadTodaySales();
      return result;
    } catch (e: any) {
      console.error(e);
      const errorMsg = e.message || 'حدث خطأ أثناء البيع';
      setError(errorMsg);
      showToast(errorMsg, 'error');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [loadTodaySales]);

  return {
    todaySales,
    loading,
    error,
    sellItem,
    loadTodaySales,
  };
}

