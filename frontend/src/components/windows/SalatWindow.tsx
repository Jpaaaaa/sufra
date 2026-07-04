import { useEffect, useState, type FC } from 'react';
import { showConfirm } from '../ui/ConfirmDialog';
import { showToast } from '../ui/Toast';
import { getServerUrl } from '../../lib/server-config';
import { useGlobalNumericField } from '../../contexts/GlobalNumericKeypadContext';

interface SalatWindowProps {
  onClose: () => void;
}

type Hall = {
  id: number;
  name: string;
  hall_number: number;
};

type TableEntity = {
  id: number;
  name: string;
  hall_id: number;
  created_at: string;
  updated_at: string;
};

const SalatWindow: FC<SalatWindowProps> = ({ onClose }) => {
  const [activeSubtab, setActiveSubtab] = useState<
    'salat' | 'tables' | 'qa3aat' | 'groups'
  >('salat');

  const [halls, setHalls] = useState<Hall[]>([]);
  const [selectedHallId, setSelectedHallId] = useState<number | null>(null);
  const [form, setForm] = useState<{ name: string; hall_number: number | '' }>(
    { name: '', hall_number: '' },
  );
  const [tables, setTables] = useState<TableEntity[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [tableForm, setTableForm] = useState<{ name: string }>({
    name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const hallNumberField = useGlobalNumericField(
    form.hall_number === '' ? '' : String(form.hall_number),
    (s) =>
      setForm((prev) => ({
        ...prev,
        hall_number: s === '' ? '' : Number(s) || 0,
      })),
  );

  const resetMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const fetchHalls = async () => {
    setLoading(true);
    resetMessages();
    try {
      const res = await fetch(`${getServerUrl()}/halls`);
      if (!res.ok) {
        throw new Error('Failed to load halls');
      }
      const data: Hall[] = await res.json();
      setHalls(data);
    } catch (err) {
      console.error(err);
      setError('حدث خطأ أثناء تحميل الصالات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubtab === 'salat') {
      fetchHalls();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubtab]);

  const fetchTables = async (hallId: number | null) => {
    if (hallId === null) {
      setTables([]);
      setSelectedTableId(null);
      setTableForm({ name: '' });
      return;
    }

    setLoading(true);
    resetMessages();
    try {
      const res = await fetch(
        `${getServerUrl()}/tables?hall_id=${hallId}`,
      );
      if (!res.ok) {
        throw new Error('Failed to load tables');
      }
      const data: TableEntity[] = await res.json();
      setTables(data);
    } catch (err) {
      console.error(err);
      setError('حدث خطأ أثناء تحميل الطاولات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubtab === 'tables') {
      fetchTables(selectedHallId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubtab, selectedHallId]);

  const handleSelectHall = (hall: Hall) => {
    setSelectedHallId(hall.id);
    setForm({
      name: hall.name,
      hall_number: hall.hall_number,
    });
    // When selecting a hall, refresh its tables if the tables tab is active
    if (activeSubtab === 'tables') {
      fetchTables(hall.id);
    }
    resetMessages();
  };

  const handleNew = () => {
    resetMessages();
    if (activeSubtab === 'salat') {
      setSelectedHallId(null);
      const maxHallNumber =
        halls.length > 0 ? Math.max(...halls.map((h) => h.hall_number)) : 0;
      setForm({
        name: '',
        hall_number: maxHallNumber + 1,
      });
    } else if (activeSubtab === 'tables') {
      setSelectedTableId(null);
      if (selectedHallId == null) {
        setTableForm({ name: '' });
      } else {
        setTableForm({ name: '' });
      }
    }
  };

  const handleSave = async () => {
    resetMessages();
    if (activeSubtab === 'salat') {
      if (!form.name || form.hall_number === '') {
        setError('يرجى إدخال اسم الصالة ورقمها.');
        return;
      }

      const hallNumber =
        typeof form.hall_number === 'number'
          ? form.hall_number
          : Number(form.hall_number);

      if (!Number.isFinite(hallNumber) || hallNumber <= 0) {
        setError('رقم الصالة غير صالح.');
        return;
      }

      try {
        setLoading(true);
        const payload = {
          name: form.name,
          hall_number: hallNumber,
        };

        let url = `${getServerUrl()}/halls`;
        let method: 'POST' | 'PUT' = 'POST';

        if (selectedHallId !== null) {
          url = `${getServerUrl()}/halls/${selectedHallId}`;
          method = 'PUT';
        }

        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error('Failed to save hall');
        }

        const saved: Hall = await res.json();
        setSuccessMessage('تمت العملية بنجاح');
        setTimeout(() => setSuccessMessage(null), 3000);
        setSelectedHallId(saved.id);
        await fetchHalls();
      } catch (err) {
        console.error(err);
        setError('حدث خطأ أثناء حفظ بيانات الصالة.');
      } finally {
        setLoading(false);
      }
    } else if (activeSubtab === 'tables') {
      if (selectedHallId == null) {
        setError('يرجى اختيار صالة أولاً.');
        return;
      }

      if (!tableForm.name.trim()) {
        setError('يرجى إدخال اسم الطاولة.');
        return;
      }

      try {
        setLoading(true);
        const payload = {
          name: tableForm.name.trim(),
          hall_id: selectedHallId,
        };

        let url = `${getServerUrl()}/tables`;
        let method: 'POST' | 'PUT' = 'POST';

        if (selectedTableId !== null) {
          url = `${getServerUrl()}/tables/${selectedTableId}`;
          method = 'PUT';
        }

        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error('Failed to save table');
        }

        const saved: TableEntity = await res.json();
        setSuccessMessage('تمت العملية بنجاح');
        setTimeout(() => setSuccessMessage(null), 3000);
        setSelectedTableId(saved.id);
        await fetchTables(selectedHallId);
      } catch (err) {
        console.error(err);
        setError('حدث خطأ أثناء حفظ بيانات الطاولة.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDelete = async () => {
    resetMessages();
    if (activeSubtab === 'salat') {
      if (selectedHallId === null) {
        return;
      }

      const confirmed = await showConfirm({
        message: 'هل أنت متأكد من حذف هذه الصالة؟',
        title: 'حذف الصالة',
        confirmText: 'حذف',
        cancelText: 'إلغاء',
        confirmColor: 'danger',
      });
      if (!confirmed) {
        return;
      }

      try {
        setLoading(true);
        const res = await fetch(
          `${getServerUrl()}/halls/${selectedHallId}`,
          {
            method: 'DELETE',
          },
        );

        if (!res.ok) {
          throw new Error('Failed to delete hall');
        }

        setSuccessMessage('تمت العملية بنجاح');
        setTimeout(() => setSuccessMessage(null), 3000);
        showToast('تم حذف الصالة بنجاح', 'success');
        setSelectedHallId(null);
        setForm({ name: '', hall_number: '' });
        await fetchHalls();
        await fetchTables(null);
      } catch (err) {
        console.error(err);
        setError('حدث خطأ أثناء حذف الصالة.');
        showToast('حدث خطأ أثناء حذف الصالة', 'error');
      } finally {
        setLoading(false);
      }
    } else if (activeSubtab === 'tables') {
      if (selectedTableId === null) {
        return;
      }

      const confirmed = await showConfirm({
        message: 'هل أنت متأكد من حذف هذه الطاولة؟',
        title: 'حذف الطاولة',
        confirmText: 'حذف',
        cancelText: 'إلغاء',
        confirmColor: 'danger',
      });
      if (!confirmed) {
        return;
      }

      try {
        setLoading(true);
        const res = await fetch(
          `${getServerUrl()}/tables/${selectedTableId}`,
          {
            method: 'DELETE',
          },
        );

        if (!res.ok) {
          throw new Error('Failed to delete table');
        }

        setSuccessMessage('تمت العملية بنجاح');
        setTimeout(() => setSuccessMessage(null), 3000);
        showToast('تم حذف الطاولة بنجاح', 'success');
        setSelectedTableId(null);
        setTableForm({ name: '' });
        await fetchTables(selectedHallId);
      } catch (err) {
        console.error(err);
        setError('حدث خطأ أثناء حذف الطاولة.');
        showToast('حدث خطأ أثناء حذف الطاولة', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const renderContent = () => {
    const baseClasses =
      'flex h-64 items-center justify-center rounded-2xl border-2 border-dashed border-emerald-500/30 bg-gradient-to-br from-[#002d1f]/40 to-[#003d29]/40 text-emerald-300/70 backdrop-blur-sm';

    if (activeSubtab === 'tables') {
      return (
        <div className="flex flex-col gap-4">
          {loading && (
            <div className="text-[15px] leading-normal text-emerald-300/70">جاري تحميل الطاولات...</div>
          )}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-gradient-to-br from-red-500/20 to-rose-500/20 px-4 py-3 text-[15px] leading-normal text-red-200 backdrop-blur-sm">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 px-4 py-3 text-[15px] leading-normal text-emerald-200 backdrop-blur-sm">
              {successMessage}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            {/* Tables form */}
            <div className="space-y-3 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#002d1f]/60 to-[#003d29]/60 p-5 backdrop-blur-xl">
              <h3 className="mb-1 text-[16px] leading-normal font-semibold text-emerald-200">
                بيانات الطاولة
              </h3>
              <div className="space-y-2 text-[15px] leading-normal">
                <label className="block text-emerald-300/90">
                  اسم الطاولة
                  <input
                    type="text"
                    className="mt-2 w-full rounded-xl border border-emerald-500/30 bg-[#001510]/60 px-4 py-2.5 text-[15px] leading-normal text-emerald-100 backdrop-blur-sm placeholder:text-emerald-400/40 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-40"
                    value={tableForm.name}
                    onChange={(e) =>
                      setTableForm({
                        name: e.target.value,
                      })
                    }
                    disabled={selectedHallId === null}
                  />
                </label>
                {selectedHallId === null && (
                  <p className="text-[13px] leading-relaxed text-emerald-400/60">
                    يرجى اختيار صالة أولاً لإدارة الطاولات.
                  </p>
                )}
              </div>
            </div>

            {/* Tables grid */}
            <div className="md:col-span-2 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#002d1f]/60 to-[#003d29]/60 p-5 backdrop-blur-xl">
              <h3 className="mb-3 text-[16px] leading-normal font-semibold text-emerald-200">
                قائمة الطاولات
              </h3>
              {selectedHallId === null ? (
                <div className={baseClasses}>
                  يرجى اختيار صالة لعرض الطاولات
                </div>
              ) : tables.length === 0 && !loading ? (
                <div className={baseClasses}>لا توجد طاولات بعد</div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {tables.map((table) => {
                    const isActive = table.id === selectedTableId;
                    return (
                      <button
                        key={table.id}
                        type="button"
                        onClick={() => {
                          setSelectedTableId(table.id);
                          setTableForm({
                            name: table.name,
                          });
                          resetMessages();
                        }}
                        className={`flex aspect-square flex-col items-center justify-center rounded-2xl border text-center text-[15px] leading-normal backdrop-blur-sm ${
                          isActive
                            ? 'border-emerald-400/60 bg-gradient-to-br from-emerald-500/30 to-teal-500/30 text-emerald-50 shadow-lg shadow-emerald-500/30'
                            : 'border-emerald-500/30 bg-gradient-to-br from-[#001510]/60 to-[#002818]/60 text-emerald-300/80 hover:border-emerald-400/60 hover:from-emerald-500/20 hover:to-teal-500/20 hover:text-emerald-200'
                        }`}
                      >
                        <span className="text-[18px] leading-tight font-bold">
                          {table.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (activeSubtab === 'qa3aat') {
      return <div className={baseClasses}>شاشة القاعات</div>;
    }

    if (activeSubtab === 'groups') {
      return <div className={baseClasses}>شاشة المجموعات</div>;
    }

    // default: salat -> full halls management UI
    return (
      <div className="flex flex-col gap-4">
        {loading && (
          <div className="text-[15px] leading-normal text-emerald-300/70">جاري تحميل الصالات...</div>
        )}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-gradient-to-br from-red-500/20 to-rose-500/20 px-4 py-3 text-[15px] leading-normal text-red-200 backdrop-blur-sm">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 px-4 py-3 text-[15px] leading-normal text-emerald-200 backdrop-blur-sm">
            {successMessage}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {/* Form */}
          <div className="space-y-3 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#002d1f]/60 to-[#003d29]/60 p-5 backdrop-blur-xl">
            <h3 className="mb-1 text-[16px] leading-normal font-semibold text-emerald-200">
              بيانات الصالة
            </h3>

            <div className="space-y-3 text-[15px] leading-normal">
              <label className="block text-emerald-300/90">
                اسم الصالة
                <input
                  type="text"
                  className="mt-2 w-full rounded-xl border border-emerald-500/30 bg-[#001510]/60 px-4 py-2.5 text-[15px] leading-normal text-emerald-100 backdrop-blur-sm placeholder:text-emerald-400/40 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </label>

              <label className="block text-emerald-300/90">
                رقم الصالة
                <input
                  type="text"
                  inputMode="numeric"
                  className="mt-2 w-full rounded-xl border border-emerald-500/30 bg-[#001510]/60 px-4 py-2.5 text-[15px] leading-normal text-emerald-100 backdrop-blur-sm placeholder:text-emerald-400/40 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  value={form.hall_number === '' ? '' : form.hall_number}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      hall_number:
                        e.target.value === ''
                          ? ''
                          : Number(e.target.value),
                    }))
                  }
                  onFocus={hallNumberField.onFocus}
                />
              </label>
            </div>
          </div>

          {/* Halls grid */}
          <div className="md:col-span-2 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#002d1f]/60 to-[#003d29]/60 p-5 backdrop-blur-xl">
            <h3 className="mb-3 text-[16px] leading-normal font-semibold text-emerald-200">
              قائمة الصالات
            </h3>
            {halls.length === 0 && !loading ? (
              <div className={baseClasses}>لا توجد صالات بعد</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4">
                {halls.map((hall) => {
                  const isActive = hall.id === selectedHallId;
                  return (
                    <button
                      key={hall.id}
                      type="button"
                      onClick={() => handleSelectHall(hall)}
                      className={`flex aspect-square flex-col items-center justify-center rounded-2xl border text-center text-[15px] leading-normal backdrop-blur-sm ${
                        isActive
                          ? 'border-emerald-400/60 bg-gradient-to-br from-emerald-500/30 to-teal-500/30 text-emerald-50 shadow-lg shadow-emerald-500/30'
                          : 'border-emerald-500/30 bg-gradient-to-br from-[#001510]/60 to-[#002818]/60 text-emerald-300/80 hover:border-emerald-400/60 hover:from-emerald-500/20 hover:to-teal-500/20 hover:text-emerald-200'
                      }`}
                    >
                      <span className="text-[28px] leading-tight font-bold">
                        {hall.hall_number}
                      </span>
                      <span className="mt-2 truncate px-2 text-[15px] leading-normal">{hall.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-[#001a12]/98 via-[#002d1f]/98 to-[#001510]/98 shadow-2xl shadow-black/50 backdrop-blur-xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-emerald-500/30 bg-gradient-to-r from-[#002d1f]/80 to-[#003d29]/80 px-8 py-5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/30 to-indigo-500/30">
              <svg
                className="h-6 w-6 text-purple-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h2 className="text-[20px] leading-tight font-semibold text-emerald-50">الصالات</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="group flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-[#003d29]/60 to-[#002d1f]/60 px-5 py-2.5 text-[15px] leading-normal font-medium text-emerald-200 backdrop-blur-xl hover:border-emerald-400/60 hover:bg-emerald-500/20 hover:text-emerald-50 hover:shadow-lg hover:shadow-emerald-500/30"
          >
            <span>إغلاق</span>
            <svg
              className="h-4 w-4 "
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>

        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-emerald-500/20 bg-gradient-to-r from-[#001a12]/90 to-[#002d1f]/90 px-8 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleNew}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 px-4 py-2 text-[15px] leading-normal font-medium text-emerald-200 backdrop-blur-xl hover:border-emerald-400/60 hover:bg-emerald-500/30 hover:text-emerald-50 hover:shadow-lg hover:shadow-emerald-500/30 disabled:opacity-40"
              disabled={loading}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>جديد</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-gradient-to-br from-green-500/20 to-emerald-500/20 px-4 py-2 text-[15px] leading-normal font-medium text-green-200 backdrop-blur-xl hover:border-green-400/60 hover:bg-green-500/30 hover:text-green-50 hover:shadow-lg hover:shadow-green-500/30 disabled:opacity-40"
              disabled={loading}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>حفظ</span>
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-gradient-to-br from-red-500/20 to-rose-500/20 px-4 py-2 text-[15px] leading-normal font-medium text-red-200 backdrop-blur-xl hover:border-red-400/60 hover:bg-red-500/30 hover:text-red-50 hover:shadow-lg hover:shadow-red-500/30 disabled:opacity-40"
              disabled={loading || selectedHallId === null}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>حذف</span>
            </button>
          </div>
          <span className="text-[15px] leading-normal text-emerald-300/70">إدارة الصالات</span>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-[#001510]/50 to-[#002818]/50 px-8 py-6">
          {renderContent()}
        </main>

        {/* Bottom subtabs */}
        <nav className="border-t border-emerald-500/20 bg-gradient-to-r from-[#001a12]/95 to-[#002d1f]/95 px-8 py-4 backdrop-blur-xl">
          <div className="flex justify-center">
            <div className="inline-flex gap-2 rounded-2xl border border-emerald-500/20 bg-[#001510]/60 p-2 backdrop-blur-xl">
              {/* الطاولات */}
              <button
                type="button"
                onClick={() => setActiveSubtab('tables')}
                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-[15px] leading-normal font-medium ${
                  activeSubtab === 'tables'
                    ? 'bg-gradient-to-br from-emerald-500/30 to-teal-500/30 text-emerald-50 shadow-lg shadow-emerald-500/20'
                    : 'text-emerald-300/70 hover:bg-emerald-500/10 hover:text-emerald-200'
                }`}
              >
                <span aria-hidden>🍽️</span>
                <span>الطاولات</span>
              </button>

              {/* الصالات */}
              <button
                type="button"
                onClick={() => setActiveSubtab('salat')}
                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-[15px] leading-normal font-medium ${
                  activeSubtab === 'salat'
                    ? 'bg-gradient-to-br from-emerald-500/30 to-teal-500/30 text-emerald-50 shadow-lg shadow-emerald-500/20'
                    : 'text-emerald-300/70 hover:bg-emerald-500/10 hover:text-emerald-200'
                }`}
              >
                <span aria-hidden>🪑</span>
                <span>الصالات</span>
              </button>

              {/* القاعات */}
              <button
                type="button"
                onClick={() => setActiveSubtab('qa3aat')}
                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-[15px] leading-normal font-medium ${
                  activeSubtab === 'qa3aat'
                    ? 'bg-gradient-to-br from-emerald-500/30 to-teal-500/30 text-emerald-50 shadow-lg shadow-emerald-500/20'
                    : 'text-emerald-300/70 hover:bg-emerald-500/10 hover:text-emerald-200'
                }`}
              >
                <span aria-hidden>🏛️</span>
                <span>القاعات</span>
              </button>

              {/* المجموعات */}
              <button
                type="button"
                onClick={() => setActiveSubtab('groups')}
                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-[15px] leading-normal font-medium ${
                  activeSubtab === 'groups'
                    ? 'bg-gradient-to-br from-emerald-500/30 to-teal-500/30 text-emerald-50 shadow-lg shadow-emerald-500/20'
                    : 'text-emerald-300/70 hover:bg-emerald-500/10 hover:text-emerald-200'
                }`}
              >
                <span aria-hidden>🧩</span>
                <span>المجموعات</span>
              </button>
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
};

export default SalatWindow;
