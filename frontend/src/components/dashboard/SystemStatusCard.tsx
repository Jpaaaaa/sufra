'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { getServerConfig, extractIPFromHost, LAN_API_PORT } from '../../lib/server-config';
import { getServerUrl, fetchJson } from '../../utils';
import { MonitorSmartphone, Printer, User, Server, Globe } from 'lucide-react';
import Card from '../ui/Card';
import { getEmployeeDisplayName, roleLabelAr } from '../../lib/userDisplay';

interface PrinterDevice {
  name: string;
  isDefault: boolean;
  status?: string;
}

interface HealthElectronMeta {
  packaged: boolean;
  runtime: 'packaged' | 'development';
  version: string;
  multerResolvable?: boolean;
  uploadReady?: boolean;
  appPath: string;
}

interface SystemStatusCardProps {
  /** When true, omit outer card chrome (used inside accordion). */
  embedded?: boolean;
}

export default function SystemStatusCard({ embedded = false }: SystemStatusCardProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [deviceType, setDeviceType] = useState<string>('—');
  const [serverIP, setServerIP] = useState<string>('—');
  const [printerStatus, setPrinterStatus] = useState<{ connected: boolean; name: string }>({
    connected: false,
    name: '—',
  });
  const [apiRuntimeLine, setApiRuntimeLine] = useState<string>('—');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const detectDevice = () => {
      const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
      if (isElectron) {
        setDeviceType(t('home.systemDeviceDesktop'));
        return;
      }

      try {
        const isStandalone =
          window.matchMedia('(display-mode: standalone)').matches ||
          (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
        if (isStandalone) {
          setDeviceType(t('home.systemDevicePwa'));
          return;
        }
      } catch {
        // ignore
      }

      try {
        if (window.matchMedia('(pointer: coarse)').matches) {
          setDeviceType(t('home.systemDeviceTablet'));
          return;
        }
      } catch {
        // ignore
      }

      setDeviceType(t('home.systemDeviceDesktop'));
    };

    detectDevice();

    try {
      const config = getServerConfig();
      const ip = extractIPFromHost(config.serverUrl);
      setServerIP(ip || config.serverUrl.replace(/^https?:\/\//, '').split(':')[0] || '—');
    } catch (error) {
      console.error('Failed to get server config:', error);
      setServerIP('—');
    }

    const loadPrinterStatus = async () => {
      try {
        const serverUrl = getServerUrl();
        const printers = await fetchJson<PrinterDevice[]>(`${serverUrl}/printers/available`);
        const usbPrinter = printers.length > 0 ? printers[0] : null;
        if (usbPrinter) {
          setPrinterStatus({
            connected: true,
            name: usbPrinter.name,
          });
        } else {
          setPrinterStatus({
            connected: false,
            name: t('home.systemPrinterUnavailable'),
          });
        }
      } catch (error) {
        console.error('Failed to load printer status:', error);
        setPrinterStatus({ connected: false, name: t('home.systemPrinterUnavailable') });
      }
    };

    loadPrinterStatus();

    const loadServerHealth = async () => {
      try {
        const serverUrl = getServerUrl();
        const data = await fetchJson<{ electron?: HealthElectronMeta }>(`${serverUrl}/health`);
        const e = data.electron;
        if (!e) {
          setApiRuntimeLine('—');
          return;
        }
        const mode = e.packaged ? t('home.systemApiPackaged') : t('home.systemApiDev');
        let line = `${mode} · v${e.version}`;
        if (!e.uploadReady && !e.multerResolvable) {
          line += ` · ${t('home.systemUploadWarn')}`;
        }
        setApiRuntimeLine(line);
        if (import.meta.env.DEV && e.appPath) {
          console.info('[Sufra] API appPath:', e.appPath);
        }
      } catch {
        setApiRuntimeLine(t('home.systemApiUnreachable'));
      }
    };
    loadServerHealth();

    return () => {};
  }, [t]);

  const statusItems = [
    {
      label: t('home.systemLabelDevice'),
      value: deviceType,
      icon: MonitorSmartphone,
    },
    {
      label: t('home.systemLabelServer'),
      value: `${serverIP}`,
      icon: Server,
    },
    {
      label: t('home.systemLabelApi', { port: LAN_API_PORT }),
      value: apiRuntimeLine,
      icon: Globe,
    },
    {
      label: t('home.systemLabelPrinter'),
      value: printerStatus.connected ? printerStatus.name : t('home.systemPrinterDisconnected'),
      icon: Printer,
    },
    {
      label: t('home.systemLabelUser'),
      value: user
        ? `${getEmployeeDisplayName(user.username)} (${roleLabelAr(user.role)})`
        : '—',
      icon: User,
    },
  ];

  const body = (
    <div data-i18n-lang={i18n.language}>
      {!embedded ? (
        <h2 className="mb-5 text-[18px] font-semibold tracking-tight text-obsidian">
          {t('home.systemStatusTitle')}
        </h2>
      ) : null}
      <div className="space-y-0">
        {statusItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={item.label}>
              <div className="flex items-center gap-4 px-2 py-3.5">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-cyber-aqua/10">
                  <Icon className="h-5 w-5 flex-shrink-0 text-cyber-aqua" />
                </div>
                <span className="min-w-[120px] text-[14px] font-medium leading-relaxed text-obsidian/65">
                  {item.label}:
                </span>
                <span className="flex-1 text-[14px] font-medium leading-relaxed text-obsidian">
                  {item.value}
                </span>
              </div>
              {index < statusItems.length - 1 ? <div className="mx-2 h-px bg-black/5" /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );

  if (embedded) {
    return body;
  }

  return (
    <Card className="mb-6 rounded-2xl border border-black/5 bg-white p-6 shadow-soft">{body}</Card>
  );
}
