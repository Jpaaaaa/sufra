'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { OrderReport } from '@/lib/reports/types';
import { formatCurrency } from '@/lib/reports/utils';

interface OrdersTableProps {
  data: OrderReport[];
}

type SortField = 'id' | 'openTime' | 'closeTime' | 'itemCount' | 'totalAmount' | 'status' | 'employee';
type SortDirection = 'asc' | 'desc';

export default function OrdersTable({ data }: OrdersTableProps) {
  const { t, i18n } = useTranslation();
  const sortLocale = useMemo(() => (i18n.language?.startsWith('en') ? 'en' : 'ar'), [i18n.language]);

  const [sortField, setSortField] = useState<SortField>('openTime');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: t('orders.statusPending'),
      printed: t('orders.statusPrinted'),
      completed: t('orders.statusCompleted'),
      cancelled: t('orders.statusCancelled'),
    };
    return map[status] ?? map.pending;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    if (sortField === 'id') {
      aValue = a.id;
      bValue = b.id;
    } else if (sortField === 'openTime') {
      aValue = new Date(a.openTime).getTime();
      bValue = new Date(b.openTime).getTime();
    } else if (sortField === 'closeTime') {
      aValue = a.closeTime ? new Date(a.closeTime).getTime() : 0;
      bValue = b.closeTime ? new Date(b.closeTime).getTime() : 0;
    } else if (sortField === 'itemCount') {
      aValue = a.itemCount;
      bValue = b.itemCount;
    } else if (sortField === 'totalAmount') {
      aValue = a.totalAmount;
      bValue = b.totalAmount;
    } else if (sortField === 'status') {
      aValue = a.status;
      bValue = b.status;
    } else {
      aValue = a.employee;
      bValue = b.employee;
    }

    if (typeof aValue === 'string') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue as string, sortLocale)
        : (bValue as string).localeCompare(aValue, sortLocale);
    } else {
      const aNum = typeof aValue === 'number' ? aValue : Number(aValue);
      const bNum = typeof bValue === 'number' ? bValue : Number(bValue);
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    }
  });

  const paginatedData = sortedData.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string }> = {
      pending: { color: 'bg-pulse-violet/10 text-pulse-violet border-pulse-violet/20' },
      printed: { color: 'bg-cyber-aqua/10 text-cyber-aqua border-cyber-aqua/20' },
      completed: { color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
      cancelled: { color: 'bg-red-100 text-red-700 border-red-200' },
    };

    const statusConfig = config[status] || config.pending;

    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[13px] leading-relaxed font-medium ${statusConfig.color}`}
      >
        {statusLabel(status)}
      </span>
    );
  };

  const formatDateTime = (dateString: string) => {
    const d = new Date(dateString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="h-4 w-4 text-obsidian/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="h-4 w-4 text-cyber-aqua" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="h-4 w-4 text-cyber-aqua" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="rounded-soft-xl border border-black/5 bg-white p-6 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[20px] leading-tight font-semibold text-obsidian">{t('reports.ordersTableTitle')}</h3>
          <p className="text-[15px] leading-normal text-obsidian/60">{t('reports.ordersTableSubtitle')}</p>
        </div>
        <div className="text-[15px] leading-normal text-obsidian/60">
          {t('reports.ordersTotalCount', { count: data.length })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/5">
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                <button
                  type="button"
                  onClick={() => handleSort('id')}
                  className="flex items-center gap-2 hover:text-cyber-aqua"
                >
                  {t('reports.colOrderId')}
                  <SortIcon field="id" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                <button
                  type="button"
                  onClick={() => handleSort('openTime')}
                  className="flex items-center gap-2 hover:text-cyber-aqua"
                >
                  {t('reports.colOpenTime')}
                  <SortIcon field="openTime" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                <button
                  type="button"
                  onClick={() => handleSort('closeTime')}
                  className="flex items-center gap-2 hover:text-cyber-aqua"
                >
                  {t('reports.colCloseTime')}
                  <SortIcon field="closeTime" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                <button
                  type="button"
                  onClick={() => handleSort('itemCount')}
                  className="flex items-center gap-2 hover:text-cyber-aqua"
                >
                  {t('reports.colItemCount')}
                  <SortIcon field="itemCount" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                <button
                  type="button"
                  onClick={() => handleSort('totalAmount')}
                  className="flex items-center gap-2 hover:text-cyber-aqua"
                >
                  {t('reports.colTotalAmount')}
                  <SortIcon field="totalAmount" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                <button
                  type="button"
                  onClick={() => handleSort('status')}
                  className="flex items-center gap-2 hover:text-cyber-aqua"
                >
                  {t('reports.colStatus')}
                  <SortIcon field="status" />
                </button>
              </th>
              <th className="px-4 py-3 text-right text-[15px] leading-normal font-bold text-obsidian">
                <button
                  type="button"
                  onClick={() => handleSort('employee')}
                  className="flex items-center gap-2 hover:text-cyber-aqua"
                >
                  {t('reports.colEmployee')}
                  <SortIcon field="employee" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((order) => (
              <tr
                key={order.id}
                className="border-b border-black/5 hover:bg-cloud-soft-white/50"
              >
                <td className="px-4 py-3 text-[15px] leading-normal font-medium text-obsidian">#{order.id}</td>
                <td className="px-4 py-3 text-[15px] leading-normal text-obsidian">{formatDateTime(order.openTime)}</td>
                <td className="px-4 py-3 text-[15px] leading-normal text-obsidian">
                  {order.closeTime ? formatDateTime(order.closeTime) : '—'}
                </td>
                <td className="px-4 py-3 text-[15px] leading-normal text-obsidian">{order.itemCount}</td>
                <td className="px-4 py-3 text-[15px] leading-normal font-medium text-obsidian">
                  {formatCurrency(order.totalAmount)}
                </td>
                <td className="px-4 py-3">{getStatusBadge(order.status)}</td>
                <td className="px-4 py-3 text-[15px] leading-normal text-obsidian">{order.employee}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-soft-lg border border-black/5 bg-cloud-soft-white px-4 py-2 text-[15px] leading-normal font-medium text-obsidian hover:bg-cloud-soft-white/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('reports.paginationPrev')}
          </button>
          <span className="text-[15px] leading-normal text-obsidian/60">
            {t('reports.pageOf', { page, total: totalPages })}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-soft-lg border border-black/5 bg-cloud-soft-white px-4 py-2 text-[15px] leading-normal font-medium text-obsidian hover:bg-cloud-soft-white/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('reports.paginationNext')}
          </button>
        </div>
      )}
    </div>
  );
}
