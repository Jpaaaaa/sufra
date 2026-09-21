'use client';

import { useEffect, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { dateFormatLocale, languageBase } from '../../lib/app-locale';

function Clock() {
  const timeRef = useRef<HTMLDivElement>(null);
  const { i18n } = useTranslation();

  useEffect(() => {
    const locale = dateFormatLocale(i18n.language);
    const hour12 = languageBase(i18n.language) !== 'tr';

    const updateTime = () => {
      if (!timeRef.current) return;
      const now = new Date();
      const timeString = now.toLocaleTimeString(locale, {
        hour: 'numeric',
        minute: '2-digit',
        hour12,
      });
      const dateString = now.toLocaleDateString(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      });

      timeRef.current.innerHTML = `
          <div class="text-[16px] leading-normal font-bold text-obsidian">${timeString}</div>
          <div class="text-[13px] leading-relaxed font-light text-obsidian/60">${dateString}</div>
        `;
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [i18n.language]);

  return (
    <div
      ref={timeRef}
      className="flex flex-col items-end rounded-soft-lg border border-black/5 bg-white/60 px-4 py-2 backdrop-blur-sm shadow-soft whitespace-nowrap"
    />
  );
}

export default memo(Clock);
