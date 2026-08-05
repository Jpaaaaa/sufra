export type UserRole = 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen' | 'customer';

export interface User {
  id: number;
  username: string;
  password_hash: string;
  /** Plain login code for admin display only; null for legacy rows until reset. */
  password_plain: string | null;
  role: UserRole;
  require_captain_approval: boolean;
  customer_free_order: boolean;
  created_at: string;
  updated_at: string;
}

/** User row returned to admin UI (hash never exposed). */
export type UserPublic = Omit<User, 'password_hash'>;

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

