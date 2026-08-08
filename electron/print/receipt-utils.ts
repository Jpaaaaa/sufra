export type ServiceType = 'dine-in' | 'pickup' | 'delivery';

export interface PrintItemOption {
  group_name?: string;
  option_name?: string;
}

export interface KitchenPrintItem {
  id: number;
  item_name: string;
  quantity: number;
  price: number;
  kitchen_id?: number | null;
  service_type?: ServiceType | null;
  options_json?: string | PrintItemOption[] | null;
  /** Per-item kitchen note */
  note?: string | null;
  modifiers?: string[];
}

export interface OrderPrintData {
  orderId: number;
  table: number | string;
  hall: string;
  items: KitchenPrintItem[];
  totals: {
    subtotal?: number;
    discount?: number;
    globalDiscount?: { percent: number; amount: number } | null;
    total: number;
  };
  timestamp: string;
  restaurantName: string;
  logoUrl?: string;
  kitchenName?: string;
  note?: string | null;
  printTarget?: 'KITCHEN' | 'CUSTOMER';
  service_type?: ServiceType;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  // Extended kitchen fields (optional — omitted when empty)
  floor?: string | null;
  section?: string | null;
  seat?: string | null;
  waiter?: string | null;
  cashier?: string | null;
  guests?: number | string | null;
  priority?: boolean;
  reprintCount?: number;
  printTime?: string;
  paperWidth?: 58 | 80;
}

export interface ReceiptPrintItem {
  order_id: number;
  item_name: string;
  quantity: number;
  price: number;
  service_type?: ServiceType | null;
  discount?: number | null;
  options_json?: string | PrintItemOption[] | null;
}

export interface ReceiptPrintData {
  orderId?: number;
  invoiceNumber?: string | number | null;
  table: number | string;
  hall: string;
  items: ReceiptPrintItem[];
  totals: {
    subtotal?: number;
    globalDiscount?: { percent: number; amount: number } | null;
    tax?: number | null;
    serviceCharge?: number | null;
    total: number;
  };
  timestamp: string;
  restaurantName: string;
  logoUrl?: string;
  /** When true, do not fall back to the built-in Sufra logo. */
  skipDefaultLogo?: boolean;
  address?: string | null;
  phone?: string | null;
  taxNumber?: string | null;
  website?: string | null;
  thankYouMessage?: string | null;
  paymentMethod?: string;
  paidAmount?: number | null;
  remaining?: number | null;
  change?: number | null;
  printTarget?: 'KITCHEN' | 'CUSTOMER';
  service_type?: ServiceType;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  floor?: string | null;
  section?: string | null;
  waiter?: string | null;
  cashier?: string | null;
  paperWidth?: 58 | 80;
}

/** @deprecated use registerArabicFontIfAvailable from canvas/fonts */
export function getRegisteredArabicFont(): string {
  return 'Arial';
}

/** @deprecated use wrapText from canvas/text */
export function wrapText(_ctx: any, text: string, _maxWidth: number): string[] {
  return [text];
}
