import { useEffect, useState } from 'react';
import { useOrderSocket } from '../../../hooks/useOrderSocket';

export type PosConnectionStatus = 'connected' | 'reconnecting' | 'offline';

export function usePosConnectionStatus(): PosConnectionStatus {
  const { isConnected } = useOrderSocket();
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [socketOk, setSocketOk] = useState(() => isConnected());

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const id = window.setInterval(() => setSocketOk(isConnected()), 1000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(id);
    };
  }, [isConnected]);

  if (!online) return 'offline';
  if (!socketOk) return 'reconnecting';
  return 'connected';
}

export function PosConnectionDot() {
  const status = usePosConnectionStatus();
  const color =
    status === 'connected' ? '#10b981' : status === 'reconnecting' ? '#f59e0b' : '#ef4444';
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full"
      style={{ background: color }}
      aria-label={status}
    />
  );
}
