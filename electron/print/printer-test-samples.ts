/**
 * Sample payloads for printer settings preview / test print.
 */
export const KITCHEN_TEST_PRINT_DATA = {
  orderId: 999,
  table: 1,
  hall: 'الصالة الرئيسية',
  floor: 'الطابق الأول',
  waiter: 'أحمد',
  cashier: 'سارة',
  items: [
    {
      id: 1,
      item_name: 'وجبة تجريبية طويلة الاسم جداً لاختبار التفاف النص العربي داخل الخلية',
      quantity: 1,
      price: 0,
      options_json: [
        { group_name: 'الحجم', option_name: 'كبير' },
        { group_name: 'إضافات', option_name: 'جبن إضافي' },
      ],
      note: 'بدون بصل',
    },
    {
      id: 2,
      item_name: 'عصير برتقال',
      quantity: 2,
      price: 2500,
      service_type: 'dine-in' as const,
    },
  ],
  totals: { total: 5000 },
  timestamp: new Date().toISOString(),
  restaurantName: 'سفرة',
  kitchenName: 'باريستا',
  note: 'ملاحظة تجريبية على مستوى الطلب',
  service_type: 'dine-in' as const,
  reprintCount: 0,
};

export const CUSTOMER_TEST_RECEIPT_DATA = {
  orderId: 999,
  invoiceNumber: 'INV-999',
  table: 5,
  hall: 'الصالة الرئيسية',
  floor: 'الطابق الأول',
  waiter: 'أحمد',
  cashier: 'سارة',
  address: 'بغداد — الكرادة، شارع أبو نواس',
  phone: '0770 000 0000',
  taxNumber: 'TAX-12345',
  website: 'www.sufra.iq',
  thankYouMessage: 'شكراً لزيارتكم — نتطلع لرؤيتكم مجدداً',
  items: [
    {
      order_id: 999,
      item_name: 'وجبة تجريبية طويلة لاختبار التفاف النص',
      quantity: 1,
      price: 10000,
      discount: 0,
      service_type: 'dine-in' as const,
    },
    {
      order_id: 999,
      item_name: 'مشروب',
      quantity: 2,
      price: 2500,
      discount: 500,
      service_type: 'dine-in' as const,
    },
  ],
  totals: {
    subtotal: 15000,
    globalDiscount: { percent: 10, amount: 1500 },
    tax: 0,
    serviceCharge: 0,
    total: 13500,
  },
  timestamp: new Date().toISOString(),
  restaurantName: 'سفرة',
  paymentMethod: 'نقد',
  paidAmount: 15000,
  change: 1500,
  remaining: 0,
  service_type: 'dine-in' as const,
};

export function kitchenTestPrintData(kitchenName?: string) {
  return {
    ...KITCHEN_TEST_PRINT_DATA,
    timestamp: new Date().toISOString(),
    printTime: new Date().toISOString(),
    kitchenName: kitchenName || 'المطبخ',
  };
}

export function customerTestReceiptData() {
  return {
    ...CUSTOMER_TEST_RECEIPT_DATA,
    timestamp: new Date().toISOString(),
  };
}
