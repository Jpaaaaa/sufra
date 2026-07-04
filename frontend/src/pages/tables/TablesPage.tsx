import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import TablesTabs from '../../components/tabs/TablesTabs';
import { getServerUrl, Hall, TableEntity, fetchJson } from '../../utils';

export default function TablesPage() {
  const [searchParams] = useSearchParams();
  const hallIdParam = searchParams.get('hallId');
  const hallId = hallIdParam ? Number(hallIdParam) : NaN;
  const [, setHall] = useState<Hall | null>(null);
  const [, setTables] = useState<TableEntity[]>([]);
  const [, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state (unused for now - TODO: implement table form UI)
  // const [, setIsFormOpen] = useState(false);
  // const [, setFormState] = useState<TableFormState>({ name: '' });

  // TODO: Implement resetForm when UI is complete - removed unused function

  const loadHall = async () => {
    if (!hallId || Number.isNaN(hallId)) return;
    try {
      const serverUrl = getServerUrl();
      const raw = await fetchJson<any>(`${serverUrl}/halls/${hallId}`);
      const mapped: Hall = {
        id: raw.id,
        name: raw.name,
        number: raw.number ?? raw.hall_number,
      };
      setHall(mapped);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'تعذر تحميل بيانات الصالة');
    }
  };

  const loadTables = async () => {
    if (!hallId || Number.isNaN(hallId)) return;
    setLoading(true);
    setError(null);
    try {
      const serverUrl = getServerUrl();
      const raw = await fetchJson<any[]>(`${serverUrl}/halls/${hallId}/tables`);
      // Ensure raw is an array (handle null/undefined responses)
      const tablesArray = Array.isArray(raw) ? raw : [];
      const mapped: TableEntity[] = tablesArray.map((t) => ({
        id: t.id,
        number: t.number ?? 1,
        hall_id: hallId,
        name: t.name ?? '',
      }));
      setTables(mapped);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'تعذر تحميل الطاولات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHall();
    void loadTables();
  }, [hallId]);

  // TODO: Implement table management handlers when UI is complete
  // Handler functions removed as they're not used yet

  return (
    <div className="flex flex-1 flex-col bg-cloud-soft-white">
      <Header title="الطاولات" />
      <main className="flex-1 p-6">
        <section className="mx-auto max-w-7xl">
          <TablesTabs />
          {/* TODO: Add table management UI here similar to app/tables/page.tsx */}
          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-relaxed text-red-800">
              {error}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
