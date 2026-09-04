'use client';

import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Server } from 'lucide-react';
import SystemStatusCard from './SystemStatusCard';
import { homeUi } from './home-ui';

function SystemStatusAccordion() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <section className={`${homeUi.surface} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-start ${homeUi.rowHover}`}
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2">
          <span className={homeUi.iconWell}>
            <Server className="h-4 w-4" aria-hidden />
          </span>
          <span className={homeUi.sectionTitle}>{t('home.systemStatusTitle')}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-obsidian/40 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="border-t border-black/5 px-2 pb-2 pt-1">
          <SystemStatusCard embedded />
        </div>
      ) : null}
    </section>
  );
}

export default memo(SystemStatusAccordion);
