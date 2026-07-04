import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';

export default function DiningPage() {
  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <Header title="نقطة البيع" />

        <main className="flex-1 p-6">
          <section className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="mb-2 text-[18px] leading-tight font-semibold text-slate-900">نقطة البيع</h2>
            <p className="text-[15px] leading-normal text-slate-600">
              سيتم لاحقاً ربط هذه الشاشة بواجهة نقطة البيع الكاملة لإدارة الطلبات في الوقت
              الفعلي.
            </p>
          </section>
      </main>

      <Footer />
    </div>
  );
}
