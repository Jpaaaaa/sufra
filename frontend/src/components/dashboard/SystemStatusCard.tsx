'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { getServerConfig, extractIPFromHost } from '../../lib/server-config';
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
  multerResolvable: boolean;
  appPath: string;
}

export default function SystemStatusCard() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const [deviceType, setDeviceType] = useState<string>('حاسوب');
  const [, setServerMode] = useState<string>('Server');
  const [serverIP, setServerIP] = useState<string>('—');
  const [printerStatus, setPrinterStatus] = useState<{ connected: boolean; name: string }>({
    connected: false,
    name: 'غير متوفر',
  });
  const [apiRuntimeLine, setApiRuntimeLine] = useState<string>('—');
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Detect device type
    const detectDevice = () => {
      // Check if running in Electron
      const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
      if (isElectron) {
        setDeviceType('حاسوب');
        return;
      }

      // Check if PWA is installed (standalone mode)
      try {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                            (window.navigator as any).standalone === true;
        if (isStandalone) {
          setDeviceType('تطبيق PWA');
          return;
        }
      } catch (e) {
        // Ignore matchMedia errors
      }

      // Check if tablet (pointer: coarse)
      try {
        if (window.matchMedia('(pointer: coarse)').matches) {
          setDeviceType('جهاز لوحي');
          return;
        }
      } catch (e) {
        // Ignore matchMedia errors
      }

      // Default to desktop
      setDeviceType('حاسوب');
    };

    detectDevice();

    // Get server config
    try {
      const config = getServerConfig();
      setServerMode(config.mode === 'host' ? 'Server' : 'Client');
      const ip = extractIPFromHost(config.serverUrl);
      setServerIP(ip || config.serverUrl.replace(/^https?:\/\//, '').split(':')[0] || '—');
    } catch (error) {
      console.error('Failed to get server config:', error);
      setServerIP('—');
    }

    // Load printer status
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
        } else if (printers.length > 0) {
          setPrinterStatus({
            connected: false,
            name: printers[0].name || 'غير متوفر',
          });
        }
      } catch (error) {
        console.error('Failed to load printer status:', error);
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
        const mode = e.packaged ? 'نسخة مثبتة' : 'تطوير محلي';
        let line = `${mode} · v${e.version}`;
        if (!e.multerResolvable) {
          line += ' · ⚠ رفع الصور غير جاهز';
        }
        setApiRuntimeLine(line);
        if (import.meta.env.DEV && e.appPath) {
          console.info('[Sufra] API appPath:', e.appPath);
        }
      } catch {
        setApiRuntimeLine('تعذر الاتصال بالخادم');
      }
    };
    loadServerHealth();

    return () => {};
  }, []);

  const statusItems = [
    {
      label: 'الجهاز',
      value: deviceType,
      icon: MonitorSmartphone,
    },
    {
      label: 'الخادم',
      value: `${serverIP}`,
      icon: Server,
    },
    {
      label: 'وضع API (من يخدم 3333)',
      value: apiRuntimeLine,
      icon: Globe,
    },
    {
      label: 'الطابعة الحرارية',
      value: printerStatus.connected ? printerStatus.name : 'غير متصل',
      icon: Printer,
    },
    {
      label: 'المستخدم',
      value: user
        ? `${getEmployeeDisplayName(user.username)} (${roleLabelAr(user.role)})`
        : '—',
      icon: User,
    },
  ];

  return (
    <div data-i18n-lang={i18n.language}>
    <Card className="rounded-xl border border-black/5 bg-white shadow-soft p-6 mb-6">
      <h2 className="text-[20px] leading-tight font-medium text-obsidian mb-6">
        حالة النظام
      </h2>
      <div className="space-y-0">
        {statusItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={index}>
              <div className="flex items-center gap-4 py-3.5 px-2">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-cyber-aqua/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-cyber-aqua flex-shrink-0" />
                </div>
                <span className="text-[14px] leading-relaxed font-medium text-obsidian/70 min-w-[120px]">
                  {item.label}:
                </span>
                <span className="text-[14px] leading-relaxed font-medium text-obsidian flex-1">
                  {item.value}
                </span>
              </div>
              {index < statusItems.length - 1 && (
                <div className="h-px bg-black/5 mx-2" />
              )}
            </div>
          );
        })}
      </div>
    </Card>
    </div>
  );
}

