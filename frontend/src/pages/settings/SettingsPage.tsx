import { useEffect, useState, useMemo, useCallback } from 'react';
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
import SettingsRecipePrintPreviewModal from './SettingsRecipePrintPreviewModal';

type ConnectionType = 'network' | 'windows_spooler';

interface PrinterSetting {
  id: number;
  kitchen_id: number | null;
  connection_type?: ConnectionType;
  printer_ip: string | null;
  printer_port: number;
  printer_name?: string | null;
  printer_type: 'kitchen' | 'customer';
  is_active: boolean;
}

type WindowsPrinter = { name: string; isDefault: boolean; status?: string };

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

function ConnectionTypeToggle({
  value,
  onChange,
  accent,
  disabled,
}: {
  value: ConnectionType;
  onChange: (v: ConnectionType) => void;
  accent: 'aqua' | 'emerald';
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const active =
    accent === 'aqua'
      ? 'bg-cyber-aqua text-white'
      : 'bg-emerald-600 text-white';
  const idle = 'bg-white text-obsidian hover:bg-black/5';
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium leading-relaxed text-obsidian">
        {t('settings.connectionType')}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('network')}
          className={`rounded-soft-lg border border-black/10 px-3 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 ${
            value === 'network' ? active : idle
          }`}
        >
          {t('settings.connectionNetwork')}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('windows_spooler')}
          className={`rounded-soft-lg border border-black/10 px-3 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 ${
            value === 'windows_spooler' ? active : idle
          }`}
        >
          {t('settings.connectionWindows')}
        </button>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-graphite">
        {value === 'windows_spooler'
          ? t('settings.connectionWindowsHelp')
          : t('settings.connectionNetworkHelp')}
      </p>
    </div>
  );
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<{ [key: string]: boolean }>({});
  const [testing, setTesting] = useState<{ [key: string]: boolean }>({});
  const [scanning, setScanning] = useState(false);
  const [discoveredPrinters, setDiscoveredPrinters] = useState<
    Array<{ ip: string; port: number }>
  >([]);
  const [scanningFor, setScanningFor] = useState<'customer' | number | null>(null);

  const [windowsPrinters, setWindowsPrinters] = useState<WindowsPrinter[]>([]);
  const [loadingWindowsPrinters, setLoadingWindowsPrinters] = useState(false);

  const [customerConnection, setCustomerConnection] =
    useState<ConnectionType>('network');
  const [customerPrinterIp, setCustomerPrinterIp] = useState('');
  const [customerPrinterPort, setCustomerPrinterPort] = useState('9100');
  const [customerPrinterName, setCustomerPrinterName] = useState('');

  const [kitchenConnections, setKitchenConnections] = useState<{
    [key: number]: ConnectionType;
  }>({});
  const [kitchenPrinterIps, setKitchenPrinterIps] = useState<{
    [key: number]: string;
  }>({});
  const [kitchenPrinterPorts, setKitchenPrinterPorts] = useState<{
    [key: number]: string;
  }>({});
  const [kitchenPrinterNames, setKitchenPrinterNames] = useState<{
    [key: number]: string;
  }>({});

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');

  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'manager') {
      navigate('/settings/server', { replace: true });
    }
  }, [user, navigate]);

  const loadWindowsPrinters = useCallback(async (forceRefresh = false) => {
    if (!window.sufra?.printers?.available && !window.sufra?.print?.getPrinters) {
      return;
    }
    setLoadingWindowsPrinters(true);
    try {
      const list =
        (await window.sufra.printers?.available?.(forceRefresh)) ||
        (await window.sufra.print?.getPrinters?.()) ||
        [];
      setWindowsPrinters(list);
    } catch (e) {
      console.error('Failed to load Windows printers:', e);
      setWindowsPrinters([]);
    } finally {
      setLoadingWindowsPrinters(false);
    }
  }, []);

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'manager')) {
      loadData();
      loadWindowsPrinters();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const serverUrl = getServerUrl();

      let settings: PrinterSetting[] = [];
      if (window.sufra?.printers?.getSettings) {
        try {
          settings = await window.sufra.printers.getSettings();
        } catch (e) {
          console.error('Failed to get printer settings from Electron:', e);
          showToast(t('settings.toastLoadPrintersFailed'), 'error');
        }
      } else {
        try {
          settings = await fetchJson<PrinterSetting[]>(
            `${serverUrl}/printers/settings`,
          );
        } catch (e) {
          console.warn('[SETTINGS] HTTP API fallback failed:', e);
        }
      }

      await useKitchensStore.getState().loadKitchens();
      const activeKitchens = useKitchensStore
        .getState()
        .kitchens.filter((k) => k.is_active);

      const customerSetting = settings.find(
        (s) => s.printer_type === 'customer' && s.kitchen_id === null,
      );
      if (customerSetting) {
        setCustomerConnection(
          customerSetting.connection_type === 'windows_spooler'
            ? 'windows_spooler'
            : 'network',
        );
        setCustomerPrinterIp(customerSetting.printer_ip || '');
        setCustomerPrinterPort(String(customerSetting.printer_port || 9100));
        setCustomerPrinterName(customerSetting.printer_name || '');
      } else {
        setCustomerConnection('network');
        setCustomerPrinterIp('');
        setCustomerPrinterPort('9100');
        setCustomerPrinterName('');
      }

      const kitchenIps: { [key: number]: string } = {};
      const kitchenPorts: { [key: number]: string } = {};
      const kitchenNames: { [key: number]: string } = {};
      const kitchenConn: { [key: number]: ConnectionType } = {};
      activeKitchens.forEach((kitchen) => {
        const kitchenSetting = settings.find(
          (s) => s.kitchen_id === kitchen.id && s.printer_type === 'kitchen',
        );
        if (kitchenSetting) {
          kitchenConn[kitchen.id] =
            kitchenSetting.connection_type === 'windows_spooler'
              ? 'windows_spooler'
              : 'network';
          kitchenIps[kitchen.id] = kitchenSetting.printer_ip || '';
          kitchenPorts[kitchen.id] = String(kitchenSetting.printer_port || 9100);
          kitchenNames[kitchen.id] = kitchenSetting.printer_name || '';
        } else {
          kitchenConn[kitchen.id] = 'network';
          kitchenIps[kitchen.id] = '';
          kitchenPorts[kitchen.id] = '9100';
          kitchenNames[kitchen.id] = '';
        }
      });
      setKitchenConnections(kitchenConn);
      setKitchenPrinterIps(kitchenIps);
      setKitchenPrinterPorts(kitchenPorts);
      setKitchenPrinterNames(kitchenNames);
    } catch (error: any) {
      console.error('Failed to load printer data:', error);
      showToast(error.message || t('settings.toastLoadDataFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrinter = async (kitchenId: number | null) => {
    const isCustomer = kitchenId === null;
    const connectionType = isCustomer
      ? customerConnection
      : kitchenConnections[kitchenId] || 'network';
    const printerIp = isCustomer
      ? customerPrinterIp
      : kitchenPrinterIps[kitchenId] || '';
    const printerPort = isCustomer
      ? customerPrinterPort
      : kitchenPrinterPorts[kitchenId] || '9100';
    const printerName = isCustomer
      ? customerPrinterName
      : kitchenPrinterNames[kitchenId] || '';

    if (connectionType === 'network' && printerIp.trim()) {
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(printerIp.trim())) {
        showToast(t('settings.toastInvalidIp'), 'error');
        return;
      }
    }

    const port = parseInt(printerPort, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      showToast(t('settings.toastInvalidPort'), 'error');
      return;
    }

    const key = isCustomer ? 'customer' : `kitchen-${kitchenId}`;
    setSaving({ ...saving, [key]: true });

    const payload = {
      kitchen_id: kitchenId,
      connection_type: connectionType,
      printer_ip: printerIp.trim() || null,
      printer_port: port,
      printer_name: printerName.trim() || null,
    };

    try {
      if (window.sufra?.printers?.saveSettings) {
        await window.sufra.printers.saveSettings(payload);
      } else {
        const serverUrl = getServerUrl();
        await fetchJson(`${serverUrl}/printers/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      showToast(t('settings.toastSavePrinterOk'), 'success');
      await loadData();
    } catch (e: any) {
      console.error('Failed to save printer setting:', e);
      showToast(t('settings.toastSaveFailed'), 'error');
    } finally {
      setSaving({ ...saving, [key]: false });
    }
  };

  const runTest = async (
    key: string,
    payload: {
      connection_type?: ConnectionType;
      printer_ip?: string | null;
      printer_port?: number;
      printer_name?: string | null;
      kitchen_id?: number | null;
      kind?: 'customer' | 'kitchen';
      kitchen_name?: string;
      use_saved?: boolean;
    },
  ) => {
    setTesting((prev) => ({ ...prev, [key]: true }));
    try {
      let result: { success: boolean; error?: string };
      if (window.sufra?.printers?.test) {
        result = await window.sufra.printers.test(payload);
      } else {
        const serverUrl = getServerUrl();
        result = await fetchJson(`${serverUrl}/printers/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
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
    } catch (e: any) {
      console.error('Test print failed:', e);
      showToast(
        t('settings.toastTestSendFailed', {
          detail: e.message || t('settings.errorUnknown'),
        }),
        'error',
      );
    } finally {
      setTesting((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleTestFromForm = async (kitchenId: number | null) => {
    const isCustomer = kitchenId === null;
    const connectionType = isCustomer
      ? customerConnection
      : kitchenConnections[kitchenId!] || 'network';
    const printerIp = isCustomer
      ? customerPrinterIp
      : kitchenPrinterIps[kitchenId!] || '';
    const printerPort = isCustomer
      ? customerPrinterPort
      : kitchenPrinterPorts[kitchenId!] || '9100';
    const printerName = isCustomer
      ? customerPrinterName
      : kitchenPrinterNames[kitchenId!] || '';

    if (connectionType === 'network') {
      if (!printerIp.trim()) {
        showToast(t('settings.toastEnterIpFirst'), 'warning');
        return;
      }
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(printerIp.trim())) {
        showToast(t('settings.toastInvalidIp'), 'error');
        return;
      }
    } else if (!printerName.trim()) {
      showToast(t('settings.toastEnterPrinterNameFirst'), 'warning');
      return;
    }

    const port = parseInt(printerPort, 10);
    if (connectionType === 'network' && (isNaN(port) || port < 1 || port > 65535)) {
      showToast(t('settings.toastInvalidPort'), 'error');
      return;
    }

    const key = isCustomer ? 'test-customer-form' : `test-kitchen-form-${kitchenId}`;
    await runTest(key, {
      connection_type: connectionType,
      printer_ip: connectionType === 'network' ? printerIp.trim() : null,
      printer_port: port || 9100,
      printer_name: connectionType === 'windows_spooler' ? printerName.trim() : null,
      kind: isCustomer ? 'customer' : 'kitchen',
      kitchen_name: isCustomer
        ? undefined
        : kitchens.find((k) => k.id === kitchenId)?.name,
    });
  };

  const handleTestSaved = async (kitchenId: number | null) => {
    const key =
      kitchenId === null ? 'test-customer-saved' : `test-kitchen-saved-${kitchenId}`;
    await runTest(key, {
      use_saved: true,
      kitchen_id: kitchenId,
      kind: kitchenId === null ? 'customer' : 'kitchen',
      kitchen_name:
        kitchenId === null
          ? undefined
          : kitchens.find((k) => k.id === kitchenId)?.name,
    });
  };

  const handlePreview = async (kind: 'customer' | 'kitchen', kitchenId?: number) => {
    setPreviewTitle(
      kind === 'customer'
        ? t('settings.previewCustomerTitle')
        : t('settings.previewKitchenTitle', {
            name: kitchens.find((k) => k.id === kitchenId)?.name || '',
          }),
    );
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewSrc(null);
    try {
      let result:
        | { success: true; imageBase64: string }
        | { success: false; error: string };
      if (window.sufra?.printers?.preview) {
        result = await window.sufra.printers.preview({
          kind,
          kitchen_id: kind === 'kitchen' ? kitchenId ?? null : null,
          kitchen_name:
            kind === 'kitchen'
              ? kitchens.find((k) => k.id === kitchenId)?.name
              : undefined,
        });
      } else {
        const serverUrl = getServerUrl();
        result = await fetchJson(`${serverUrl}/api/printers/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind,
            kitchen_name:
              kind === 'kitchen'
                ? kitchens.find((k) => k.id === kitchenId)?.name
                : undefined,
          }),
        });
      }
      if (result.success) {
        setPreviewSrc(`data:image/png;base64,${result.imageBase64}`);
      } else {
        showToast(
          t('settings.toastPreviewFailed', {
            detail: result.error || t('settings.errorUnknown'),
          }),
          'error',
        );
        setPreviewOpen(false);
      }
    } catch (e: any) {
      showToast(
        t('settings.toastPreviewFailed', {
          detail: e?.message || t('settings.errorUnknown'),
        }),
        'error',
      );
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
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
      showToast(
        t('settings.toastScanFailed', {
          detail: e?.message || t('settings.errorUnknown'),
        }),
        'error',
      );
    } finally {
      setScanning(false);
    }
  };

  const handleSelectDiscoveredPrinter = (
    target: 'customer' | number,
    ip: string,
    port: number,
  ) => {
    if (target === 'customer') {
      setCustomerPrinterIp(ip);
      setCustomerPrinterPort(String(port));
    } else {
      setKitchenPrinterIps((prev) => ({ ...prev, [target]: ip }));
      setKitchenPrinterPorts((prev) => ({ ...prev, [target]: String(port) }));
    }
    setScanningFor(null);
  };

  const inputClass = (accent: 'aqua' | 'emerald') =>
    accent === 'aqua'
      ? 'w-full rounded-soft-lg border border-black/10 bg-white px-3 py-2 text-[15px] leading-normal text-obsidian focus:border-cyber-aqua focus:outline-none focus:ring-1 focus:ring-cyber-aqua'
      : 'w-full rounded-soft-lg border border-black/10 bg-white px-3 py-2 text-[15px] leading-normal text-obsidian focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';

  const renderWindowsSelect = (
    value: string,
    onChange: (v: string) => void,
    accent: 'aqua' | 'emerald',
  ) => (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium leading-relaxed text-obsidian">
        {t('settings.windowsPrinterName')}
      </label>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass(accent)}
        >
          <option value="">{t('settings.windowsPrinterPlaceholder')}</option>
          {value && !windowsPrinters.some((p) => p.name === value) ? (
            <option value={value}>{value}</option>
          ) : null}
          {windowsPrinters.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
              {p.isDefault ? ` (${t('settings.windowsPrinterDefault')})` : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => loadWindowsPrinters(true)}
          disabled={loadingWindowsPrinters}
          className={`flex shrink-0 items-center gap-1.5 rounded-soft-lg px-3 py-2 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${
            accent === 'aqua'
              ? 'bg-cyber-aqua hover:bg-cyber-aqua/90'
              : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {loadingWindowsPrinters
            ? t('settings.refreshing')
            : t('settings.refreshList')}
        </button>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-graphite">
        {t('settings.windowsPrinterHelp')}
      </p>
    </div>
  );

  const renderNetworkFields = (
    target: 'customer' | number,
    ip: string,
    setIp: (v: string) => void,
    port: string,
    setPort: (v: string) => void,
    accent: 'aqua' | 'emerald',
  ) => (
    <>
      <div>
        <label className="mb-1.5 block text-[13px] font-medium leading-relaxed text-obsidian">
          {t('settings.printerIp')}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="192.168.1.50"
            className={`flex-1 ${inputClass(accent)}`}
          />
          {window.sufra?.printers?.scan && (
            <button
              type="button"
              onClick={() => handleScanPrinters(target)}
              disabled={scanning}
              className={`flex shrink-0 items-center gap-1.5 rounded-soft-lg px-3 py-2 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                accent === 'aqua'
                  ? 'bg-cyber-aqua hover:bg-cyber-aqua/90'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <SearchIcon className="h-4 w-4" />
              {scanning && scanningFor === target
                ? t('settings.searching')
                : t('settings.search')}
            </button>
          )}
        </div>
        {target === 'customer' && (
          <p className="mt-1.5 text-[12px] leading-relaxed text-graphite">
            {t('settings.ipHelpCustomer')}
          </p>
        )}
        {scanningFor === target && discoveredPrinters.length > 0 && (
          <div
            className={`mt-2 rounded-soft-lg border bg-white p-2 ${
              accent === 'aqua' ? 'border-cyber-aqua/30' : 'border-emerald-200'
            }`}
          >
            <p className="mb-2 text-[12px] font-medium text-obsidian">
              {t('settings.choosePrinter')}
            </p>
            <ul className="space-y-1">
              {discoveredPrinters.map((p) => (
                <li key={p.ip}>
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectDiscoveredPrinter(target, p.ip, p.port)
                    }
                    className={`w-full rounded-soft px-2 py-1.5 text-left text-[13px] text-obsidian transition-colors ${
                      accent === 'aqua'
                        ? 'hover:bg-cyber-aqua/10'
                        : 'hover:bg-emerald-50'
                    }`}
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
        <label className="mb-1.5 block text-[13px] font-medium leading-relaxed text-obsidian">
          {t('settings.port')}
        </label>
        <PrinterPortInput
          value={port}
          onChange={setPort}
          placeholder="9100"
          className={inputClass(accent)}
        />
      </div>
    </>
  );

  return (
    <div className="flex flex-1 flex-col bg-cloud-soft-white">
      <Header title={t('nav.settings')} />
      <main className="flex-1 p-6">
        <section className="mx-auto max-w-7xl">
          <SettingsTabs />

          <div className="mt-6 rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
            <h2 className="mb-6 text-[20px] font-semibold leading-tight text-obsidian">
              {t('settings.printersThermalTitle')}
            </h2>

            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="text-center">
                  <div className="mb-4 inline-block h-8 w-8 rounded-full border-4 border-cyber-aqua border-t-transparent" />
                  <p className="text-[15px] leading-normal text-graphite">
                    {t('settings.loading')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Customer */}
                <div className="rounded-soft-xl border-2 border-cyber-aqua/30 bg-cyber-aqua/5 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-[18px] font-semibold leading-tight text-obsidian">
                      {t('settings.customerReceiptPrinter')}
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleTestFromForm(null)}
                      disabled={
                        testing['test-customer-form'] || saving.customer
                      }
                      className="rounded-soft-lg bg-cyber-aqua px-3 py-1.5 text-[13px] font-medium leading-relaxed text-white transition-colors hover:bg-cyber-aqua/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {testing['test-customer-form']
                        ? t('settings.testPrintRunning')
                        : t('settings.testPrint')}
                    </button>
                  </div>
                  <div className="space-y-3">
                    <ConnectionTypeToggle
                      value={customerConnection}
                      onChange={setCustomerConnection}
                      accent="aqua"
                      disabled={saving.customer}
                    />
                    {customerConnection === 'network'
                      ? renderNetworkFields(
                          'customer',
                          customerPrinterIp,
                          setCustomerPrinterIp,
                          customerPrinterPort,
                          setCustomerPrinterPort,
                          'aqua',
                        )
                      : renderWindowsSelect(
                          customerPrinterName,
                          setCustomerPrinterName,
                          'aqua',
                        )}
                    <button
                      type="button"
                      onClick={() => handleSavePrinter(null)}
                      disabled={saving.customer}
                      className="w-full rounded-soft-lg bg-cyber-aqua px-4 py-2.5 text-[14px] font-medium leading-normal text-white transition-colors hover:bg-cyber-aqua/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving.customer
                        ? t('settings.saving')
                        : t('settings.saveSettings')}
                    </button>
                  </div>
                </div>

                {/* Kitchens */}
                {kitchens.map((kitchen) => {
                  const conn =
                    kitchenConnections[kitchen.id] || 'network';
                  return (
                    <div
                      key={kitchen.id}
                      className="rounded-soft-xl border-2 border-emerald-200 bg-emerald-50 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="text-[18px] font-semibold leading-tight text-emerald-900">
                          {kitchen.name}
                        </h3>
                        <button
                          type="button"
                          onClick={() => handleTestFromForm(kitchen.id)}
                          disabled={
                            testing[`test-kitchen-form-${kitchen.id}`] ||
                            saving[`kitchen-${kitchen.id}`]
                          }
                          className="rounded-soft-lg bg-emerald-600 px-3 py-1.5 text-[13px] font-medium leading-relaxed text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {testing[`test-kitchen-form-${kitchen.id}`]
                            ? t('settings.testPrintRunning')
                            : t('settings.testPrint')}
                        </button>
                      </div>
                      <div className="space-y-3">
                        <ConnectionTypeToggle
                          value={conn}
                          onChange={(v) =>
                            setKitchenConnections((prev) => ({
                              ...prev,
                              [kitchen.id]: v,
                            }))
                          }
                          accent="emerald"
                          disabled={saving[`kitchen-${kitchen.id}`]}
                        />
                        {conn === 'network'
                          ? renderNetworkFields(
                              kitchen.id,
                              kitchenPrinterIps[kitchen.id] || '',
                              (v) =>
                                setKitchenPrinterIps((prev) => ({
                                  ...prev,
                                  [kitchen.id]: v,
                                })),
                              kitchenPrinterPorts[kitchen.id] || '9100',
                              (v) =>
                                setKitchenPrinterPorts((prev) => ({
                                  ...prev,
                                  [kitchen.id]: v,
                                })),
                              'emerald',
                            )
                          : renderWindowsSelect(
                              kitchenPrinterNames[kitchen.id] || '',
                              (v) =>
                                setKitchenPrinterNames((prev) => ({
                                  ...prev,
                                  [kitchen.id]: v,
                                })),
                              'emerald',
                            )}
                        <button
                          type="button"
                          onClick={() => handleSavePrinter(kitchen.id)}
                          disabled={saving[`kitchen-${kitchen.id}`]}
                          className="w-full rounded-soft-lg bg-emerald-600 px-4 py-2.5 text-[14px] font-medium leading-normal text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                  );
                })}

                {/* Preview section */}
                <div className="rounded-soft-xl border border-black/10 bg-cloud-soft-white p-4">
                  <h3 className="mb-1 text-[17px] font-semibold text-obsidian">
                    {t('settings.previewSectionTitle')}
                  </h3>
                  <p className="mb-3 text-[13px] leading-relaxed text-graphite">
                    {t('settings.previewSectionLede')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handlePreview('customer')}
                      className="rounded-soft-lg border border-cyber-aqua/40 bg-white px-4 py-2 text-[13px] font-medium text-obsidian transition-colors hover:bg-cyber-aqua/10"
                    >
                      {t('settings.previewCustomer')}
                    </button>
                    {kitchens.map((kitchen) => (
                      <button
                        key={`preview-${kitchen.id}`}
                        type="button"
                        onClick={() => handlePreview('kitchen', kitchen.id)}
                        className="rounded-soft-lg border border-emerald-300 bg-white px-4 py-2 text-[13px] font-medium text-obsidian transition-colors hover:bg-emerald-50"
                      >
                        {t('settings.previewKitchen', { name: kitchen.name })}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dedicated test section */}
                <div className="rounded-soft-xl border border-black/10 bg-cloud-soft-white p-4">
                  <h3 className="mb-1 text-[17px] font-semibold text-obsidian">
                    {t('settings.testSectionTitle')}
                  </h3>
                  <p className="mb-3 text-[13px] leading-relaxed text-graphite">
                    {t('settings.testSectionLede')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleTestSaved(null)}
                      disabled={testing['test-customer-saved']}
                      className="rounded-soft-lg bg-cyber-aqua px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-cyber-aqua/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {testing['test-customer-saved']
                        ? t('settings.testPrintRunning')
                        : t('settings.testSavedCustomer')}
                    </button>
                    {kitchens.map((kitchen) => (
                      <button
                        key={`test-saved-${kitchen.id}`}
                        type="button"
                        onClick={() => handleTestSaved(kitchen.id)}
                        disabled={testing[`test-kitchen-saved-${kitchen.id}`]}
                        className="rounded-soft-lg bg-emerald-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {testing[`test-kitchen-saved-${kitchen.id}`]
                          ? t('settings.testPrintRunning')
                          : t('settings.testSavedKitchen', {
                              name: kitchen.name,
                            })}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-soft-xl border border-black/10 bg-cloud-soft-white p-4">
                  <p className="text-[13px] leading-relaxed text-graphite">
                    {t('settings.printerFootnote')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />

      <SettingsRecipePrintPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        imageSrc={previewSrc}
        loading={previewLoading}
        title={previewTitle || t('settings.previewSectionTitle')}
      />
    </div>
  );
}
