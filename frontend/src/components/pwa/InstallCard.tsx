'use client';

import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Card, Button } from '../ui';

/**
 * PWA Install Card Component
 * Only renders when device is eligible (tablets/phones, not PC/Electron)
 */
export default function InstallCard() {
  const { isInstallable, isEligible, promptInstall } = usePWAInstall();

  // Don't render if device is not eligible
  if (!isEligible) {
    return null;
  }

  // Don't render if not installable (no prompt available yet)
  if (!isInstallable) {
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
    <Card className="p-6 bg-gradient-to-br from-cyber-aqua/10 to-cyber-aqua/5 border-cyber-aqua/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-soft-lg bg-cyber-aqua text-charcoal-graphite">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </div>
            <h3 className="text-[20px] leading-tight font-semibold text-obsidian">
              تثبيت تطبيق سفرة
            </h3>
          </div>
          <p className="text-[15px] leading-normal font-light text-obsidian/70 mb-4">
            ثبّت التطبيق على جهازك للوصول السريع وتجربة أفضل. يعمل التطبيق حتى بدون اتصال بالإنترنت.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={handleInstallClick}
          className="flex-shrink-0"
        >
          تثبيت الآن
        </Button>
      </div>
    </Card>
  );
}

