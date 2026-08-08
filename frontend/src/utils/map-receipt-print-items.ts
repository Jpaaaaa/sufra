import { getTrayPrintName, parseTrayNumber } from './order-trays';

export type ReceiptPrintLine = {
  order_id: number;
  item_name: string;
  quantity: number;
  price: number;
  service_type?: string;
  discount?: number | null;
  options_json?: unknown;
  is_tray_header?: boolean;
  is_tray_child?: boolean;
  tray_number?: number | null;
};

/**
 * Flatten order item trees for the customer invoice:
 * tray header → its children → singles.
 * Across multiple orders, trays are renumbered 1..N so merged invoices
 * never show two identical tray labels with different contents.
 */
export function expandOrdersForCustomerReceipt(
  orders: Array<{ id?: number; order_type?: string; items?: any[] }>,
): ReceiptPrintLine[] {
  const out: ReceiptPrintLine[] = [];
  let traySeq = 0;

  for (const order of orders ?? []) {
    const orderId = Number(order.id) || 0;
    const flat = order.items ?? [];
    const childrenByParent = new Map<number, any[]>();

    for (const item of flat) {
      if (item.parent_order_item_id != null) {
        const list = childrenByParent.get(item.parent_order_item_id) ?? [];
        list.push(item);
        childrenByParent.set(item.parent_order_item_id, list);
      }
    }

    const topLevel = flat
      .filter((i) => i.parent_order_item_id == null)
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

    for (const item of topLevel) {
      const serviceType = item.service_type || order.order_type || 'dine-in';

      if (item.line_kind === 'tray') {
        traySeq += 1;
        const trayNumber = traySeq;
        const kids = (childrenByParent.get(item.id) ?? []).sort(
          (a, b) => (a.id ?? 0) - (b.id ?? 0),
        );

        out.push({
          order_id: orderId,
          item_name: getTrayPrintName(trayNumber, item.item_name),
          quantity: item.quantity || 1,
          price: item.price || 0,
          service_type: serviceType,
          discount: item.discount ?? null,
          options_json: null,
          is_tray_header: true,
          tray_number: trayNumber,
        });

        for (const child of kids) {
          out.push({
            order_id: orderId,
            item_name: (child.item_name || child.name || 'صنف').toString().trim(),
            quantity: (child.quantity || 1) * (item.quantity || 1),
            price: child.price || 0,
            service_type: child.service_type || serviceType,
            discount: child.discount ?? null,
            options_json: child.options_json ?? null,
            is_tray_header: false,
            is_tray_child: true,
            tray_number: trayNumber,
          });
        }
        continue;
      }

      // Orphan rows that look like trays by name but lack line_kind
      const maybeTray = parseTrayNumber(item.item_name);
      if (maybeTray != null && (childrenByParent.get(item.id) ?? []).length > 0) {
        traySeq += 1;
        const trayNumber = traySeq;
        const kids = (childrenByParent.get(item.id) ?? []).sort(
          (a, b) => (a.id ?? 0) - (b.id ?? 0),
        );
        out.push({
          order_id: orderId,
          item_name: getTrayPrintName(trayNumber, item.item_name),
          quantity: item.quantity || 1,
          price: item.price || 0,
          service_type: serviceType,
          discount: item.discount ?? null,
          is_tray_header: true,
          tray_number: trayNumber,
        });
        for (const child of kids) {
          out.push({
            order_id: orderId,
            item_name: (child.item_name || child.name || 'صنف').toString().trim(),
            quantity: (child.quantity || 1) * (item.quantity || 1),
            price: child.price || 0,
            service_type: child.service_type || serviceType,
            discount: child.discount ?? null,
            options_json: child.options_json ?? null,
            is_tray_child: true,
            tray_number: trayNumber,
          });
        }
        continue;
      }

      out.push({
        order_id: orderId,
        item_name: (item.item_name || item.name || 'صنف').toString().trim(),
        quantity: item.quantity || 1,
        price: item.price || 0,
        service_type: serviceType,
        discount: item.discount ?? null,
        options_json: item.options_json ?? null,
        is_tray_header: false,
        is_tray_child: false,
        tray_number: null,
      });
    }
  }

  return out;
}

/** Single-order helper. */
export function expandOrderForCustomerReceipt(order: {
  id?: number;
  order_type?: string;
  items?: any[];
}): ReceiptPrintLine[] {
  return expandOrdersForCustomerReceipt([order]);
}
