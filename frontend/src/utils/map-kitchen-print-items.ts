import { getTrayPrintName, parseTrayNumber } from './order-trays';

/** Map expanded cart/order lines to kitchen print payload rows (preserves group flags). */
export function mapKitchenPrintItems(
  items: any[],
  fallbackServiceType: string = 'dine-in',
): Array<{
  id: number;
  item_name: string;
  quantity: number;
  price: number;
  kitchen_id: number | null;
  service_type: string;
  options_json: unknown;
  is_tray_header?: boolean;
  is_tray_child?: boolean;
  tray_number?: number | null;
}> {
  return items.map((item: any) => {
    const isHeader = Boolean(item._isTrayHeader || item.is_tray_header);
    const isChild = Boolean(item._isTrayChild || item.is_tray_child || item._trayParentId != null);
    const rawName = (item.item_name || item.name || 'صنف').toString().trim();
    const trayNumber =
      item._trayNumber ??
      item.tray_number ??
      (isHeader || isChild ? parseTrayNumber(rawName) : null) ??
      null;

    return {
      id: item.id,
      item_name: isHeader ? getTrayPrintName(trayNumber, rawName) : rawName,
      quantity: item.quantity || 1,
      price: item.price || 0,
      kitchen_id: item.kitchen_id ?? null,
      service_type: item.service_type || fallbackServiceType,
      options_json: isHeader ? null : (item.options_json ?? null),
      is_tray_header: isHeader,
      is_tray_child: isChild,
      tray_number: trayNumber,
    };
  });
}
