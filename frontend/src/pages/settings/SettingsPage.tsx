import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import SettingsTabs from '../../components/tabs/SettingsTabs';
import { fetchJson, getServerUrl } from '../../utils';
import { showToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useKitchensStore } from '../../../stores/kitchensStore';
import { SearchIcon } from '../../components/icons';
import { useGlobalNumericField } from '../../contexts/GlobalNumericKeypadContext';

function PrinterPortInput({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const f = useGlobalNumericField(value, onChange);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={f.onFocus}
      placeholder={placeholder}
      className={className}
    />
  );
}

interface PrinterSetting {
  id: number;
  kitchen_id: number | null;
  printer_ip: string | null;
  printer_port: number;
  printer_type: 'kitchen' | 'customer';
  is_active: boolean;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const allKitchens = useKitchensStore((state) => state.kitchens);
  const kitchens = useMemo(
    () => allKitchens.filter((k) => k.is_active),
    [allKitchens],
  );
  const [_printerSettings, setPrinterSettings] = useState<PrinterSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<{ [key: string]: boolean }>({});
  const [testing, setTesting] = useState<{ [key: string]: boolean }>({});
  const [scanning, setScanning] = useState(false);
  const [discoveredPrinters, setDiscoveredPrinters] = useState<Array<{ ip: string; port: number }>>([]);
  const [scanningFor, setScanningFor] = useState<'customer' | number | null>(null);

  // Form state for each printer
  const [customerPrinterIp, setCustomerPrinterIp] = useState('');
  const [customerPrinterPort, setCustomerPrinterPort] = useState('9100');
  const [kitchenPrinterIps, setKitchenPrinterIps] = useState<{ [key: number]: string }>({});
  const [kitchenPrinterPorts, setKitchenPrinterPorts] = useState<{ [key: number]: string }>({});

  // Redirect non-admin/manager users to server settings
  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'manager') {
      navigate('/settings/server', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    // Only load data if user has permission
    if (user && (user.role === 'admin' || user.role === 'manager')) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const serverUrl = getServerUrl();
      
      // Get printer settings from Electron IPC
      let settings: PrinterSetting[] = [];
      if (window.sufra?.printers?.getSettings) {
        try {
          settings = await window.sufra.printers.getSettings();
          console.log('[SETTINGS] Got printer settings from Electron:', settings.length);
        } catch (e) {
          console.error('Failed to get printer settings from Electron:', e);
          showToast(t('settings.toastLoadPrintersFailed'), 'error');
        }
      } else {
        // Fallback to HTTP API
        try {
          settings = await fetchJson<PrinterSetting[]>(`${serverUrl}/printers/settings`);
        } catch (e) {
          console.warn('[SETTINGS] HTTP API fallback failed:', e);
        }
      }
      setPrinterSettings(settings);

      await useKitchensStore.getState().loadKitchens();
      const activeKitchens = useKitchensStore
        .getState()
        .kitchens.filter((k) => k.is_active);

      // Initialize form state from settings
      const customerSetting = settings.find(s => s.printer_type === 'customer' && s.kitchen_id === null);
      if (customerSetting) {
        setCustomerPrinterIp(customerSetting.printer_ip || '');
        setCustomerPrinterPort(String(customerSetting.printer_port || 9100));
      } else {
        setCustomerPrinterIp('');
        setCustomerPrinterPort('9100');
      }

      const kitchenIps: { [key: number]: string } = {};
      const kitchenPorts: { [key: number]: string } = {};
      activeKitchens.forEach(kitchen => {
        const kitchenSetting = settings.find(s => s.kitchen_id === kitchen.id && s.printer_type === 'kitchen');
        if (kitchenSetting) {
          kitchenIps[kitchen.id] = kitchenSetting.printer_ip || '';
          kitchenPorts[kitchen.id] = String(kitchenSetting.printer_port || 9100);
        } else {
          kitchenIps[kitchen.id] = '';
          kitchenPorts[kitchen.id] = '9100';
        }
      });
      setKitchenPrinterIps(kitchenIps);
      setKitchenPrinterPorts(kitchenPorts);
    } catch (error: any) {
      console.error('Failed to load printer data:', error);
      showToast(error.message || t('settings.toastLoadDataFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrinter = async (
    kitchenId: number | null,
    printerIp: string,
    printerPort: string,
  ) => {
    // Validate IP address
    if (printerIp && printerIp.trim() !== '') {
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(printerIp.trim())) {
        showToast(t('settings.toastInvalidIp'), 'error');
        return;
      }
    }

    // Validate port
    const port = parseInt(printerPort, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      showToast(t('settings.toastInvalidPort'), 'error');
      return;
    }

    const key = kitchenId === null ? 'customer' : `kitchen-${kitchenId}`;
    setSaving({ ...saving, [key]: true });

    try {
      if (window.sufra?.printers?.saveSettings) {
        // Electron mode: use IPC
        await window.sufra.printers.saveSettings({
          kitchen_id: kitchenId,
          printer_ip: printerIp.trim() || null,
          printer_port: port,
        });
        showToast(t('settings.toastSavePrinterOk'), 'success');
        await loadData();
      } else {
        // Browser/PWA mode: use HTTP API
        const serverUrl = getServerUrl();
        await fetchJson(`${serverUrl}/printers/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kitchen_id: kitchenId,
            printer_ip: printerIp.trim() || null,
            printer_port: port,
          }),
        });
        showToast(t('settings.toastSavePrinterOk'), 'success');
        await loadData();
      }
    } catch (e: any) {
      console.error('Failed to save printer setting:', e);
      showToast(t('settings.toastSaveFailed'), 'error');
    } finally {
      setSaving({ ...saving, [key]: false });
    }
  };

  const handleTestPrint = async (printerIp: string, printerPort: string) => {
    if (!printerIp || printerIp.trim() === '') {
      showToast(t('settings.toastEnterIpFirst'), 'warning');
      return;
    }

    // Validate IP address
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(printerIp.trim())) {
      showToast(t('settings.toastInvalidIp'), 'error');
      return;
    }

    // Validate port
    const port = parseInt(printerPort, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      showToast(t('settings.toastInvalidPort'), 'error');
      return;
    }

    const key = `test-${printerIp}`;
    setTesting({ ...testing, [key]: true });

    try {
      if (window.sufra?.printers?.test) {
        // Electron mode: use IPC
        const result = await window.sufra.printers.test({
          printer_ip: printerIp.trim(),
          printer_port: port,
        });
        if (result.success) {
          showToast(t('settings.toastTestSent'), 'success');
        } else {
          showToast(
            t('settings.toastTestFailed', {
              detail: result.error || t('settings.errorUnknown'),
            }),
            'error',
          );
        }
      } else {
        // Browser/PWA mode: use HTTP API
        const serverUrl = getServerUrl();
        const result = await fetchJson<{ success: boolean; error?: string }>(`${serverUrl}/printers/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            printer_ip: printerIp.trim(),
            printer_port: port,
          }),
        });
        if (result.success) {
          showToast(t('settings.toastTestSent'), 'success');
        } else {
          showToast(
            t('settings.toastTestFailed', {
              detail: result.error || t('settings.errorUnknown'),
            }),
            'error',
          );
        }
      }
    } catch (e: any) {
      console.error('Test print failed:', e);
      showToast(
        t('settings.toastTestSendFailed', { detail: e.message || t('settings.errorUnknown') }),
        'error',
      );
    } finally {
      setTesting({ ...testing, [key]: false });
    }
  };

  const handleScanPrinters = async (target: 'customer' | number) => {
    if (!window.sufra?.printers?.scan) {
      showToast(t('settings.toastScanDesktopOnly'), 'warning');
      return;
    }
    setScanningFor(target);
    setScanning(true);
    setDiscoveredPrinters([]);
    try {
      const printers = await window.sufra.printers.scan();
      setDiscoveredPrinters(printers);
      if (printers.length === 0) {
        showToast(t('settings.toastNoPrintersFound'), 'info');
      }
    } catch (e: any) {
      showToast(t('settings.toastScanFailed', { detail: e?.message || t('settings.errorUnknown') }), 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleSelectDiscoveredPrinter = (target: 'customer' | number, ip: string, port: number) => {
    if (target === 'customer') {
      setCustomerPrinterIp(ip);
      setCustomerPrinterPort(String(port));
    } else {
      setKitchenPrinterIps(prev => ({ ...prev, [target]: ip }));
      setKitchenPrinterPorts(prev => ({ ...prev, [target]: String(port) }));
    }
    setScanningFor(null);
  };

  return (
    <div className="flex flex-1 flex-col bg-cloud-soft-white">
      <Header title={t('nav.settings')} />
      <main className="flex-1 p-6">
        <section className="mx-auto max-w-7xl">
          <SettingsTabs />
          
          <div className="mt-6 rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
            <h2 className="mb-6 text-[20px] leading-tight font-semibold text-obsidian">
              {t('settings.printersThermalTitle')}
            </h2>

            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="text-center">
                  <div className="mb-4 inline-block h-8 w-8 rounded-full border-4 border-cyber-aqua border-t-transparent"></div>
                  <p className="text-[15px] leading-normal text-graphite">{t('settings.loading')}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Customer Receipt Printer */}
                <div className="rounded-soft-xl border-2 border-cyber-aqua/30 bg-cyber-aqua/5 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[18px] leading-tight font-semibold text-obsidian">
                      {t('settings.customerReceiptPrinter')}
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleTestPrint(customerPrinterIp, customerPrinterPort)}
                      disabled={testing[`test-${customerPrinterIp}`] || saving.customer}
                      className="rounded-soft-lg bg-cyber-aqua px-3 py-1.5 text-[13px] leading-relaxed font-medium text-white hover:bg-cyber-aqua/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {testing[`test-${customerPrinterIp}`]
                        ? t('settings.testPrintRunning')
                        : t('settings.testPrint')}
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[13px] leading-relaxed font-medium text-obsidian mb-1.5">
                        {t('settings.printerIp')}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customerPrinterIp}
                          onChange={(e) => setCustomerPrinterIp(e.target.value)}
                          placeholder="192.168.1.50"
                          className="flex-1 rounded-soft-lg border border-black/10 bg-white px-3 py-2 text-[15px] leading-normal text-obsidian focus:border-cyber-aqua focus:outline-none focus:ring-1 focus:ring-cyber-aqua"
                        />
                        {window.sufra?.printers?.scan && (
                          <button
                            type="button"
                            onClick={() => handleScanPrinters('customer')}
                            disabled={scanning}
                            className="flex shrink-0 items-center gap-1.5 rounded-soft-lg bg-cyber-aqua px-3 py-2 text-[13px] font-medium text-white hover:bg-cyber-aqua/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <SearchIcon className="h-4 w-4" />
                            {scanning && scanningFor === 'customer'
                              ? t('settings.searching')
                              : t('settings.search')}
                          </button>
                        )}
                      </div>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-graphite">
                        {t('settings.ipHelpCustomer')}
                      </p>
                      {scanningFor === 'customer' && discoveredPrinters.length > 0 && (
                        <div className="mt-2 rounded-soft-lg border border-cyber-aqua/30 bg-white p-2">
                          <p className="mb-2 text-[12px] font-medium text-obsidian">{t('settings.choosePrinter')}</p>
                          <ul className="space-y-1">
                            {discoveredPrinters.map((p) => (
                              <li key={p.ip}>
                                <button
                                  type="button"
                                  onClick={() => handleSelectDiscoveredPrinter('customer', p.ip, p.port)}
                                  className="w-full rounded-soft px-2 py-1.5 text-left text-[13px] text-obsidian hover:bg-cyber-aqua/10 transition-colors"
                                >
                                  {p.ip}:{p.port}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[13px] leading-relaxed font-medium text-obsidian mb-1.5">
                        {t('settings.port')}
                      </label>
                      <PrinterPortInput
                        value={customerPrinterPort}
                        onChange={setCustomerPrinterPort}
                        placeholder="9100"
                        className="w-full rounded-soft-lg border border-black/10 bg-white px-3 py-2 text-[15px] leading-normal text-obsidian focus:border-cyber-aqua focus:outline-none focus:ring-1 focus:ring-cyber-aqua"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSavePrinter(null, customerPrinterIp, customerPrinterPort)}
                      disabled={saving.customer}
                      className="w-full rounded-soft-lg bg-cyber-aqua px-4 py-2.5 text-[14px] leading-normal font-medium text-white hover:bg-cyber-aqua/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving.customer ? t('settings.saving') : t('settings.saveSettings')}
                    </button>
                  </div>
                </div>

                {/* Kitchen Printers */}
                {kitchens.map((kitchen) => (
                  <div
                    key={kitchen.id}
                    className="rounded-soft-xl border-2 border-emerald-200 bg-emerald-50 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-[18px] leading-tight font-semibold text-emerald-900">
                        {kitchen.name}
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleTestPrint(kitchenPrinterIps[kitchen.id] || '', kitchenPrinterPorts[kitchen.id] || '9100')}
                        disabled={testing[`test-${kitchenPrinterIps[kitchen.id]}`] || saving[`kitchen-${kitchen.id}`]}
                        className="rounded-soft-lg bg-emerald-600 px-3 py-1.5 text-[13px] leading-relaxed font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {testing[`test-${kitchenPrinterIps[kitchen.id]}`]
                          ? t('settings.testPrintRunning')
                          : t('settings.testPrint')}
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[13px] leading-relaxed font-medium text-obsidian mb-1.5">
                          {t('settings.printerIp')}
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={kitchenPrinterIps[kitchen.id] || ''}
                            onChange={(e) => setKitchenPrinterIps({ ...kitchenPrinterIps, [kitchen.id]: e.target.value })}
                            placeholder="192.168.1.50"
                            className="flex-1 rounded-soft-lg border border-black/10 bg-white px-3 py-2 text-[15px] leading-normal text-obsidian focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          {window.sufra?.printers?.scan && (
                            <button
                              type="button"
                              onClick={() => handleScanPrinters(kitchen.id)}
                              disabled={scanning}
                              className="flex shrink-0 items-center gap-1.5 rounded-soft-lg bg-emerald-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <SearchIcon className="h-4 w-4" />
                              {scanning && scanningFor === kitchen.id
                                ? t('settings.searching')
                                : t('settings.search')}
                            </button>
                          )}
                        </div>
                        {scanningFor === kitchen.id && discoveredPrinters.length > 0 && (
                          <div className="mt-2 rounded-soft-lg border border-emerald-200 bg-white p-2">
                            <p className="mb-2 text-[12px] font-medium text-obsidian">{t('settings.choosePrinter')}</p>
                            <ul className="space-y-1">
                              {discoveredPrinters.map((p) => (
                                <li key={p.ip}>
                                  <button
                                    type="button"
                                    onClick={() => handleSelectDiscoveredPrinter(kitchen.id, p.ip, p.port)}
                                    className="w-full rounded-soft px-2 py-1.5 text-left text-[13px] text-obsidian hover:bg-emerald-50 transition-colors"
                                  >
                                    {p.ip}:{p.port}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-[13px] leading-relaxed font-medium text-obsidian mb-1.5">
                          {t('settings.port')}
                        </label>
                        <PrinterPortInput
                          value={kitchenPrinterPorts[kitchen.id] || '9100'}
                          onChange={(v) =>
                            setKitchenPrinterPorts({ ...kitchenPrinterPorts, [kitchen.id]: v })
                          }
                          placeholder="9100"
                          className="w-full rounded-soft-lg border border-black/10 bg-white px-3 py-2 text-[15px] leading-normal text-obsidian focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSavePrinter(kitchen.id, kitchenPrinterIps[kitchen.id] || '', kitchenPrinterPorts[kitchen.id] || '9100')}
                        disabled={saving[`kitchen-${kitchen.id}`]}
                        className="w-full rounded-soft-lg bg-emerald-600 px-4 py-2.5 text-[14px] leading-normal font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {saving[`kitchen-${kitchen.id}`]
                          ? t('settings.saving')
                          : t('settings.saveSettings')}
                      </button>
                    </div>
                    {kitchen.description && (
                      <p className="mt-2 text-[13px] leading-relaxed text-graphite">
                        {kitchen.description}
                      </p>
                    )}
                  </div>
                ))}

                <div className="rounded-soft-xl border border-black/10 bg-cloud-soft-white p-4">
                  <p className="text-[13px] leading-relaxed text-graphite">{t('settings.printerFootnote')}</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
