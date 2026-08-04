import { Fragment } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SettingsIcon } from '../icons';
import { useAuth } from '../../contexts/AuthContext';
import type { SettingsTabKey } from './settings-tab-keys';
import { SettingsTabIcon } from './settings-tab-icons';

export type { SettingsTabKey } from './settings-tab-keys';

type SettingsTabLabelKey =
  | 'tabPrinters'
  | 'tabRecipePrint'
  | 'tabServer'
  | 'tabUsers'
  | 'tabShift'
  | 'tabLicenseUpdates'
  | 'tabBackup';

type SettingsTabGroup = 'operations' | 'people' | 'system';

const tabs: {
  key: SettingsTabKey;
  labelKey: SettingsTabLabelKey;
  href: string;
  group: SettingsTabGroup;
  roles?: string[];
}[] = [
  { key: 'printers', labelKey: 'tabPrinters', href: '/settings', group: 'operations', roles: ['admin', 'manager'] },
  {
    key: 'recipe-print',
    labelKey: 'tabRecipePrint',
    href: '/settings/recipe-print',
    group: 'operations',
    roles: ['admin', 'manager'],
  },
  { key: 'shift', labelKey: 'tabShift', href: '/settings/shift', group: 'operations', roles: ['admin', 'manager'] },
  { key: 'users', labelKey: 'tabUsers', href: '/settings/users', group: 'people', roles: ['admin'] },
  { key: 'server', labelKey: 'tabServer', href: '/settings/server', group: 'system' },
  { key: 'backup', labelKey: 'tabBackup', href: '/settings/backup', group: 'system', roles: ['admin', 'manager'] },
  {
    key: 'license-updates',
    labelKey: 'tabLicenseUpdates',
    href: '/settings/license-updates',
    group: 'system',
    roles: ['admin', 'manager'],
  },
];

export default function SettingsTabs() {
  const { t } = useTranslation();
  const location = useLocation();
  const pathname = location.pathname;
  const { user } = useAuth();

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/settings') {
      return pathname === '/settings';
    }
    return pathname.startsWith(href);
  };

  const visibleTabs = tabs.filter((tab) => {
    if (!tab.roles) return true;
    return user && tab.roles.includes(user.role);
  });

  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[15px] leading-normal font-medium text-obsidian">
        <span className="flex h-9 w-9 items-center justify-center rounded-soft-lg border border-cyber-aqua/20 bg-cyber-aqua/10 text-cyber-aqua">
          <SettingsIcon className="h-4 w-4" />
        </span>
        <span className="font-medium">{t('settings.systemHeading')}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1 rounded-soft-xl bg-cloud-soft-white p-1">
        {visibleTabs.map((tab, index) => {
          const active = isActive(tab.href);
          const showDivider = index > 0 && visibleTabs[index - 1].group !== tab.group;

          return (
            <Fragment key={tab.key}>
              {showDivider && <span className="mx-1 hidden h-6 w-px shrink-0 self-center bg-obsidian/10 sm:block" />}
              <Link
                to={tab.href}
                className={`tab-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-[15px] leading-normal font-medium ${
                  active
                    ? 'tab-button-active bg-cyber-aqua text-charcoal-graphite shadow-soft'
                    : 'text-obsidian/70 hover:bg-white hover:text-obsidian'
                }`}
              >
                <SettingsTabIcon tabKey={tab.key} className="h-4 w-4 shrink-0 opacity-90" />
                {t(`settings.${tab.labelKey}`)}
              </Link>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
