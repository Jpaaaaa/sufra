import type { FastifyRouteContext } from '../../types';

export type OrderEventType = 'created' | 'updated' | 'deleted';
export type OrderChannel = 'dine-in' | 'pickup' | 'delivery';

export type DineInStatus = 'pending' | 'printed' | 'completed' | 'cancelled';
export type DeliveryStatus = DineInStatus | 'archived';

export function emitOrder(
  ctx: FastifyRouteContext,
  eventType: OrderEventType,
  orderType: OrderChannel,
  order: unknown,
): void {
  ctx.emitOrderEvent?.(eventType, orderType, order);
}

export function parseId(value: string): number {
  return parseInt(value, 10);
}
