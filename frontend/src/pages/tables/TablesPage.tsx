import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import TablesTabs from '../../components/tabs/TablesTabs';
import { Hall, TableEntity } from '../../utils';
import { useHallsStore } from '../../../stores/hallsStore';
import { useTablesStore } from '../../../stores/tablesStore';

export default function TablesPage() {
  const [searchParams] = useSearchParams();
  const hallIdParam = searchParams.get('hallId');
  const hallId = hallIdParam ? Number(hallIdParam) : NaN;
  const [hall, setHall] = useState<Hall | null>(null);
  const tablesByHallId = useTablesStore((state) => state.tablesByHallId);
  const [, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tables: TableEntity[] =
    hallId && !Number.isNaN(hallId) ? tablesByHallId[hallId] ?? [] : [];

  useEffect(() => {
    if (!hallId || Number.isNaN(hallId)) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        await useHallsStore.getState().loadHalls();
        const loadedHall = useHallsStore.getState().getHallById(hallId);
        setHall(loadedHall ?? null);
        await useTablesStore.getState().loadTablesForHall(hallId, true);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'تعذر تحميل بيانات الصالة';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [hallId]);

  return (
    <div className="flex flex-1 flex-col bg-cloud-soft-white">
      <Header title="الطاولات" />
      <main className="flex-1 p-6">
        <section className="mx-auto max-w-7xl">
          <TablesTabs />
          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-relaxed text-red-800">
              {error}
            </div>
          )}
          {hall && tables.length > 0 && (
            <p className="mt-4 text-sm text-obsidian/70">
              {hall.name}: {tables.length} طاولة
            </p>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
