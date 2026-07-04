import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Checks if the device is eligible for PWA install UI
 * Requirements:
 * - Touch device (pointer: coarse)
 * - Viewport width between 400px and 1200px
 * - NOT running in Electron
 */
export function isDeviceEligibleForPWAInstall(): boolean {
  // Check if running in Electron
  if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')) {
    return false;
  }

  // Check if touch device (pointer: coarse)
  if (typeof window !== 'undefined' && window.matchMedia) {
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
    if (!isTouchDevice) {
      return false;
    }

    // Check viewport width (400px <= width <= 1200px)
    const viewportWidth = window.innerWidth;
    if (viewportWidth < 400 || viewportWidth > 1200) {
      return false;
    }
  }

  return true;
}

/**
 * Hook to manage PWA install prompt
 * Only sets up listeners if device is eligible for PWA install
 */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isEligible, setIsEligible] = useState(false);

  useEffect(() => {
    let eligibleForPWAListeners = false;

    // Check if device is eligible on mount and when viewport changes
    const checkEligibility = () => {
      const eligible = isDeviceEligibleForPWAInstall();
      setIsEligible(eligible);
      
      // Clear installable state if device becomes ineligible
      if (!eligible) {
        setDeferredPrompt(null);
        setIsInstallable(false);
      }

      return eligible;
    };

    // Initial check
    eligibleForPWAListeners = checkEligibility();

    // Listen for viewport resize to update eligibility
    const handleResize = () => {
      eligibleForPWAListeners = checkEligibility();
    };

    window.addEventListener('resize', handleResize);

    // Set up PWA install listeners if device is eligible
    const handleBeforeInstallPrompt = (e: Event) => {
      // Double-check eligibility before processing
      if (!isDeviceEligibleForPWAInstall()) {
        return;
      }

      // Prevent the default mini-infobar from appearing
      e.preventDefault();
      // Store the event so it can be triggered later
      const event = e as BeforeInstallPromptEvent;
      setDeferredPrompt(event);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      // Clear the deferred prompt
      setDeferredPrompt(null);
      setIsInstallable(false);
      console.log('PWA was installed');
    };

    // Only add listeners if initially eligible
    if (eligibleForPWAListeners) {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (eligibleForPWAListeners) {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      }
    };
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPrompt || !isEligible) {
      return false;
    }

    try {
      // Show the install prompt
      await deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;

      // Clear the deferred prompt
      setDeferredPrompt(null);
      setIsInstallable(false);

      return outcome === 'accepted';
    } catch (error) {
      console.error('Error showing install prompt:', error);
      return false;
    }
  };

  return {
    isInstallable,
    isEligible,
    promptInstall,
  };
}

