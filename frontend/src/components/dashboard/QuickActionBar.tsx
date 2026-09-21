import {
  BadgePercent,
  Banknote,
  ClipboardList,
  FileText,
  Monitor,
  Plus,
  Receipt,
  Unlock,
} from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { fetchJson, getServerUrl } from '../../utils';
import { showAlert } from '../ui/AlertDialog';
import { showToast } from '../ui/Toast';
import { homeUi } from './home-ui';
import type { HomeOverview } from './useHomeOverview';

function QuickActionBar({ overview }: { overview: HomeOverview }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { shiftOpen, setShiftOpen, refresh } = overview;
  const [busy, setBusy] = useState(false);

  const canOpenShift = user && (user.role === 'admin' || user.role === 'manager' || user.role === 'cashier');

  const handleShift = async () => {
    if (shiftOpen) {
      navigate('/reports');
      return;
    }
    if (!canOpenShift || !token || !user) {
      navigate('/settings/shift');
      return;
    }
    try {
      setBusy(true);
      await fetchJson(`${getServerUrl()}/shifts/start`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });
      setShiftOpen(true);
      showToast(t('home.openShiftSuccess'), 'success');
      void refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('home.openShiftFailed');
      await showAlert({ title: t('home.openShiftFailed'), message, type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const actions = [
      {
        id: 'shift',
        label: shiftOpen ? t('home.quickShiftOpenHint') : t('home.quickOpenShift'),
        icon: Unlock,
        tone: 'bg-[#3B82F6] text-white hover:bg-[#2563EB]',
        onClick: () => void handleShift(),
        disabled: busy,
      },
      {
        id: 'pos',
        label: t('home.quickPos'),
        icon: Monitor,
        tone: 'bg-[#F97316] text-white hover:bg-[#EA580C]',
        onClick: () => navigate('/pos/floor'),
      },
      {
        id: 'complete',
        label: t('home.quickCompleteOrder'),
        icon: Plus,
        tone: 'bg-[#10B981] text-white hover:bg-[#059669]',
        onClick: () => navigate('/orders'),
      },
      {
        id: 'offers',
        label: t('home.quickOffers'),
        icon: BadgePercent,
        tone: 'bg-[#8B5CF6] text-white hover:bg-[#7C3AED]',
        onClick: () => navigate('/offers'),
      },
      {
        id: 'orders',
        label: t('home.quickOrders'),
        icon: ClipboardList,
        tone: 'border border-black/5 bg-white text-obsidian hover:bg-cloud-soft-white',
        onClick: () => navigate('/orders'),
      },
      {
        id: 'expense',
        label: t('home.quickExpense'),
        icon: Receipt,
        tone: 'border border-black/5 bg-white text-obsidian hover:bg-cloud-soft-white',
        onClick: () => navigate('/finance'),
      },
      {
        id: 'cash',
        label: t('home.quickCash'),
        icon: Banknote,
        tone: 'border border-black/5 bg-white text-obsidian hover:bg-cloud-soft-white',
        onClick: () => navigate('/finance'),
      },
      {
        id: 'report',
        label: t('home.quickDailyReport'),
        icon: FileText,
        tone: 'border border-black/5 bg-white text-obsidian hover:bg-cloud-soft-white',
        onClick: () => navigate('/reports'),
      },
    ];

  return (
    <section className={`${homeUi.surface} h-full p-3`}>
      <h2 className={`${homeUi.sectionTitle} px-1 pb-3`}>{t('home.quickActionsTitle')}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              disabled={action.disabled}
              onClick={action.onClick}
              className={`flex min-h-[72px] flex-col items-start justify-between rounded-xl px-3 py-2.5 text-start transition disabled:opacity-60 ${action.tone}`}
            >
              <Icon className="h-4 w-4" strokeWidth={2.2} aria-hidden />
              <span className="text-[12px] font-semibold leading-snug">{action.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default memo(QuickActionBar);
