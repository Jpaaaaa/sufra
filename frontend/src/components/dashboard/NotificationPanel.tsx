'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, AlertCircle, Clock, Package, Printer, Trash2 } from 'lucide-react';
import { getServerUrl, fetchJson, Hall } from '../../utils';
import { orderDisplayNumber } from '../../utils/order-display-number';

interface Notification {
  id: string;
  type: 'printer' | 'table' | 'kitchen' | 'stock';
  title: string;
  message: string;
  time: string;
}

interface Order {
  id: number;
  display_number?: number | null;
  table_id: number;
  status: string;
  created_at: string;
  table_name?: string;
  hall_name?: string;
  note?: string;
}

interface PrinterDevice {
  name: string;
  isDefault: boolean;
  status?: string;
}

const formatTimeAgo = (createdAt: string): string => {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'الآن';
  if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
  const hours = Math.floor(diffMins / 60);
  return `منذ ${hours} ساعة`;
};

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'printer':
      return Printer;
    case 'table':
      return Clock;
    case 'kitchen':
      return AlertCircle;
    case 'stock':
      return Package;
    default:
      return AlertCircle;
  }
};

const getNotificationColor = (type: Notification['type']) => {
  switch (type) {
    case 'printer':
      return 'text-red-500 bg-red-50';
    case 'table':
      return 'text-yellow-500 bg-yellow-50';
    case 'kitchen':
      return 'text-orange-500 bg-orange-50';
    case 'stock':
      return 'text-blue-500 bg-blue-50';
    default:
      return 'text-gray-500 bg-gray-50';
  }
};

export default function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const DROPDOWN_WIDTH = 384; // w-96
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    loadNotifications();
    // Refresh every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      const serverUrl = getServerUrl();
      const newNotifications: Notification[] = [];

      // Check printer status
      try {
        const printers = await fetchJson<PrinterDevice[]>(`${serverUrl}/printers/available`);
        if (printers.length === 0) {
          newNotifications.push({
            id: 'printer-1',
            type: 'printer',
            title: 'مشكلة في الطابعة',
            message: 'الطابعة الحرارية غير متصلة',
            time: formatTimeAgo(new Date().toISOString()),
          });
        }
      } catch (error) {
        newNotifications.push({
          id: 'printer-2',
          type: 'printer',
          title: 'مشكلة في الطابعة',
          message: 'فشل الاتصال بالطابعة',
          time: formatTimeAgo(new Date().toISOString()),
        });
      }

      // Check table wait times and kitchen delays from dine-in orders by hall
      try {
        const halls = await fetchJson<Hall[]>(`${serverUrl}/halls`);
        const virtualHallNames = ['طلبات خارجية', 'طلبات سفري / توصيل'];
        const filteredHalls = halls.filter((h) => !virtualHallNames.includes(h.name));

        for (const hall of filteredHalls) {
          try {
            const orders = await fetchJson<Order[]>(
              `${serverUrl}/orders/dine-in/hall/${hall.id}`,
            );
            const now = new Date();

            for (const order of orders) {
              if (order.status !== 'pending' && order.status !== 'printed') continue;

              const created = new Date(order.created_at);
              const diffMins = Math.floor((now.getTime() - created.getTime()) / 60000);

              if (diffMins > 20) {
                let tableName = order.table_name || `طاولة ${order.table_id}`;
                if (order.hall_name) {
                  tableName = `${tableName} (${order.hall_name})`;
                }

                newNotifications.push({
                  id: `table-${order.table_id}-${order.id}`,
                  type: 'table',
                  title: 'طاولة تنتظر',
                  message: `${tableName} تنتظر منذ ${diffMins} دقيقة`,
                  time: formatTimeAgo(order.created_at),
                });
              }

              if (order.status === 'printed' && diffMins > 30) {
                newNotifications.push({
                  id: `kitchen-${order.id}`,
                  type: 'kitchen',
                  title: 'تأخير في المطبخ',
                  message: `الطلب #${orderDisplayNumber(order)} متأخر في المطبخ منذ ${diffMins} دقيقة`,
                  time: formatTimeAgo(order.created_at),
                });
              }
            }
          } catch (error) {
            console.error(`Failed to check orders for hall ${hall.id}:`, error);
          }
        }
      } catch (error) {
        console.error('Failed to check hall order notifications:', error);
      }

      // Sort by time (most recent first) and limit to 10
      newNotifications.sort((a, b) => {
        // Simple sort - most recent first
        return b.id.localeCompare(a.id);
      });

      setNotifications(newNotifications.slice(0, 10));
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setNotifications([]);
    }
  };

  const updateDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Position dropdown under button, shifted right so it sits more to the right
      let left = rect.right - DROPDOWN_WIDTH + 24;
      // Keep fully on screen: clamp to viewport
      left = Math.max(0, Math.min(left, window.innerWidth - DROPDOWN_WIDTH));
      setDropdownPosition({
        top: rect.bottom + 8,
        left,
      });
    }
  };

  const handleToggle = () => {
    if (!isOpen) updateDropdownPosition();
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-black/5 shadow-soft hover:bg-cloud-soft-white hover:shadow-soft"
        aria-label="الإشعارات"
      >
        <Bell className="w-5 h-5 text-obsidian" />
        {notifications.length > 0 && (
          <span className="absolute -top-1 -left-1 flex items-center justify-center w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full">
            {notifications.length}
          </span>
        )}
      </button>

      {/* Portal for dropdown - renders into document.body to avoid clipping */}
      {isOpen && createPortal(
        <>
          {/* Overlay - only when open, so dropdown is above everything */}
          <div
            className="fixed inset-0 bg-black/20 z-[9998]"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Dropdown panel */}
          <div
            className="fixed w-96 max-h-[min(70vh,420px)] bg-white rounded-xl shadow-2xl z-[9999] border border-black/5 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-black/5">
              <h2 className="text-[18px] font-bold text-obsidian">الإشعارات</h2>
              <div className="flex items-center gap-1">
                {notifications.length > 0 && (
                  <button
                    onClick={() => setNotifications([])}
                    className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-cloud-soft-white"
                    aria-label="مسح الإشعارات"
                    title="مسح الإشعارات"
                  >
                    <Trash2 className="w-4 h-4 text-obsidian/60 hover:text-obsidian" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-cloud-soft-white"
                  aria-label="إغلاق"
                >
                  <X className="w-5 h-5 text-obsidian" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto max-h-[min(60vh,360px)]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <Bell className="w-12 h-12 text-obsidian/20 mb-4" />
                  <p className="text-obsidian/55 text-[15px]">لا توجد إشعارات</p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {notifications.map((notification) => {
                    const Icon = getNotificationIcon(notification.type);
                    const colorClasses = getNotificationColor(notification.type);

                    return (
                      <div
                        key={notification.id}
                        className="flex gap-3 p-3 rounded-xl bg-cloud-soft-white border border-black/5 hover:bg-cyber-aqua/5 cursor-pointer"
                      >
                        <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${colorClasses} flex items-center justify-center`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[14px] font-medium text-obsidian mb-0.5">
                            {notification.title}
                          </h3>
                          <p className="text-[12px] text-obsidian/70 mb-1">
                            {notification.message}
                          </p>
                          <p className="text-[11px] text-obsidian/45">
                            {notification.time}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
