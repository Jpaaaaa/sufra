import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import SettingsTabs from '../../components/tabs/SettingsTabs';
import {
  getServerConfig,
  setServerConfig,
  testServerConnection,
  detectLocalIP,
  getLanAddresses,
  LAN_API_PORT,
  type LanAddressInfo,
  type LanAddressesResult,
} from '../../lib/server-config';
import { showToast } from '../../components/ui/Toast';
import { showConfirm } from '../../components/ui/ConfirmDialog';

export default function ServerSettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [serverUrl, setServerUrl] = useState('');
  const [serverMode, setServerMode] = useState<'host' | 'client'>('host');
  const [testing, setTesting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lanAddresses, setLanAddresses] = useState<LanAddressesResult | null>(null);
  const isSetupMode = location.pathname.startsWith('/setup');

  useEffect(() => {
    loadCurrentConfig();
    void loadLanAddresses();
  }, []);

  const loadLanAddresses = async () => {
    const addrs = await getLanAddresses();
    setLanAddresses(addrs);
  };

  const loadCurrentConfig = () => {
    const config = getServerConfig();
    setServerUrl(config.serverUrl);
    setServerMode(config.mode);
  };

  const handleDetectIP = async () => {
    setDetecting(true);
    try {
      const result = await detectLocalIP();
      if (result.ip) {
        const detectedUrl = `http://${result.ip}:${LAN_API_PORT}`;
        setServerUrl(detectedUrl);
        showToast(`تم اكتشاف العنوان: ${detectedUrl}`, 'success');
      } else if (result.warning === 'NOT_LAN') {
        showToast('العنوان المكتشف ليس عنوان شبكة محلية', 'warning');
      } else {
        showToast('فشل اكتشاف العنوان المحلي', 'error');
      }
    } catch (error: any) {
      console.error('Failed to detect IP:', error);
      showToast('فشل اكتشاف العنوان', 'error');
    } finally {
      setDetecting(false);
      void loadLanAddresses();
    }
  };

  const applyLanUrl = (addr: LanAddressInfo) => {
    setServerUrl(addr.url);
    showToast(`تم اختيار العنوان: ${addr.url}`, 'success');
  };

  const handleTestConnection = async () => {
    if (!serverUrl || serverUrl.trim() === '') {
      showToast('الرجاء إدخال عنوان الخادم أولاً', 'warning');
      return;
    }

    setTesting(true);
    try {
      const result = await testServerConnection(serverUrl.trim());
      if (result.success) {
        showToast('تم الاتصال بالخادم بنجاح', 'success');
      } else {
        showToast(`فشل الاتصال: ${result.error || 'خطأ غير معروف'}`, 'error');
      }
    } catch (error: any) {
      console.error('Test connection failed:', error);
      showToast('فشل اختبار الاتصال', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!serverUrl || serverUrl.trim() === '') {
      showToast('الرجاء إدخال عنوان الخادم', 'warning');
      return;
    }

    // Validate URL format
    try {
      const url = new URL(serverUrl.trim());
      if (!url.protocol.startsWith('http')) {
        showToast('يجب أن يبدأ العنوان بـ http:// أو https://', 'error');
        return;
      }
    } catch (error) {
      showToast(`عنوان الخادم غير صحيح. مثال: http://192.168.1.100:${LAN_API_PORT}`, 'error');
      return;
    }

    setSaving(true);
    try {
      setServerConfig({
        mode: serverMode,
        serverUrl: serverUrl.trim(),
      });
      showToast('تم حفظ الإعدادات بنجاح', 'success');
      
      if (isSetupMode) {
        const confirmed = await showConfirm({
          title: 'تم حفظ الإعدادات',
          message: 'هل تريد الانتقال إلى تسجيل الدخول الآن؟',
          confirmText: 'نعم',
          cancelText: 'لا',
          confirmColor: 'primary',
        });

        if (confirmed) {
          navigate('/login');
        }
      } else {
        // Reload page to apply new server URL
        const confirmed = await showConfirm({
          title: 'إعادة تحميل الصفحة',
          message: 'تم حفظ الإعدادات. هل تريد إعادة تحميل الصفحة لتطبيق التغييرات؟',
          confirmText: 'نعم',
          cancelText: 'لا',
          confirmColor: 'primary',
        });

        if (confirmed) {
          window.location.reload();
        }
      }
    } catch (error: any) {
      console.error('Failed to save server config:', error);
      showToast('فشل حفظ الإعدادات', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const confirmed = await showConfirm({
      title: 'إعادة تعيين الإعدادات',
      message: 'هل تريد إعادة تعيين إعدادات الخادم إلى القيم الافتراضية؟',
      confirmText: 'نعم',
      cancelText: 'إلغاء',
      confirmColor: 'danger',
    });

    if (!confirmed) return;

    try {
      setServerConfig({
        mode: 'host',
        serverUrl: `http://127.0.0.1:${LAN_API_PORT}`,
      });
      loadCurrentConfig();
      showToast('تم إعادة تعيين الإعدادات', 'success');
    } catch (error: any) {
      console.error('Failed to reset config:', error);
      showToast('فشل إعادة التعيين', 'error');
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-cloud-soft-white">
      <Header
        title="إعدادات الخادم"
        actions={
          isSetupMode ? (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="rounded-soft-lg border border-obsidian/10 bg-white px-4 py-2 text-[14px] leading-normal font-medium text-obsidian hover:bg-obsidian/5"
            >
              العودة لتسجيل الدخول
            </button>
          ) : undefined
        }
      />
      <main className="flex-1 p-6">
        <section className="mx-auto max-w-7xl">
          {!isSetupMode && <SettingsTabs />}
          
          <div className="mt-6 rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
            <h2 className="mb-6 text-[20px] leading-tight font-semibold text-obsidian">
              إعدادات الاتصال بالخادم
            </h2>

            <div className="space-y-6">
              {/* Server Mode */}
              <div>
                <label className="block text-[14px] leading-relaxed font-medium text-obsidian mb-2">
                  وضع الخادم
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="serverMode"
                      value="host"
                      checked={serverMode === 'host'}
                      onChange={(e) => setServerMode(e.target.value as 'host' | 'client')}
                      className="w-4 h-4 text-cyber-aqua focus:ring-cyber-aqua"
                    />
                    <span className="text-[14px] leading-normal text-obsidian">خادم (Host)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="serverMode"
                      value="client"
                      checked={serverMode === 'client'}
                      onChange={(e) => setServerMode(e.target.value as 'host' | 'client')}
                      className="w-4 h-4 text-cyber-aqua focus:ring-cyber-aqua"
                    />
                    <span className="text-[14px] leading-normal text-obsidian">عميل (Client)</span>
                  </label>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-graphite">
                  {serverMode === 'host' 
                    ? 'الخادم يعمل على هذا الجهاز ويستمع على الواي فاي والإيثرنت معاً' 
                    : 'الاتصال بخادم خارجي على شبكة محلية'}
                </p>
              </div>

              <div>
                <label className="block text-[14px] leading-relaxed font-medium text-obsidian mb-2">
                  عناوين هذا الجهاز للأجهزة الأخرى
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <LanAddressCard
                    title="عبر الواي فاي"
                    emptyLabel="غير متصل"
                    addr={lanAddresses?.wifi ?? null}
                    onUse={applyLanUrl}
                  />
                  <LanAddressCard
                    title="عبر الإيثرنت"
                    emptyLabel="غير متصل"
                    addr={lanAddresses?.ethernet ?? null}
                    onUse={applyLanUrl}
                  />
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-graphite">
                  بطاقات Docker و Hyper-V و WSL لا تُعرض. الأجهزة الأخرى تستخدم عنوان الشبكة المشتركة معها.
                </p>
              </div>

              {/* Server URL */}
              <div>
                <label className="block text-[14px] leading-relaxed font-medium text-obsidian mb-2">
                  عنوان الخادم (Server URL)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder={`http://192.168.1.100:${LAN_API_PORT}`}
                    className="flex-1 rounded-soft-lg border border-black/10 bg-white px-4 py-2.5 text-[15px] leading-normal text-obsidian focus:border-cyber-aqua focus:outline-none focus:ring-2 focus:ring-cyber-aqua"
                  />
                  <button
                    type="button"
                    onClick={handleDetectIP}
                    disabled={detecting || serverMode === 'client'}
                    className="rounded-soft-lg bg-graphite/10 px-4 py-2.5 text-[14px] leading-normal font-medium text-obsidian hover:bg-graphite/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {detecting ? 'جاري الكشف...' : 'اكتشاف تلقائي'}
                  </button>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-graphite">
                  أدخل عنوان IP ورقم المنفذ للخادم. مثال: http://192.168.1.100:{LAN_API_PORT}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || saving || !serverUrl.trim()}
                  className="flex-1 rounded-soft-lg bg-cyber-aqua px-4 py-2.5 text-[14px] leading-normal font-medium text-white hover:bg-cyber-aqua/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testing ? 'جاري الاختبار...' : 'اختبار الاتصال'}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || testing}
                  className="flex-1 rounded-soft-lg bg-green-600 px-4 py-2.5 text-[14px] leading-normal font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={saving || testing}
                  className="rounded-soft-lg bg-red-500 px-4 py-2.5 text-[14px] leading-normal font-medium text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  إعادة تعيين
                </button>
              </div>

              {/* Info Box */}
              <div className="rounded-soft-xl border border-cyber-aqua/30 bg-cyber-aqua/5 p-4">
                <h3 className="mb-2 text-[15px] leading-normal font-semibold text-obsidian">
                  💡 معلومات مهمة
                </h3>
                <ul className="space-y-1.5 text-[13px] leading-relaxed text-graphite">
                  <li>• الخادم يستمع على كل البطاقات الفيزيائية (واي فاي وإيثرنت) في المنفذ {LAN_API_PORT}</li>
                  <li>• <strong>لفتح التطبيق عبر المتصفح في التطوير:</strong> استخدم المنفذ 3000 — منفذ الواجهة مختلف عن منفذ API ({LAN_API_PORT})</li>
                  <li>• للتحقق من الاتصال استخدم /health (مثال: http://192.168.1.100:{LAN_API_PORT}/health)</li>
                  <li>• في وضع الخادم (Host) على هذا الجهاز: http://127.0.0.1:{LAN_API_PORT}</li>
                  <li>• الأجهزة الأخرى: استخدم عنوان الواي فاي أو الإيثرنت المعروض أعلاه</li>
                  <li>• تأكد من فتح المنفذ {LAN_API_PORT} في جدار حماية ويندوز</li>
                  <li>• بعد تغيير الإعدادات، قد تحتاج إلى إعادة تحميل الصفحة</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function LanAddressCard({
  title,
  emptyLabel,
  addr,
  onUse,
}: {
  title: string;
  emptyLabel: string;
  addr: LanAddressInfo | null;
  onUse: (addr: LanAddressInfo) => void;
}) {
  return (
    <div className="rounded-soft-lg border border-black/10 bg-cloud-soft-white/80 p-4">
      <p className="text-[13px] font-semibold text-obsidian">{title}</p>
      {addr ? (
        <>
          <p className="mt-1 break-all font-mono text-[14px] text-obsidian" dir="ltr">
            {addr.url}
          </p>
          <p className="mt-0.5 text-[11px] text-graphite" dir="ltr">
            {addr.name}
          </p>
          <button
            type="button"
            onClick={() => onUse(addr)}
            className="mt-3 rounded-soft-lg bg-cyber-aqua/15 px-3 py-1.5 text-[13px] font-medium text-obsidian hover:bg-cyber-aqua/25"
          >
            استخدام هذا العنوان
          </button>
        </>
      ) : (
        <p className="mt-1 text-[14px] text-graphite">{emptyLabel}</p>
      )}
    </div>
  );
}
