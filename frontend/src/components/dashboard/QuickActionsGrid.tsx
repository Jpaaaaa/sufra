import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, UserRole } from '../../contexts/AuthContext';
import { ReceiptIcon, TableIcon, UtensilsIcon, ChartIcon, FinanceIcon, UsersIcon, SettingsIcon } from '../icons';
import Card from '../ui/Card';

interface ActionCard {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const actionCards: ActionCard[] = [
  {
    href: '/dining',
    label: 'نقطة البيع',
    icon: ReceiptIcon,
    roles: ['admin', 'manager', 'cashier', 'waiter'],
  },
  {
    href: '/tables',
    label: 'الطاولات',
    icon: TableIcon,
    roles: ['admin', 'manager', 'cashier', 'waiter'],
  },
  {
    href: '/halls',
    label: 'المطبخ',
    icon: UtensilsIcon,
    roles: ['admin', 'kitchen'],
  },
  {
    href: '/reports',
    label: 'المبيعات اليومية',
    icon: ChartIcon,
    roles: ['admin', 'manager'],
  },
  {
    href: '/finance',
    label: 'المالية',
    icon: FinanceIcon,
    roles: ['admin', 'manager'],
  },
  {
    href: '/settings/users',
    label: 'المستخدمين',
    icon: UsersIcon,
    roles: ['admin'],
  },
  {
    href: '/settings',
    label: '', // shown via t('nav.settings')
    icon: SettingsIcon,
    roles: ['admin', 'manager'],
  },
];

export default function QuickActionsGrid() {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Filter cards based on user role
  const visibleCards = actionCards.filter((card) => 
    user && card.roles.includes(user.role)
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
      {visibleCards.map((card) => {
        const Icon = card.icon;
        return (
          <Link key={card.href} to={card.href}>
            <Card className="p-6 hover:shadow-lg cursor-pointer">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-soft-lg bg-cyber-aqua/10 text-cyber-aqua">
                  <Icon className="h-8 w-8" />
                </div>
                <span className="text-[15px] leading-normal font-semibold text-obsidian text-center">
                  {card.href === '/finance'
                    ? t('nav.finance')
                    : card.href === '/settings'
                      ? t('nav.settings')
                      : card.label}
                </span>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

