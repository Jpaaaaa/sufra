import type { FC } from 'react';

interface OrdersWindowProps {
  onClose: () => void;
}

const OrdersWindow: FC<OrdersWindowProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <header className="flex items-center justify-between bg-slate-700 px-6 py-3 text-white">
          <h2 className="text-[18px] leading-tight font-semibold">الطلبات</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 px-3 py-1 text-[15px] leading-normal hover:bg-white/20"
          >
            إغلاق
          </button>
        </header>
        <main className="flex-1 bg-slate-50 px-6 py-4">
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-400">
            شاشة الطلبات
          </div>
        </main>
      </div>
    </div>
  );
};

export default OrdersWindow;
