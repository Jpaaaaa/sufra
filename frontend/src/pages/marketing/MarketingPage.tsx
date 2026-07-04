import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import LanguageSwitcher from '../../components/i18n/LanguageSwitcher';
import { useAuth } from '../../contexts/AuthContext';

// Aman Technology – معلومات الاتصال
const AMAN_CONTACT = {
  website: 'https://www.aman-tech.com',
  phone: '07722432909',
  location: 'العراق',
} as const;

function MarketingPageContent() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  // Redirect non-admin users away from marketing page
  useEffect(() => {
    if (!isLoading && user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, isLoading, navigate]);

  if (isLoading || (user && user.role !== 'admin')) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6FA]">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#4AC7C5] border-r-transparent"></div>
          <p className="text-[#1F2937]/60">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  const handleStartNow = () => navigate('/');

  return (
    <div className="relative min-h-screen bg-[#F4F6FA]">
      <div className="fixed right-4 top-4 z-50 rounded-xl border border-black/5 bg-white/90 p-2 shadow-md backdrop-blur-sm">
        <LanguageSwitcher />
      </div>
      {/* Background pattern */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 opacity-20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#4AC7C5]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#4AC7C5]/10 rounded-full blur-3xl"></div>
      </div>

      {/* Hero */}
      <header className="relative z-10 w-full py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center mb-6 relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 sm:w-40 sm:h-40 bg-[#4AC7C5]/20 rounded-full blur-2xl"></div>
            </div>
            <div className="relative h-24 w-24 sm:h-32 sm:w-32 z-10">
              <img src="./logo/logo.png" alt="Aman Technology Logo" className="h-full w-full object-contain drop-shadow-lg" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm sm:text-base text-[#1F2937] flex-wrap">
            <a href={AMAN_CONTACT.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-medium text-[#1F2937]/80 hover:text-[#4AC7C5]">
              <svg className="w-4 h-4 text-[#1F2937]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <span>www.aman-tech.com</span>
            </a>
            <a href={`tel:${AMAN_CONTACT.phone}`} className="flex items-center gap-2 font-medium text-[#1F2937]/80 hover:text-[#4AC7C5]">
              <svg className="w-4 h-4 text-[#1F2937]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>{AMAN_CONTACT.phone}</span>
            </a>
            {AMAN_CONTACT.location && (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#1F2937]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="font-medium text-[#1F2937]/80">{AMAN_CONTACT.location}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Pricing section - truncated for brevity, full content from original */}
      <section id="pricing" className="relative z-10 w-full py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#F4F6FA] via-[#1F2937]/5 to-[#F4F6FA] overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-10 w-[500px] h-[500px] bg-[#4AC7C5]/8 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-10 w-[600px] h-[600px] bg-[#4AC7C5]/6 rounded-full blur-3xl"></div>
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] opacity-40"></div>
        </div>

        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-3 mb-6 px-6 py-3 rounded-full bg-gradient-to-r from-[#4AC7C5]/15 via-[#4AC7C5]/10 to-[#4AC7C5]/15 border-2 border-[#4AC7C5]/30 shadow-lg">
              <svg className="w-5 h-5 text-[#4AC7C5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm sm:text-base font-bold text-[#4AC7C5] tracking-wide">
                اختر ما يناسبك
              </span>
            </div>

            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#0f3d3d] mb-6 leading-tight tracking-tight">
              <span className="bg-gradient-to-r from-[#4AC7C5] via-[#4AC7C5]/90 to-[#4AC7C5] bg-clip-text text-transparent">
                اختر نسختك
              </span>
            </h2>

            <div className="max-w-4xl mx-auto mb-6">
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#0f3d3d] mb-3 text-center">
                خطط مرنة تناسب كل احتياج
              </h3>
              <p className="text-base sm:text-lg lg:text-xl text-[#1F2937]/70 leading-relaxed text-center font-medium">
                من لايت إلى النسخة الكاملة، اختر ما يناسب عملك.
              </p>
            </div>

            <p className="text-lg sm:text-xl lg:text-2xl text-[#1F2937]/70 max-w-4xl mx-auto leading-relaxed font-semibold mb-8">
              جميع النسخ تشمل الدعم والتحديثات.
            </p>

            <div className="flex items-center justify-center gap-3">
              <div className="h-2 w-16 bg-gradient-to-r from-[#4AC7C5] via-[#4AC7C5]/80 to-[#4AC7C5] rounded-full"></div>
              <div className="h-2 w-3 bg-[#4AC7C5]/70 rounded-full"></div>
              <div className="h-2 w-3 bg-[#4AC7C5]/50 rounded-full"></div>
            </div>
          </div>

          {/* Pricing cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 mb-12">
            {/* Sufra */}
            <div className="bg-white rounded-xl shadow-soft border-t-[3px] border-[#4AC7C5] overflow-hidden">
              <div className="p-6 sm:p-8">
                <div className="mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-[#0f3d3d] mb-2">Sufra</h2>
                  <p className="text-sm sm:text-base text-[#1F2937]/60 mb-1">النسخة الأساسية</p>
                  <p className="text-sm sm:text-base text-[#1F2937]/80 leading-relaxed mt-3">حل بسيط، مريح، ومثالي للبداية.</p>
                </div>
                <ul className="space-y-3 mb-6">
                  {['يعمل بدون إنترنت', 'واجهة واضحة وسهلة', 'أداء سريع وثابت', 'تقارير يومية وشهرية', 'مناسب للمطاعم الصغيرة والكافيهات'].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm sm:text-base text-[#1F2937]">
                      <span className="text-[#4AC7C5] mt-1 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-4 border-t border-[#1F2937]/10">
                  <p className="text-sm sm:text-base font-medium text-[#1F2937]/70 italic">Sufra: نظام يعتمد عليه.</p>
                </div>
              </div>
            </div>

            {/* Sufra Pro */}
            <div className="bg-white rounded-xl shadow-soft border-t-[3px] border-[#4AC7C5] overflow-hidden">
              <div className="p-6 sm:p-8">
                <div className="mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-[#0f3d3d] mb-2">Sufra Pro</h2>
                  <p className="text-sm sm:text-base text-[#1F2937]/60 mb-1">النسخة المتقدمة</p>
                  <p className="text-sm sm:text-base text-[#1F2937]/80 leading-relaxed mt-3">للإدارة التي تريد رؤية العمل في أي وقت ومن أي مكان.</p>
                </div>
                <ul className="space-y-3 mb-6">
                  {['يشمل كل ميزات Lite', 'يعمل أونلاين', 'تطبيق مدير للموبايل', 'مبيعات مباشرة', 'المنتجات الأكثر طلبًا', 'متابعة الصالة والطلبات', 'ID خاص لكل مطعم'].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm sm:text-base text-[#1F2937]">
                      <span className="text-[#4AC7C5] mt-1 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-4 border-t border-[#1F2937]/10">
                  <p className="text-sm sm:text-base font-medium text-[#1F2937]/70 italic">Sufra Pro: رؤيتك للمطعم دائمًا معك.</p>
                </div>
              </div>
            </div>

            {/* Sufra Premium */}
            <div className="bg-white rounded-xl shadow-soft border-t-[3px] border-[#4AC7C5] overflow-hidden">
              <div className="p-6 sm:p-8">
                <div className="mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-[#0f3d3d] mb-2">Sufra Premium</h2>
                  <p className="text-sm sm:text-base text-[#1F2937]/60 mb-1">النسخة الشاملة</p>
                  <p className="text-sm sm:text-base text-[#1F2937]/80 leading-relaxed mt-3">خدمة فاخرة للمطاعم الكبيرة والسلاسل.</p>
                </div>
                <ul className="space-y-3 mb-6">
                  {['يشمل كل ميزات Pro', 'حضور وانصراف بالوجه', 'متابعة الموظفين', 'كاميرات مباشرة مع التطبيق', 'مناسب للفروع المتعددة'].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm sm:text-base text-[#1F2937]">
                      <span className="text-[#4AC7C5] mt-1 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-4 border-t border-[#1F2937]/10">
                  <p className="text-sm sm:text-base font-medium text-[#1F2937]/70 italic">Sufra Premium: أعلى درجة من التحكم.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="relative z-10 w-full py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-[#F4F6FA]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0f3d3d] text-center mb-8">
            مقارنة النسخ
          </h2>
          <div className="bg-white rounded-xl border border-[#1F2937]/10 shadow-soft overflow-hidden">
            <table className="w-full text-right">
              <thead>
                <tr className="border-b border-[#1F2937]/10 bg-[#1F2937]/5">
                  <th className="p-4 font-bold text-[#0f3d3d]">الميزة</th>
                  <th className="p-4 font-bold text-[#0f3d3d]">Lite</th>
                  <th className="p-4 font-bold text-[#0f3d3d]">Pro</th>
                  <th className="p-4 font-bold text-[#0f3d3d]">Premium</th>
                </tr>
              </thead>
              <tbody className="text-[#1F2937]">
                <tr className="border-b border-[#1F2937]/10"><td className="p-4">بدون إنترنت</td><td className="p-4 text-[#4AC7C5]">✓</td><td className="p-4">—</td><td className="p-4">—</td></tr>
                <tr className="border-b border-[#1F2937]/10"><td className="p-4">أونلاين + تطبيق مدير</td><td className="p-4">—</td><td className="p-4 text-[#4AC7C5]">✓</td><td className="p-4 text-[#4AC7C5]">✓</td></tr>
                <tr className="border-b border-[#1F2937]/10"><td className="p-4">حضور بالوجه وكاميرات</td><td className="p-4">—</td><td className="p-4">—</td><td className="p-4 text-[#4AC7C5]">✓</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 w-full py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-[#F4F6FA]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0f3d3d] text-center mb-8">
            أسئلة شائعة
          </h2>
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-[#1F2937]/10 p-6 shadow-soft">
              <h3 className="font-bold text-[#0f3d3d] mb-2">هل يمكن التجربة قبل الشراء؟</h3>
              <p className="text-[#1F2937]/80 text-sm sm:text-base">نعم. يمكنك تجربة أي إصدار مجانًا أولًا.</p>
            </div>
            <div className="bg-white rounded-xl border border-[#1F2937]/10 p-6 shadow-soft">
              <h3 className="font-bold text-[#0f3d3d] mb-2">ما الفرق بين Lite و Pro؟</h3>
              <p className="text-[#1F2937]/80 text-sm sm:text-base">Lite يعمل بدون إنترنت ومناسب للمحلات الصغيرة. Pro يعمل أونلاين ويشمل تطبيق مدير ومتابعة من أي مكان.</p>
            </div>
            <div className="bg-white rounded-xl border border-[#1F2937]/10 p-6 shadow-soft">
              <h3 className="font-bold text-[#0f3d3d] mb-2">هل الدعم والتحديثات مشمولة؟</h3>
              <p className="text-[#1F2937]/80 text-sm sm:text-base">جميع النسخ تشمل الدعم والتحديثات.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 text-center py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-[#F4F6FA]">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-xl border border-[#1F2937]/10 shadow-lg p-8 sm:p-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#0f3d3d] mb-4 leading-tight">
              مستعد للبدء؟
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <button
                onClick={handleStartNow}
                className="px-8 py-4 bg-[#4AC7C5] hover:bg-[#4AC7C5]/90 text-[#0f3d3d] rounded-lg text-lg font-bold shadow-lg flex items-center gap-2"
              >
                <span>ابدأ الآن</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                </svg>
              </button>
            </div>
            <p className="mt-8 text-sm text-[#1F2937]/60">
              التجربة المجانية تشمل جميع المميزات.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 w-full py-6 px-4 sm:px-6 lg:px-8 border-t border-[#1F2937]/10 bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm sm:text-base text-[#1F2937]/60">© 2025 Aman Technology — جميع الحقوق محفوظة</p>
        </div>
      </footer>
    </div>
  );
}

export default function MarketingPage() {
  return (
    <ProtectedRoute>
      <MarketingPageContent />
    </ProtectedRoute>
  );
}
