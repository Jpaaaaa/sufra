import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Patch,
  Query,
  BadRequestException,
  NotFoundException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { OrdersService, Order, OrderWithItems } from './orders.service';
import { DineInOrdersService, CreateDineInOrderDto, DineInOrderWithItems } from './dine-in-orders.service';
import { PickupOrdersService, CreatePickupOrderDto, PickupOrderWithItems } from './pickup-orders.service';
import { DeliveryOrdersService, CreateDeliveryOrderDto, DeliveryOrderWithItems } from './delivery-orders.service';
import { DeliveryPlatformsService, DeliveryPlatform } from './delivery-platforms.service';
import { PrintersService } from '../printers/printers.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

class CreateOrderDto {
  table_id!: number;
  order_type?: 'dine-in';
  items!: {
    item_id: number;
    item_name: string;
    quantity: number;
    price: number;
    kitchen_id?: number;
    service_type?: 'dine-in' | 'pickup';
    shelf_item_id?: number;
  }[];
  customer_name?: string;
  customer_phone?: string;
  customer_location?: string;
  note?: string;
  globalDiscount?: { percent: number; amount: number };
}


// Legacy DTO for backward compatibility (used by legacy endpoints)
class UpdateOrderStatusDto {
  status!: 'pending' | 'printed' | 'completed' | 'cancelled' | 'archived';
}

class UpdateOrderTypeDto {
  order_type!: 'dine-in';
}

class UpdateOrderDto {
  order_type?: 'dine-in';
  items!: {
    item_id: number;
    item_name: string;
    quantity: number;
    price: number;
    kitchen_id?: number;
    service_type?: 'dine-in' | 'pickup';
    shelf_item_id?: number;
  }[];
  customer_name?: string;
  customer_phone?: string;
  customer_location?: string;
  note?: string;
}


@Controller('orders')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'manager', 'cashier', 'waiter', 'customer')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService, // Legacy (read-only)
    private readonly dineInOrdersService: DineInOrdersService,
    private readonly pickupOrdersService: PickupOrdersService,
    private readonly deliveryOrdersService: DeliveryOrdersService,
    private readonly deliveryPlatformsService: DeliveryPlatformsService,
    private readonly printersService: PrintersService,
  ) {}

  @Get()
  async findByTableOrHall(
    @Query('table_id') tableId?: string,
    @Query('hall_id') hallId?: string,
  ): Promise<OrderWithItems[]> {
    // Support both table_id (existing) and hall_id (new) query parameters
    if (hallId) {
      const parsedHallId = parseInt(hallId, 10);
      if (isNaN(parsedHallId)) {
        throw new BadRequestException('Invalid hall_id parameter');
      }
      return this.ordersService.findByHall(parsedHallId);
    }
    
    if (tableId) {
      const parsedTableId = parseInt(tableId, 10);
      if (isNaN(parsedTableId)) {
        throw new BadRequestException('Invalid table_id parameter');
      }
      return this.ordersService.findByTable(parsedTableId);
    }
    
    // If neither parameter is provided, return empty array
    return [];
  }

  /**
   * Get all active orders from all domains (for kitchen display)
   * Queries domain tables: dine_in_orders
   * Returns flat array format for backward compatibility
   * GET /orders/active
   */
  @Get('active')
  async findActive(): Promise<OrderWithItems[]> {
    console.log('[CONTROLLER] Getting all active orders from all domain tables');
    
    // Use the updated legacy method which now queries domain tables
    // This maintains backward compatibility while using new domain tables
    return this.ordersService.findActiveOrders();
  }


  // ====================================================================
  // NEW DOMAIN-SPECIFIC ENDPOINTS (OPTION 3: Full Domain Separation)
  // ====================================================================

  /**
   * Create a new dine-in order
   * POST /orders/dine-in
   */
  @Post('dine-in')
  createDineInOrder(@Body() dto: CreateDineInOrderDto, @Request() req: any): Promise<DineInOrderWithItems> {
    console.log('[CONTROLLER] Creating dine-in order via new endpoint');
    return this.dineInOrdersService.create({
      ...dto,
      userId: req.user.sub,
      userRole: req.user.role,
    });
  }

  /**
   * Move all orders from source table to target table
   * POST /orders/dine-in/move-table
   */
  @Post('dine-in/move-table')
  moveTableOrders(
    @Body() dto: { source_table_id: number; target_table_id: number },
  ): Promise<{ movedCount: number }> {
    if (!dto.source_table_id || !dto.target_table_id) {
      throw new BadRequestException('source_table_id and target_table_id are required');
    }
    return this.dineInOrdersService.moveTableOrders(dto.source_table_id, dto.target_table_id);
  }

  /**
   * Get dine-in orders for a table
   * GET /orders/dine-in/table/:tableId
   */
  @Get('dine-in/table/:tableId')
  getDineInOrdersByTable(@Param('tableId', ParseIntPipe) tableId: number): Promise<DineInOrderWithItems[]> {
    return this.dineInOrdersService.findByTable(tableId);
  }

  /**
   * Get dine-in orders for a hall
   * GET /orders/dine-in/hall/:hallId
   */
  @Get('dine-in/hall/:hallId')
  getDineInOrdersByHall(@Param('hallId', ParseIntPipe) hallId: number): Promise<DineInOrderWithItems[]> {
    return this.dineInOrdersService.findByHall(hallId);
  }

  /**
   * Get active dine-in orders
   * GET /orders/dine-in/active
   */
  @Get('dine-in/active')
  getActiveDineInOrders(): Promise<DineInOrderWithItems[]> {
    return this.dineInOrdersService.findActive();
  }

  /**
   * Get archived dine-in orders
   * GET /orders/dine-in/archived
   */
  @Get('dine-in/archived')
  getArchivedDineInOrders(): Promise<DineInOrderWithItems[]> {
    return this.dineInOrdersService.findArchived();
  }

  /**
   * Delete all archived dine-in orders
   * DELETE /orders/dine-in/archived
   */
  @Delete('dine-in/archived')
  @Roles('admin', 'manager')
  async clearArchivedDineInOrders(): Promise<{ deletedCount: number }> {
    const deletedCount = await this.dineInOrdersService.removeAllArchived();
    return { deletedCount };
  }

  /**
   * Set global discount for all dine-in orders on a table
   * PATCH /orders/table/:tableId/global-discount
   */
  @Patch('table/:tableId/global-discount')
  setTableGlobalDiscount(
    @Param('tableId', ParseIntPipe) tableId: number,
    @Body() dto: { globalDiscount: { percent: number; amount: number } | null },
  ) {
    return this.dineInOrdersService.setTableGlobalDiscount(tableId, dto.globalDiscount ?? null);
  }

  /**
   * Update dine-in order status
   * PATCH /orders/dine-in/:id/status
   */
  @Patch('dine-in/:id/status')
  updateDineInOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    console.log('[CONTROLLER] updateDineInOrderStatus: order', id, 'new status', dto.status);
    return this.dineInOrdersService.updateStatus(id, dto.status);
  }

  /**
   * Update dine-in order
   * PATCH /orders/dine-in/:id
   */
  @Patch('dine-in/:id')
  updateDineInOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: {
      items: Array<{
        item_id: number;
        item_name: string;
        quantity: number;
        price: number;
        kitchen_id?: number | null;
        service_type?: 'dine-in' | 'pickup';
        shelf_item_id?: number | null;
      }>;
      globalDiscount?: { percent: number; amount: number };
      note?: string;
    },
  ): Promise<DineInOrderWithItems> {
    return this.dineInOrdersService.update(id, dto);
  }

  // ====================================================================
  // PICKUP ORDER ENDPOINTS
  // ====================================================================

  /**
   * Create a new pickup order
   * POST /orders/pickup
   */
  @Post('pickup')
  createPickupOrder(@Body() dto: CreatePickupOrderDto, @Request() req: any): Promise<PickupOrderWithItems> {
    console.log('[CONTROLLER] Creating pickup order via new endpoint');
    return this.pickupOrdersService.create({ ...dto, userId: req.user.sub });
  }

  /**
   * Get active pickup orders
   * GET /orders/pickup/active
   */
  @Get('pickup/active')
  getActivePickupOrders(): Promise<PickupOrderWithItems[]> {
    return this.pickupOrdersService.findActive();
  }

  /**
   * Get archived pickup orders
   * GET /orders/pickup/archived
   */
  @Get('pickup/archived')
  getArchivedPickupOrders(): Promise<PickupOrderWithItems[]> {
    return this.pickupOrdersService.findArchived();
  }

  /**
   * Delete all archived pickup orders
   * DELETE /orders/pickup/archived
   */
  @Delete('pickup/archived')
  @Roles('admin', 'manager')
  async clearArchivedPickupOrders(): Promise<{ deletedCount: number }> {
    const deletedCount = await this.pickupOrdersService.removeAllArchived();
    return { deletedCount };
  }

  /**
   * Get pickup order by ID
   * GET /orders/pickup/:id
   */
  @Get('pickup/:id')
  async getPickupOrderById(@Param('id', ParseIntPipe) id: number): Promise<PickupOrderWithItems> {
    const order = await this.pickupOrdersService.findById(id);
    if (!order) {
      throw new NotFoundException('Pickup order not found');
    }
    return order;
  }

  /**
   * Update pickup order status
   * PATCH /orders/pickup/:id/status
   */
  @Patch('pickup/:id/status')
  updatePickupOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.pickupOrdersService.updateStatus(id, dto.status);
  }

  /**
   * Update pickup order
   * PATCH /orders/pickup/:id
   */
  @Patch('pickup/:id')
  updatePickupOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: {
      items: Array<{
        item_id: number;
        item_name: string;
        quantity: number;
        price: number;
        kitchen_id?: number | null;
        shelf_item_id?: number | null;
      }>;
      globalDiscount?: { percent: number; amount: number };
      note?: string;
      customer_name?: string | null;
      customer_phone?: string | null;
    },
  ): Promise<PickupOrderWithItems> {
    return this.pickupOrdersService.update(id, dto);
  }

  /**
   * Delete pickup order
   * DELETE /orders/pickup/:id
   */
  @Delete('pickup/:id')
  deletePickupOrder(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.pickupOrdersService.remove(id);
  }

  // ====================================================================
  // DELIVERY ORDER ENDPOINTS
  // ====================================================================

  /**
   * List delivery aggregator platforms (Talabat, Toters, …)
   * GET /orders/delivery/platforms — must be registered before GET delivery/:id
   */
  @Get('delivery/platforms')
  getDeliveryPlatforms(): Promise<DeliveryPlatform[]> {
    return this.deliveryPlatformsService.findAll();
  }

  @Post('delivery/platforms')
  @Roles('admin', 'manager', 'cashier', 'waiter')
  createDeliveryPlatform(@Body() dto: { name: string; commission_percent: number }): Promise<DeliveryPlatform> {
    return this.deliveryPlatformsService.create(dto);
  }

  @Patch('delivery/platforms/:platformId')
  @Roles('admin', 'manager', 'cashier', 'waiter')
  updateDeliveryPlatform(
    @Param('platformId', ParseIntPipe) platformId: number,
    @Body() dto: { name?: string; commission_percent?: number; sort_order?: number },
  ): Promise<DeliveryPlatform> {
    return this.deliveryPlatformsService.update(platformId, dto);
  }

  @Delete('delivery/platforms/:platformId')
  @Roles('admin', 'manager', 'cashier', 'waiter')
  removeDeliveryPlatform(@Param('platformId', ParseIntPipe) platformId: number): Promise<void> {
    return this.deliveryPlatformsService.remove(platformId);
  }

  /**
   * Create a new delivery order
   * POST /orders/delivery
   */
  @Post('delivery')
  createDeliveryOrder(@Body() dto: CreateDeliveryOrderDto, @Request() req: any): Promise<DeliveryOrderWithItems> {
    console.log('[CONTROLLER] Creating delivery order via new endpoint');
    return this.deliveryOrdersService.create({ ...dto, userId: req.user.sub });
  }

  /**
   * Get active delivery orders
   * GET /orders/delivery/active
   */
  @Get('delivery/active')
  getActiveDeliveryOrders(): Promise<DeliveryOrderWithItems[]> {
    return this.deliveryOrdersService.findActive();
  }

  /**
   * Get archived delivery orders
   * GET /orders/delivery/archived
   */
  @Get('delivery/archived')
  getArchivedDeliveryOrders(): Promise<DeliveryOrderWithItems[]> {
    return this.deliveryOrdersService.findArchived();
  }

  /**
   * Delete all archived delivery orders
   * DELETE /orders/delivery/archived
   */
  @Delete('delivery/archived')
  @Roles('admin', 'manager')
  async clearArchivedDeliveryOrders(): Promise<{ deletedCount: number }> {
    const deletedCount = await this.deliveryOrdersService.removeAllArchived();
    return { deletedCount };
  }

  /**
   * Get delivery order by ID
   * GET /orders/delivery/:id
   */
  @Get('delivery/:id')
  async getDeliveryOrderById(@Param('id', ParseIntPipe) id: number): Promise<DeliveryOrderWithItems> {
    const order = await this.deliveryOrdersService.findById(id);
    if (!order) {
      throw new NotFoundException('Delivery order not found');
    }
    return order;
  }

  /**
   * Update delivery order status
   * PATCH /orders/delivery/:id/status
   */
  @Patch('delivery/:id/status')
  updateDeliveryOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.deliveryOrdersService.updateStatus(id, dto.status);
  }

  /**
   * Update delivery order
   * PATCH /orders/delivery/:id
   */
  @Patch('delivery/:id')
  updateDeliveryOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: {
      items: Array<{
        item_id: number;
        item_name: string;
        quantity: number;
        price: number;
        kitchen_id?: number | null;
        shelf_item_id?: number | null;
      }>;
      customer_name?: string;
      customer_phone?: string;
      customer_address?: string;
      globalDiscount?: { percent: number; amount: number };
      delivery_platform_id?: number | null;
      note?: string;
    },
  ): Promise<DeliveryOrderWithItems> {
    return this.deliveryOrdersService.update(id, dto);
  }

  /**
   * Delete delivery order
   * DELETE /orders/delivery/:id
   */
  @Delete('delivery/:id')
  deleteDeliveryOrder(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.deliveryOrdersService.remove(id);
  }

  // ====================================================================
  // LEGACY ENDPOINTS (Read-only, will throw errors on write operations)
  // ====================================================================

  /**
   * @deprecated Use POST /orders/dine-in instead
   * This endpoint will throw an error as the legacy orders table is now read-only
   */
  @Post()
  create(@Body() dto: CreateOrderDto, @Request() req: any): Promise<OrderWithItems> {
    console.error('[CONTROLLER] ⛔ BLOCKED: Attempt to create order via legacy POST /orders endpoint');
    // This will throw an error from OrdersService.create()
    return this.ordersService.create({
      ...dto,
      userId: req.user.sub,
      userRole: req.user.role,
    });
  }

  @Patch('clear-all')
  @Roles('admin', 'manager')
  async clearAllTables() {
    return this.ordersService.clearAllTables();
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<Order> {
    return this.ordersService.updateStatus(id, dto.status);
  }

  @Patch(':id/order-type')
  updateOrderType(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderTypeDto,
  ): Promise<Order> {
    return this.ordersService.updateOrderType(id, dto.order_type);
  }

  /**
   * @deprecated Legacy orders table is read-only. Use domain-specific update endpoints instead.
   */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderDto,
  ): Promise<OrderWithItems> {
    console.error('[CONTROLLER] ⛔ BLOCKED: Attempt to update order via legacy PATCH /orders/:id endpoint');
    // This will throw an error from OrdersService.update()
    return this.ordersService.update(id, dto);
  }


  /**
   * @deprecated Legacy orders table is read-only. Use domain-specific delete methods instead.
   */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    console.error('[CONTROLLER] ⛔ BLOCKED: Attempt to delete order via legacy DELETE /orders/:id endpoint');
    // This will throw an error from OrdersService.remove()
    return this.ordersService.remove(id);
  }

  @Post(':id/print')
  async printOrder(@Param('id', ParseIntPipe) id: number) {
    // Printing is now handled by Electron via IPC
    // This endpoint is kept for backward compatibility but returns a message
    return { 
      success: false, 
      message: 'Printing is now handled by Electron. Please use the frontend print button.' 
    };
  }

  @Post('print-receipt/:tableId')
  async printReceipt(
    @Param('tableId', ParseIntPipe) tableId: number,
    @Body() body: { 
      hallName: string; 
      tableNumber: string | number; 
      orders: any[]; 
      total: number;
      subtotal?: number;
      password?: string;
    },
    @Request() req: any,
  ) {
    // Printing is now handled by Electron via IPC
    // This endpoint is kept for backward compatibility but returns a message
    return { 
      success: false, 
      message: 'Printing is now handled by Electron. Please use the frontend print button.' 
    };
  }

}

