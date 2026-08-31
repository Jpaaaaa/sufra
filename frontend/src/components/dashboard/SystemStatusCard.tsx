'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { getServerConfig, extractIPFromHost, LAN_API_PORT, getServerUrl, getLanAddresses, preferredLanAddress } from '../../lib/server-config';
import { fetchJson } from '../../utils';
import { getBuildAppVersion } from '../../lib/brand';
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
      const isElectron = typeof window.sufra !== 'undefined';
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

      setDeviceType(t('home.systemDeviceBrowser'));
    };

    detectDevice();

    const loadServerAddress = async () => {
      try {
        const lan = await getLanAddresses();
        const preferred = lan ? preferredLanAddress(lan) : null;
        if (preferred?.ipv4) {
          setServerIP(`${preferred.ipv4}:${LAN_API_PORT}`);
          return;
        }
        const url = getServerUrl();
        const ip = extractIPFromHost(url);
        if (ip) {
          setServerIP(`${ip}:${LAN_API_PORT}`);
          return;
        }
        const host = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        setServerIP(host || '—');
      } catch {
        setServerIP('—');
      }
    };
    void loadServerAddress();

    const loadPrinterStatus = async () => {
      try {
        const serverUrl = getServerUrl();
        type Setting = {
          printer_type?: string;
          is_active?: boolean | number;
          printer_name?: string | null;
          printer_ip?: string | null;
          printer_port?: number;
        };
        const settings = await fetchJson<Setting[]>(`${serverUrl}/printers/settings`);
        const list = Array.isArray(settings) ? settings : [];
        const customer = list.find(
          (s) => s.printer_type === 'customer' && (s.is_active === true || s.is_active === 1),
        );
        if (customer?.printer_name?.trim()) {
          setPrinterStatus({ connected: true, name: customer.printer_name.trim() });
          return;
        }
        if (customer?.printer_ip?.trim()) {
          setPrinterStatus({
            connected: true,
            name: `${customer.printer_ip}:${customer.printer_port || 9100}`,
          });
          return;
        }
        const printers = await fetchJson<PrinterDevice[]>(`${serverUrl}/printers/available`);
        const usbPrinter = Array.isArray(printers) && printers.length > 0 ? printers[0] : null;
        if (usbPrinter?.name) {
          setPrinterStatus({ connected: true, name: usbPrinter.name });
          return;
        }
        setPrinterStatus({ connected: false, name: t('home.systemPrinterUnavailable') });
      } catch {
        setPrinterStatus({ connected: false, name: t('home.systemPrinterUnavailable') });
      }
    };

    void loadPrinterStatus();

    const loadServerHealth = async () => {
      try {
        const serverUrl = getServerUrl();
        const data = await fetchJson<{
          status?: string;
          database?: string;
          backendReady?: boolean;
          mode?: string;
          electron?: HealthElectronMeta;
        }>(`${serverUrl}/health`);
        const e = data.electron;
        const online =
          data.status === 'ok' || data.backendReady === true || data.mode === 'electron' || Boolean(e);
        if (e && (e.version || e.packaged !== undefined)) {
          const mode = e.packaged ? t('home.systemApiPackaged') : t('home.systemApiDev');
          let line = `${mode} · v${e.version || getBuildAppVersion()}`;
          if (data.database === 'ready') line += ` · ${t('home.systemApiDbReady')}`;
          if (e.uploadReady === false) line += ` · ${t('home.systemUploadWarn')}`;
          setApiRuntimeLine(line);
          return;
        }
        if (online) {
          const config = getServerConfig();
          const role = config.mode === 'host' ? t('home.systemApiHost') : t('home.systemApiClient');
          setApiRuntimeLine(`${t('home.systemApiOnline')} · ${role} · v${getBuildAppVersion()}`);
          return;
        }
        setApiRuntimeLine(t('home.systemApiUnreachable'));
      } catch {
        setApiRuntimeLine(t('home.systemApiUnreachable'));
      }
    };
    void loadServerHealth();

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
