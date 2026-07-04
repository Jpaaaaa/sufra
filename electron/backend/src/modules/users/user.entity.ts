export type UserRole = 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen' | 'customer';

export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: UserRole;
  require_captain_approval: boolean;
  customer_free_order: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUserDto {
  username: string;
  password: string;
  role: UserRole;
  require_captain_approval?: boolean;
  customer_free_order?: boolean;
}

export interface UpdateUserDto {
  username?: string;
  password?: string;
  role?: UserRole;
  require_captain_approval?: boolean;
  customer_free_order?: boolean;
}

