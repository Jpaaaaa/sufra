import { extractUserIdFromAuthHeader } from '../../../http-shared/extract-user-token';
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

/** Ensure created_by_user_id is set from body or Authorization header. */
export function withOrderCreatorFromRequest(
  body: Record<string, unknown> | null | undefined,
  authorization?: string,
): Record<string, unknown> {
  const data = body && typeof body === 'object' ? { ...body } : {};
  if (data.userId == null && data.user_id != null) {
    data.userId = data.user_id;
  }
  if (data.userId == null) {
    const fromAuth = extractUserIdFromAuthHeader(authorization);
    if (fromAuth != null) {
      data.userId = fromAuth;
    }
  }
  return data;
}
