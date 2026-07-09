import { DatabaseService } from '../../database/database.service';
import { initializeDeliveryPlatforms } from './delivery-platforms.service';
import { initializePickupOrders } from './pickup-orders.service';
import { initializeDeliveryOrders } from './delivery-orders.service';
import { initializeDineInOrders } from './dine-in-orders.service';
import { initializeOrders } from './orders.service';

/** Initialize all order domain services (requires shelves + tables initialized first). */
export function initializeOrdersCluster(db: DatabaseService): void {
  initializeDeliveryPlatforms(db);
  initializePickupOrders(db);
  initializeDeliveryOrders(db);
  initializeDineInOrders(db);
  initializeOrders(db);
}
