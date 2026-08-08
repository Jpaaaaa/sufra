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
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);

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
          showToast('إعدادات هوية الطباعة متاحة في تطبيق سطح المكتب فقط', 'error');
          return;
        }
        const s = await window.sufra.recipePrint.getSettings();
        setRestaurantName(s.restaurantName ?? '');
        setThankYouLine(s.thankYouLine ?? '');
        setMobileNumber(s.mobileNumber ?? '');
        if (window.sufra.recipePrint.logoPreview) {
          const logoRes = await window.sufra.recipePrint.logoPreview();
          if (logoRes.success && logoRes.logoPreviewBase64) {
            setLogoPreview(`data:image/png;base64,${logoRes.logoPreviewBase64}`);
          } else {
            setLogoPreview(null);
          }
        }
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
      showToast('تم حفظ إعدادات هوية الطباعة', 'success');
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || 'فشل الحفظ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePickLogo = async () => {
    if (!window.sufra?.recipePrint?.pickLogo) {
      showToast('رفع الشعار متاح في تطبيق سطح المكتب فقط', 'error');
      return;
    }
    setLogoBusy(true);
    try {
      const res = await window.sufra.recipePrint.pickLogo();
      if (!res.success) {
        if (res.error !== 'CANCELLED') {
          showToast(res.error || 'فشل رفع الشعار', 'error');
        }
        return;
      }
      if (res.logoPreviewBase64) {
        setLogoPreview(`data:image/png;base64,${res.logoPreviewBase64}`);
      }
      showToast('تم تحويل الشعار إلى أبيض وأسود وحفظه للفاتورة', 'success');
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || 'فشل رفع الشعار', 'error');
    } finally {
      setLogoBusy(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!window.sufra?.recipePrint?.removeLogo) return;
    setLogoBusy(true);
    try {
      const res = await window.sufra.recipePrint.removeLogo();
      if (!res.success) {
        showToast(res.error || 'فشل حذف الشعار', 'error');
        return;
      }
      setLogoPreview(null);
      showToast('تم حذف شعار المطعم', 'success');
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || 'فشل حذف الشعار', 'error');
    } finally {
      setLogoBusy(false);
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

  const handleReceiptPreview = async () => {
    if (!window.sufra?.printers?.preview) {
      showToast('معاينة الفاتورة متاحة في تطبيق سطح المكتب فقط', 'error');
      return;
    }
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewSrc(null);
    try {
      // Persist text fields first so branding merge uses current values
      if (window.sufra.recipePrint?.saveSettings) {
        await window.sufra.recipePrint.saveSettings({
          restaurantName,
          thankYouLine,
          mobileNumber,
        });
      }
      const res = await window.sufra.printers.preview({ kind: 'customer' });
      if (res.success) {
        setPreviewSrc(`data:image/png;base64,${res.imageBase64}`);
      } else {
        showToast(res.error || 'فشل إنشاء معاينة الفاتورة', 'error');
        setPreviewOpen(false);
      }
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || 'فشل معاينة الفاتورة', 'error');
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col bg-cloud-soft-white">
      <Header title="هوية الطباعة" />
      <main className="flex-1 p-6">
        <section className="mx-auto max-w-7xl">
          <SettingsTabs />
          <div className="mx-auto mt-6 max-w-2xl">
            <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
              <p className="mb-6 text-[14px] leading-relaxed text-graphite">
                اسم المطعم وشعار أبيض وأسود يظهران على{' '}
                <span className="font-medium text-obsidian">فاتورة العميل</span>. سطر الشكر ورقم الجوال
                يستخدمان أيضاً في طباعة الوصفات. الشعار يُحوَّل تلقائياً إلى أبيض وأسود للطباعة الحرارية.
              </p>
              {loading ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyber-aqua border-t-transparent" />
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="rounded-soft-lg border border-black/8 bg-cloud-soft-white/80 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="text-[14px] font-medium text-obsidian">شعار المطعم</span>
                      <span className="text-[12px] text-graphite">يُطبَع أبيض وأسود على الفاتورة</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-soft-lg border border-black/10 bg-white">
                        {logoPreview ? (
                          <img
                            src={logoPreview}
                            alt="شعار المطعم"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <span className="px-2 text-center text-[12px] text-graphite/70">لا يوجد شعار</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handlePickLogo()}
                          disabled={logoBusy || saving}
                          className="rounded-full bg-cyber-aqua px-5 py-2 text-[14px] font-medium text-charcoal-graphite shadow-soft transition hover:opacity-90 disabled:opacity-50"
                        >
                          {logoBusy ? 'جاري المعالجة…' : logoPreview ? 'تغيير الشعار' : 'رفع شعار'}
                        </button>
                        {logoPreview && (
                          <button
                            type="button"
                            onClick={() => void handleRemoveLogo()}
                            disabled={logoBusy || saving}
                            className="rounded-full border border-obsidian/15 bg-white px-5 py-2 text-[14px] font-medium text-obsidian shadow-soft transition hover:bg-black/[0.03] disabled:opacity-50"
                          >
                            حذف
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

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
                      onClick={() => void handleReceiptPreview()}
                      disabled={previewLoading || printing || logoBusy}
                      className="rounded-full border border-cyber-aqua/40 bg-white px-5 py-2.5 text-[15px] font-medium text-obsidian shadow-soft transition hover:bg-cyber-aqua/10 disabled:opacity-50"
                    >
                      {previewLoading ? 'جاري المعاينة…' : 'معاينة الفاتورة'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePreview()}
                      disabled={previewLoading || printing}
                      className="rounded-full border border-obsidian/15 bg-white px-5 py-2.5 text-[15px] font-medium text-obsidian shadow-soft transition hover:bg-black/[0.03] disabled:opacity-50"
                    >
                      معاينة الوصفة
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePrint()}
                      disabled={printing || previewLoading}
                      className="rounded-full border border-obsidian/15 bg-white px-5 py-2.5 text-[15px] font-medium text-obsidian shadow-soft transition hover:bg-black/[0.03] disabled:opacity-50"
                    >
                      {printing ? 'جاري الطباعة…' : 'طباعة وصفة'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={saving || printing || logoBusy}
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
        title="معاينة الطباعة"
      />
    </div>
  );
}
