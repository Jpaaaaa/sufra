import type { Item } from './useItems';
import type { ShelfItem } from './useShelves';
import type { SelectedItemOptions } from '../lib/item-options';

export interface Category {
  id: number;
  name: string;
  sort_order?: number;
  is_menu_active?: boolean;
}

export interface ExistingOrder {
  id: number;
  order_type: 'dine-in' | 'pickup' | 'delivery';
  status: 'pending' | 'printed' | 'completed' | 'cancelled' | 'draft' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'archived' | 'open';
  total: number;
  discount?: number;
  globalDiscount?: string | { percent: number; amount: number };
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
  cartLineId: string;
  item: Item;
  quantity: number;
  selectedOptions: SelectedItemOptions;
  linePrice: number;
  order_type?: 'dine-in' | 'pickup';
  shelfItem?: ShelfItem;
  offerDisplayName?: string;
}
