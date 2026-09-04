import type { UserRole } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  LayoutGrid,
  Monitor,
  ClipboardList,
  UtensilsCrossed,
  Layers,
  BadgePercent,
  BarChart3,
  Wallet,
  Settings2,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  /** i18n key under `nav.*` (e.g. nav.home) */
  labelKey: string;
  icon: LucideIcon;
  roles: UserRole[];
}

export interface NavGroup {
  id: string;
  labelKey?: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    id: 'overview',
    items: [
      { href: '/', labelKey: 'nav.home', icon: LayoutDashboard, roles: ['admin'] },
    ],
  },
  {
    id: 'ops',
    labelKey: 'nav.groupOps',
    items: [
      { href: '/halls', labelKey: 'nav.restaurantStructure', icon: LayoutGrid, roles: ['admin', 'manager'] },
      { href: '/pos/floor', labelKey: 'nav.pos', icon: Monitor, roles: ['admin', 'manager'] },
      { href: '/orders', labelKey: 'nav.orders', icon: ClipboardList, roles: ['admin', 'manager', 'cashier', 'waiter', 'customer'] },
    ],
  },
  {
    id: 'catalog',
    labelKey: 'nav.groupCatalog',
    items: [
      { href: '/items', labelKey: 'nav.items', icon: UtensilsCrossed, roles: ['admin', 'manager'] },
      { href: '/shelves', labelKey: 'nav.shelves', icon: Layers, roles: ['admin', 'manager'] },
      { href: '/offers', labelKey: 'nav.offers', icon: BadgePercent, roles: ['admin', 'manager'] },
    ],
  },
  {
    id: 'insights',
    labelKey: 'nav.groupInsights',
    items: [
      { href: '/reports', labelKey: 'nav.reports', icon: BarChart3, roles: ['admin', 'manager'] },
      { href: '/finance', labelKey: 'nav.finance', icon: Wallet, roles: ['admin', 'manager'] },
    ],
  },
  {
    id: 'system',
    items: [
      { href: '/settings', labelKey: 'nav.settings', icon: Settings2, roles: ['admin', 'manager', 'cashier', 'waiter', 'kitchen', 'customer'] },
    ],
  },
];

export const navItems: NavItem[] = navGroups.flatMap((g) => g.items);
