'use client';

import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import Clock from '../layout/Clock';
import { getEmployeeDisplayName, roleLabelAr } from '../../lib/userDisplay';

export default function HeaderStatus() {
  const { i18n } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="flex items-center justify-between gap-4 mb-6" data-i18n-lang={i18n.language}>
      {/* Clock */}
      <Clock />

      {/* User Info */}
      {user && (
        <div className="flex items-center gap-3 rounded-lg border border-black/5 bg-white/60 px-4 py-2 backdrop-blur-sm">
          <div className="flex flex-col items-end">
            <span className="text-[15px] leading-normal font-medium text-obsidian">
              {getEmployeeDisplayName(user.username)}
            </span>
            <span className="text-[13px] leading-relaxed font-normal text-obsidian/60">
              {roleLabelAr(user.role)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

