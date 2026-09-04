export interface OrderLineItem {
  id: number;
  item_id?: number;
  item_name: string;
  quantity: number;
  price: number;
  service_type?: string;
  shelf_item_id?: number;
  options_json?: unknown[] | string | null;
}

export interface MergedOrderLine {
  key: string;
  item_id: number | null;
  item_name: string;
  price: number;
  quantity: number;
  lineTotal: number;
  service_type: string;
  options_json?: unknown[] | string | null;
  sourceLineIds: number[];
  sourceOrderIds: number[];
}

function buildMergeKey(item: OrderLineItem): string {
  const itemId = item.item_id ?? item.id;
  const service = item.service_type || 'dine-in';
  const shelf = item.shelf_item_id ?? '';
  const opts =
    typeof item.options_json === 'string'
      ? item.options_json
      : item.options_json
        ? JSON.stringify(item.options_json)
        : '';
  return `${itemId}|${item.item_name}|${item.price}|${service}|${shelf}|${opts}`;
}

export function mergeOrderItemsAcrossOrders(
  orders: { id: number; items: OrderLineItem[] }[],
): MergedOrderLine[] {
  const map = new Map<string, MergedOrderLine>();

  for (const order of orders) {
    for (const item of order.items ?? []) {
      const key = buildMergeKey(item);
      const existing = map.get(key);
      if (existing) {
        existing.quantity += item.quantity;
        existing.lineTotal += item.price * item.quantity;
        existing.sourceLineIds.push(item.id);
        if (!existing.sourceOrderIds.includes(order.id)) {
          existing.sourceOrderIds.push(order.id);
        }
      } else {
        map.set(key, {
          key,
          item_id: item.item_id ?? null,
          item_name: item.item_name,
          price: item.price,
          quantity: item.quantity,
          lineTotal: item.price * item.quantity,
          service_type: item.service_type || 'dine-in',
          options_json: item.options_json,
          sourceLineIds: [item.id],
          sourceOrderIds: [order.id],
        });
      }
    }
  }

  return Array.from(map.values());
}
