import type { UserRole } from '../../contexts/AuthContext';
import {
  ReceiptIcon,
  ClipboardIcon,
  UtensilsIcon,
  GiftIcon,
  ChairIcon,
  ChartIcon,
  SettingsIcon,
  FinanceIcon,
  ShelfIcon,
} from '../icons';

export interface NavItem {
  href: string;
  /** i18n key under `nav.*` (e.g. nav.home) */
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

export const navItems: NavItem[] = [
  { href: '/', labelKey: 'nav.home', icon: ReceiptIcon, roles: ['admin'] as UserRole[] },
  { href: '/halls', labelKey: 'nav.restaurantStructure', icon: ChairIcon, roles: ['admin', 'manager'] as UserRole[] },
  { href: '/pos/floor', labelKey: 'nav.pos', icon: ClipboardIcon, roles: ['admin', 'manager'] as UserRole[] },
  { href: '/orders', labelKey: 'nav.orders', icon: ClipboardIcon, roles: ['admin', 'manager', 'cashier', 'waiter', 'customer'] as UserRole[] },
  { href: '/items', labelKey: 'nav.items', icon: UtensilsIcon, roles: ['admin', 'manager'] as UserRole[] },
  { href: '/shelves', labelKey: 'nav.shelves', icon: ShelfIcon, roles: ['admin', 'manager'] as UserRole[] },
  { href: '/offers', labelKey: 'nav.offers', icon: GiftIcon, roles: ['admin', 'manager'] as UserRole[] },
  { href: '/reports', labelKey: 'nav.reports', icon: ChartIcon, roles: ['admin', 'manager'] as UserRole[] },
  { href: '/finance', labelKey: 'nav.finance', icon: FinanceIcon, roles: ['admin', 'manager'] as UserRole[] },
  { href: '/settings', labelKey: 'nav.settings', icon: SettingsIcon, roles: ['admin', 'manager', 'cashier', 'waiter', 'kitchen', 'customer'] as UserRole[] },
];
