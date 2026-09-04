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
  /** Daily ticket number for the business day (preferred for display). */
  display_number?: number | null;
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
  /** Default 'item'. Tray is a container of children. */
  lineKind?: 'item' | 'tray';
  trayName?: string;
  /** Products inside a tray (only when lineKind === 'tray'). */
  children?: CartItem[];
  /**
   * Locked tray (e.g. fixed combo): children are read-only in the cart.
   * Sale price lives on the tray header (`linePrice`) only.
   */
  trayLocked?: boolean;
  /** Source combo id when this tray was built from a fixed combo. */
  comboId?: number;
  item: Item;
  quantity: number;
  selectedOptions: SelectedItemOptions;
  linePrice: number;
  order_type?: 'dine-in' | 'pickup';
  shelfItem?: ShelfItem;
  offerDisplayName?: string;
}
