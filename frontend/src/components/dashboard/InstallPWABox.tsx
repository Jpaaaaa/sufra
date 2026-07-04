'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import Card from '../ui/Card';
import Button from '../ui/Button';

export default function InstallPWABox() {
  const { t } = useTranslation();
  const { isInstallable, isEligible, promptInstall } = usePWAInstall();
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // Check all conditions
    const checkConditions = () => {
      // Check if Electron
      if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')) {
        setShouldRender(false);
        return;
      }

      // Check if touch device
      if (typeof window !== 'undefined' && window.matchMedia) {
        const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
        if (!isTouchDevice) {
          setShouldRender(false);
          return;
        }

        // Check viewport width (400px <= width <= 1200px)
        const viewportWidth = window.innerWidth;
        if (viewportWidth < 400 || viewportWidth > 1200) {
          setShouldRender(false);
          return;
        }
      }

      // All conditions met, check if installable
      setShouldRender(isInstallable && isEligible);
    };

    checkConditions();
    
    // Re-check on resize
    const handleResize = () => checkConditions();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isInstallable, isEligible]);

  if (!shouldRender) {
    return null;
  }

  const handleInstallClick = async () => {
    const accepted = await promptInstall();
    if (accepted) {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-cyber-aqua/10 to-cyber-aqua/5 border-cyber-aqua/20 mb-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-soft-lg bg-cyber-aqua text-charcoal-graphite">
            <span className="text-2xl">📱</span>
          </div>
          <div>
            <h3 className="text-[18px] leading-tight font-semibold text-obsidian mb-1">{t('home.pwaTitle')}</h3>
            <p className="text-[13px] leading-relaxed font-light text-obsidian/70">{t('home.pwaSubtitle')}</p>
          </div>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={handleInstallClick}
          className="flex-shrink-0"
        >
          {t('home.pwaInstall')}
        </Button>
      </div>
    </Card>
  );
}

