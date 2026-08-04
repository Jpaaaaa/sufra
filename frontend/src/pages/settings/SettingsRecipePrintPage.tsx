import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import SettingsTabs from '../../components/tabs/SettingsTabs';
import { useAuth } from '../../contexts/AuthContext';
import { showToast } from '../../components/ui/Toast';
import SettingsRecipePrintPreviewModal from './SettingsRecipePrintPreviewModal';

export default function SettingsRecipePrintPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [restaurantName, setRestaurantName] = useState('');
  const [thankYouLine, setThankYouLine] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');

  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'manager') {
      navigate('/settings/server', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) return;

    const load = async () => {
      setLoading(true);
      try {
        if (!window.sufra?.recipePrint?.getSettings) {
          showToast('إعدادات طباعة الوصفات متاحة في تطبيق سطح المكتب فقط', 'error');
          return;
        }
        const s = await window.sufra.recipePrint.getSettings();
        setRestaurantName(s.restaurantName ?? '');
        setThankYouLine(s.thankYouLine ?? '');
        setMobileNumber(s.mobileNumber ?? '');
      } catch (e: any) {
        console.error(e);
        showToast(e?.message || 'فشل تحميل الإعدادات', 'error');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [user]);

  const handleSave = async () => {
    if (!window.sufra?.recipePrint?.saveSettings) {
      showToast('الحفظ متاح في تطبيق سطح المكتب فقط', 'error');
      return;
    }
    setSaving(true);
    try {
      await window.sufra.recipePrint.saveSettings({
        restaurantName,
        thankYouLine,
        mobileNumber,
      });
      showToast('تم حفظ إعدادات طباعة الوصفات', 'success');
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || 'فشل الحفظ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!window.sufra?.recipePrint?.preview) {
      showToast('المعاينة متاحة في تطبيق سطح المكتب فقط', 'error');
      return;
    }
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewSrc(null);
    try {
      const res = await window.sufra.recipePrint.preview({
        restaurantName,
        thankYouLine,
        mobileNumber,
      });
      if (res.success) {
        setPreviewSrc(`data:image/png;base64,${res.imageBase64}`);
      } else {
        showToast(res.error || 'فشل إنشاء المعاينة', 'error');
        setPreviewOpen(false);
      }
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || 'فشل المعاينة', 'error');
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!window.sufra?.recipePrint?.print) {
      showToast('الطباعة متاحة في تطبيق سطح المكتب فقط', 'error');
      return;
    }
    setPrinting(true);
    try {
      const res = await window.sufra.recipePrint.print({
        restaurantName,
        thankYouLine,
        mobileNumber,
      });
      if (res.success) {
        showToast('تم إرسال الطباعة إلى طابعة إيصال العميل', 'success');
      } else {
        showToast(res.error || 'فشلت الطباعة', 'error');
      }
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || 'فشلت الطباعة', 'error');
    } finally {
      setPrinting(false);
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col bg-cloud-soft-white">
      <Header title="طباعة الوصفات" />
      <main className="flex-1 p-6">
        <section className="mx-auto max-w-7xl">
          <SettingsTabs />
          <div className="mx-auto mt-6 max-w-2xl">
            <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
            <p className="mb-6 text-[14px] leading-relaxed text-graphite">
              تظهر هذه الحقول في أعلى وأسفل ورقة الوصفة. زر «طباعة» يرسل إلى{' '}
              <span className="font-medium text-obsidian">طابعة إيصال العميل</span> (نفس إعداد الطابعات → إيصال
              العميل).
            </p>
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyber-aqua border-t-transparent" />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[14px] font-medium text-obsidian">اسم المطعم</span>
                  <input
                    type="text"
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    className="rounded-soft-lg border border-black/10 bg-cloud-soft-white px-3 py-2.5 text-[15px] text-obsidian outline-none ring-cyber-aqua/30 focus:border-cyber-aqua focus:ring-2"
                    placeholder="مثال: مطعم السفرة"
                    dir="auto"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[14px] font-medium text-obsidian">سطر الشكر</span>
                  <input
                    type="text"
                    value={thankYouLine}
                    onChange={(e) => setThankYouLine(e.target.value)}
                    className="rounded-soft-lg border border-black/10 bg-cloud-soft-white px-3 py-2.5 text-[15px] text-obsidian outline-none ring-cyber-aqua/30 focus:border-cyber-aqua focus:ring-2"
                    placeholder="مثال: شكراً لزيارتكم"
                    dir="auto"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[14px] font-medium text-obsidian">رقم الجوال</span>
                  <input
                    type="text"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="rounded-soft-lg border border-black/10 bg-cloud-soft-white px-3 py-2.5 text-[15px] text-obsidian outline-none ring-cyber-aqua/30 focus:border-cyber-aqua focus:ring-2"
                    placeholder="مثال: 07xxxxxxxx"
                    dir="ltr"
                  />
                </label>
                <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void handlePreview()}
                    disabled={previewLoading || printing}
                    className="rounded-full border border-cyber-aqua/40 bg-white px-6 py-2.5 text-[15px] font-medium text-obsidian shadow-soft transition hover:bg-cyber-aqua/10 disabled:opacity-50"
                  >
                    {previewLoading ? 'جاري المعاينة…' : 'معاينة'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handlePrint()}
                    disabled={printing || previewLoading}
                    className="rounded-full border border-obsidian/15 bg-white px-6 py-2.5 text-[15px] font-medium text-obsidian shadow-soft transition hover:bg-black/[0.03] disabled:opacity-50"
                  >
                    {printing ? 'جاري الطباعة…' : 'طباعة'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving || printing}
                    className="rounded-full bg-cyber-aqua px-6 py-2.5 text-[15px] font-medium text-charcoal-graphite shadow-soft transition hover:opacity-90 disabled:opacity-50"
                  >
                    {saving ? 'جاري الحفظ…' : 'حفظ'}
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <SettingsRecipePrintPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        imageSrc={previewSrc}
        loading={previewLoading}
        onPrint={() => void handlePrint()}
        printing={printing}
      />
    </div>
  );
}
