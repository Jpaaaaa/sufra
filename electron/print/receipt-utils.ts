// Stub: Font registration removed (canvas library no longer used)
export function getRegisteredArabicFont(): string {
  return 'Arial';
}

export interface OrderPrintData {
  orderId: number;
  table: number;
  hall: string;
  items: Array<{
    id: number;
    item_name: string;
    quantity: number;
    price: number;
    kitchen_id?: number | null;
    service_type?: 'dine-in' | 'pickup' | 'delivery' | null;
  }>;
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
  service_type?: 'dine-in' | 'pickup' | 'delivery';
  // Customer info for delivery orders
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
}

export interface ReceiptPrintData {
  orderId?: number;
  table: number;
  hall: string;
  items: Array<{
    order_id: number;
    item_name: string;
    quantity: number;
    price: number;
    service_type?: 'dine-in' | 'pickup' | 'delivery' | null;
  }>;
  totals: {
    subtotal?: number;
    globalDiscount?: { percent: number; amount: number } | null;
    total: number;
  };
  timestamp: string;
  restaurantName: string;
  logoUrl?: string;
  paymentMethod?: string; // Payment method (e.g., "نقد", "بطاقة", etc.)
  printTarget?: 'KITCHEN' | 'CUSTOMER';
  service_type?: 'dine-in' | 'pickup' | 'delivery';
  // Customer info for delivery orders
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
}

/**
 * Stub: Text wrapping helper removed (canvas library no longer used)
 */
export function wrapText(_ctx: any, text: string, _maxWidth: number): string[] {
  // Simple stub: return text as single line
  return [text];
}

