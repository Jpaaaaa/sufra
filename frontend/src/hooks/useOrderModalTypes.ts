import type { Item } from './useItems';
import type { ShelfItem } from './useShelves';

export interface Category {
  id: number;
  name: string;
  sort_order?: number;
  /** When false, hidden from POS menu (admin still sees in settings). */
  is_menu_active?: boolean;
}

export interface ExistingOrder {
  id: number;
  order_type: 'dine-in' | 'pickup' | 'delivery';
  status: 'pending' | 'printed' | 'completed' | 'cancelled' | 'draft' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'archived' | 'open';
  total: number;
  discount?: number;
  globalDiscount?: string | { percent: number; amount: number };
  /** Delivery aggregator (Talabat, Toters, …) — snapshot on order */
  delivery_platform_id?: number | null;
  delivery_platform_name?: string | null;
  delivery_platform_commission_percent?: number | null;
  items: any[];
  created_at: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_location?: string | null;
  customer_address?: string | null;
  note?: string;
}

export interface CartItem {
  item: Item;
  quantity: number;
  order_type?: 'dine-in' | 'pickup';
  shelfItem?: ShelfItem;
  /** When set, show this in the cart instead of item.name (e.g. "عرض اليوم") */
  offerDisplayName?: string;
}
