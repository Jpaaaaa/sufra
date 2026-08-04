'use client';

import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_BRAND_NAME, getBuildAppVersion, resolveAppVersion } from '../../lib/brand';

function Footer() {
  const { t } = useTranslation();
  const [version, setVersion] = useState(getBuildAppVersion());

  useEffect(() => {
    let cancelled = false;
    void resolveAppVersion().then((v) => {
      if (!cancelled) setVersion(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer className="glass-matte flex h-12 items-center border-t border-black/5 px-6 text-[13px] font-normal text-graphite leading-relaxed">
      <div className="flex w-full items-center justify-between">
        <span className="font-medium text-obsidian">
          © {new Date().getFullYear()} {APP_BRAND_NAME}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-cyber-aqua" />
          {t('layout.footerVersion', { version })}
        </span>
      </div>
    </footer>
  );
}

export default memo(Footer);
