// Core types for Sufra Backend

export interface DatabaseRow {
  [key: string]: any;
}

// User types
export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen' | 'customer';
  require_captain_approval?: boolean;
  customer_free_order?: boolean;
  created_at: string;
  updated_at: string;
}

// Item types
export interface Item {
  id: number;
  name: string;
  price: number;
  categoryId?: number | null;
  kitchen_id?: number | null;
  image_url?: string | null;
  description?: string | null;
  original_price?: number;
  is_featured?: boolean;
  is_out_of_stock?: boolean;
}

// Order types
export interface Order {
  id: number;
  table_id: number;
  order_type: 'dine-in' | 'pickup' | 'delivery';
  status: 'pending' | 'printed' | 'completed' | 'cancelled';
  total: number;
  discount?: number;
  globalDiscount?: any;
  created_at: string;
  updated_at: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_location?: string | null;
  note?: string | null;
}

export interface OrderItem {
  id: number;
  order_id: number;
  item_id: number;
  item_name: string;
  quantity: number;
  price: number;
  kitchen_id?: number | null;
  service_type?: 'dine-in' | 'pickup' | null;
  shelf_item_id?: number | null;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

// Category types
export interface Category {
  id: number;
  name: string;
}

// Table types
export interface Table {
  id: number;
  name: string;
  hall_id: number;
  created_at: string;
  updated_at: string;
}

// Hall types
export interface Hall {
  id: number;
  name: string;
  hall_number: number;
  floor_id?: number | null;
  created_at: string;
  updated_at: string;
}

// Floor types
export interface Floor {
  id: number;
  name: string;
  floor_number: number;
  created_at: string;
  updated_at: string;
}

// Kitchen types
export interface Kitchen {
  id: number;
  name: string;
  description?: string | null;
  floor_id?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Printer types
export interface PrinterSettings {
  id: number;
  kitchen_id?: number | null;
  printer_ip?: string | null;
  printer_port: number;
  printer_type: 'kitchen' | 'customer';
  is_active: boolean;
  created_at: string;
}

// Shift types
export interface Shift {
  id: number;
  started_by: number;
  ended_by?: number | null;
  start_time: string;
  end_time?: string | null;
  status: 'open' | 'closed';
  total_sales: number;
  total_orders: number;
  total_items_sold: number;
  payment_breakdown?: string | null;
  created_at: string;
}

// Shelf types
export interface ShelfItem {
  id: number;
  name: string;
  barcode: string;
  price: number;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface ShelfSale {
  id: number;
  shelf_item_id: number;
  quantity: number;
  price: number;
  created_at: string;
}

// Finance types
export interface Revenue {
  id: number;
  date: string;
  type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'extra';
  amount: number;
  notes?: string | null;
  created_at: string;
}

export interface Expense {
  id: number;
  date: string;
  category: string;
  amount: number;
  notes?: string | null;
  user_id?: number | null;
  is_recurring?: boolean;
  recurrence_type?: string | null;
  recurrence_interval?: number;
  next_occurrence_date?: string | null;
  created_at: string;
}

export interface CashFlow {
  id: number;
  date: string;
  type: 'in' | 'out';
  reason: string;
  amount: number;
  linked_order_id?: number | null;
  created_at: string;
}

// Business Day types
export interface BusinessDay {
  id: number;
  start_at: string;
  end_at?: string | null;
  is_active: boolean;
  created_at: string;
}

// Offer types
export interface DailyDeal {
  id: number;
  product_id: number;
  special_price: number;
  date: string;
  created_at: string;
}

export interface Combo {
  id: number;
  combo_name: string;
  combo_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ComboItem {
  id: number;
  combo_id: number;
  product_id: number;
}

export interface ScheduledOffer {
  id: number;
  product_id?: number | null;
  combo_id?: number | null;
  special_price: number;
  start_datetime: string;
  end_datetime: string;
  is_active: boolean;
  created_at: string;
}

export interface FeaturedItem {
  id: number;
  product_id: number;
  featured: boolean;
  created_at: string;
}

export interface HappyHour {
  id: number;
  product_id: number;
  happy_hour_price: number;
  time_start: string;
  time_end: string;
  is_active: boolean;
  created_at: string;
}

// Auth types
export interface LoginResponse {
  access_token: string;
}

export interface AuthPayload {
  sub: number;
  username: string;
  role: string;
}

export interface UserInfo {
  id: number;
  username: string;
  role: string;
  require_captain_approval?: boolean;
  customer_free_order?: boolean;
}

// DTOs
export interface CreateUserDto {
  username: string;
  password: string;
  role: 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen' | 'customer';
  require_captain_approval?: boolean;
  customer_free_order?: boolean;
}

export interface UpdateUserDto {
  username?: string;
  password?: string;
  role?: 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen' | 'customer';
  require_captain_approval?: boolean;
  customer_free_order?: boolean;
}

