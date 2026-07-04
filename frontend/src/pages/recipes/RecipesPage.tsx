import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';

export default function RecipesPage() {
  return (
    <div className="flex flex-1 flex-col bg-cloud-soft-white">
      <Header title="الوصفات" />

      <main className="flex-1 p-6">
        <section className="mx-auto max-w-7xl rounded-soft-xl border border-black/5 bg-cloud-soft-white p-6 shadow-soft">
          <div className="text-center py-12">
            <p className="text-[15px] leading-normal text-graphite">
              صفحة الوصفات - قريباً
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
