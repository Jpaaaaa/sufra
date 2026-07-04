import { Plus, FileText, Package, Printer } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function QuickActionBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const actions = useMemo(
    () => [
      {
        id: 'new-table',
        label: t('home.quickOpenTable'),
        icon: Plus,
        onClick: () => {
          navigate('/orders');
        },
      },
      {
        id: 'daily-report',
        label: t('home.quickDailyReport'),
        icon: FileText,
        onClick: () => {
          navigate('/reports');
        },
      },
      {
        id: 'add-item',
        label: t('home.quickAddItem'),
        icon: Package,
        onClick: () => {
          navigate('/items');
        },
      },
      {
        id: 'print-daily',
        label: t('home.quickPrintDaily'),
        icon: Printer,
        onClick: () => {
          navigate('/reports');
        },
      },
    ],
    [t, navigate],
  );

  return (
    <div className="flex flex-wrap gap-4 mb-6">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            onClick={action.onClick}
            className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-white border border-cyber-aqua/20 shadow-soft hover:shadow-md hover:bg-cyber-aqua/5 hover:border-cyber-aqua/30 group"
          >
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-cyber-aqua/10 text-cyber-aqua flex items-center justify-center group-hover:bg-cyber-aqua/20">
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-[14px] font-medium text-obsidian">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
