import { Plus, FileText, Package, Printer } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { homeUi } from './home-ui';

function QuickActionBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const actions = useMemo(
    () => [
      {
        id: 'new-table',
        label: t('home.quickOpenTable'),
        icon: Plus,
        primary: true,
        onClick: () => navigate('/orders'),
      },
      {
        id: 'daily-report',
        label: t('home.quickDailyReport'),
        icon: FileText,
        primary: false,
        onClick: () => navigate('/reports'),
      },
      {
        id: 'add-item',
        label: t('home.quickAddItem'),
        icon: Package,
        primary: false,
        onClick: () => navigate('/items'),
      },
      {
        id: 'print-daily',
        label: t('home.quickPrintDaily'),
        icon: Printer,
        primary: false,
        onClick: () => navigate('/reports'),
      },
    ],
    [t, navigate],
  );

  return (
    <section className={`${homeUi.surface} p-2`}>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;
          if (action.primary) {
            return (
              <button
                key={action.id}
                type="button"
                onClick={action.onClick}
                className="flex items-center justify-center gap-2.5 rounded-lg bg-cyber-aqua px-3 py-3 text-charcoal-graphite hover:bg-cyber-aqua/90"
              >
                <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={2.5} />
                <span className="text-[13px] font-semibold">{action.label}</span>
              </button>
            );
          }
          return (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              className="flex items-center justify-center gap-2.5 rounded-lg border border-transparent bg-cloud-soft-white px-3 py-3 text-obsidian hover:border-cyber-aqua/25 hover:bg-cyber-aqua/5"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-cyber-aqua shadow-soft">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-[13px] font-medium">{action.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default memo(QuickActionBar);
