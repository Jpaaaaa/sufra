import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { OrdersService } from '../orders/orders.service';

export interface OrderPrintPayload {
  orderId: number;
  table: string;
  hall: string;
  items: Array<{
    id: number;
    item_name: string;
    quantity: number;
    price: number;
    kitchen_id?: number | null;
    service_type?: 'dine-in' | 'pickup' | null;
  }>;
  totals: {
    subtotal?: number;
    total: number;
  };
  timestamp: string;
  restaurantName: string;
  logoUrl?: string;
  kitchenName?: string;
  note?: string | null;
}

export interface ReceiptPrintPayload {
  orderId?: number;
  table: string;
  hall: string;
  items: Array<{
    order_id: number;
    item_name: string;
    quantity: number;
    price: number;
    service_type?: 'dine-in' | 'pickup' | null;
  }>;
  totals: {
    subtotal?: number;
    total: number;
  };
  timestamp: string;
  restaurantName: string;
  logoUrl?: string;
}

@Injectable()
export class PrintService {
  constructor(
    private readonly db: DatabaseService,
    private readonly ordersService: OrdersService,
  ) {}

  async buildOrderPayload(orderId: number): Promise<OrderPrintPayload> {
    const activeOrders = await this.ordersService.findActiveOrders();
    const order = activeOrders.find((o) => o.id === orderId);

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Get table and hall info
    const tableInfo = await this.db.get(
      'SELECT t.id, t.name AS table_name, h.name AS hall_name FROM tables t INNER JOIN halls h ON t.hall_id = h.id WHERE t.id = ?',
      [order.table_id],
    );

    if (!tableInfo) {
      throw new NotFoundException(`Table ${order.table_id} not found`);
    }

    // Get kitchen name if items have kitchen_id
    let kitchenName: string | undefined;
    const firstItemWithKitchen = order.items.find((item) => item.kitchen_id !== null);
    if (firstItemWithKitchen?.kitchen_id) {
      const kitchenInfo = await this.db.get(
        'SELECT name FROM kitchens WHERE id = ?',
        [firstItemWithKitchen.kitchen_id],
      );
      kitchenName = kitchenInfo?.name || `المطبخ ${firstItemWithKitchen.kitchen_id}`;
    }

    return {
      orderId: order.id,
      table: tableInfo.table_name || String(order.table_id),
      hall: tableInfo.hall_name,
      items: order.items.map((item) => ({
        id: item.id,
        item_name: item.item_name,
        quantity: item.quantity,
        price: item.price,
        kitchen_id: item.kitchen_id,
        service_type: item.service_type,
      })),
      totals: {
        subtotal: order.total,
        total: order.total,
      },
      timestamp: new Date().toISOString(),
      restaurantName: 'مطعم سفرا لايت',
      kitchenName,
      note: order.note || null,
    };
  }

  async buildReceiptPayload(
    tableId: number,
    hallName: string,
    tableNumber: string | number,
    orders: any[],
    total: number,
    subtotal?: number,
  ): Promise<ReceiptPrintPayload> {
    // Flatten items from all orders
    const allItems: ReceiptPrintPayload['items'] = [];
    orders.forEach((order) => {
      order.items.forEach((item: any) => {
        allItems.push({
          order_id: order.id,
          item_name: item.item_name,
          quantity: item.quantity,
          price: item.price,
          service_type: item.service_type,
        });
      });
    });

    return {
      table: typeof tableNumber === 'string' ? tableNumber : String(tableNumber),
      hall: hallName,
      items: allItems,
      totals: {
        subtotal: subtotal || total,
        total,
      },
      timestamp: new Date().toISOString(),
      restaurantName: 'مطعم سفرا لايت',
    };
  }

  async generateKitchenPrint(orderId: number): Promise<Array<{
    kitchen_id: number;
    kitchen_name: string;
    table_name: string;
    hall_name: string;
    items: Array<{
      id: number;
      item_name: string;
      quantity: number;
      price: number;
      service_type?: 'dine-in' | 'pickup' | null;
    }>;
  }>> {
    // Get order with table and hall info, and items with kitchen info
    // Query must SELECT items.*, categories.kitchen_id, kitchens.name
    // Items must be grouped by kitchen_id
    // If kitchen_id is NULL, skip printing for that item
    const rows = await this.db.all(
      `SELECT 
        oi.*,
        oi.service_type,
        i.kitchen_id AS item_kitchen_id,
        c.id AS category_id,
        COALESCE(oi.kitchen_id, i.kitchen_id) AS kitchen_id,
        k.name AS kitchen_name,
        t.name AS table_name,
        h.name AS hall_name
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      INNER JOIN tables t ON o.table_id = t.id
      INNER JOIN halls h ON t.hall_id = h.id
      LEFT JOIN items i ON oi.item_id = i.id
      LEFT JOIN categories c ON i.categoryId = c.id
      LEFT JOIN kitchens k ON COALESCE(oi.kitchen_id, i.kitchen_id) = k.id
      WHERE oi.order_id = ? AND COALESCE(oi.kitchen_id, i.kitchen_id) IS NOT NULL
      ORDER BY COALESCE(oi.kitchen_id, i.kitchen_id) ASC`,
      [orderId],
    );

    if (rows.length === 0) {
      return [];
    }

    // Group items by kitchen_id
    const kitchenMap = new Map<number, {
      kitchen_id: number;
      kitchen_name: string;
      table_name: string;
      hall_name: string;
      items: Array<{
        id: number;
        item_name: string;
        quantity: number;
        price: number;
        service_type?: 'dine-in' | 'pickup' | null;
      }>;
    }>();

    rows.forEach((row: any) => {
      const kitchenId = row.kitchen_id;
      if (!kitchenMap.has(kitchenId)) {
        kitchenMap.set(kitchenId, {
          kitchen_id: kitchenId,
          kitchen_name: row.kitchen_name || `المطبخ ${kitchenId}`,
          table_name: row.table_name,
          hall_name: row.hall_name,
          items: [],
        });
      }

      const kitchen = kitchenMap.get(kitchenId)!;
      kitchen.items.push({
        id: row.id,
        item_name: row.item_name,
        quantity: row.quantity,
        price: row.price,
        service_type: row.service_type,
      });
    });

    return Array.from(kitchenMap.values());
  }
}
