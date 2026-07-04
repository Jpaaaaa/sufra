'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchJson, getServerUrl } from '../../utils';
import { showToast } from '../../components/ui/Toast';
import { TrashIcon } from '../../components/icons';
import { useGlobalNumericField } from '../../contexts/GlobalNumericKeypadContext';
import type { DeliveryPlatformRow } from '../../hooks/useDeliveryOrderModal';

export function DeliveryPlatformsSection() {
  const { t } = useTranslation();
  const [platforms, setPlatforms] = useState<DeliveryPlatformRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [percent, setPercent] = useState('');
  const [saving, setSaving] = useState(false);
  const percentField = useGlobalNumericField(percent, setPercent);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const serverUrl = getServerUrl();
      const data = await fetchJson<DeliveryPlatformRow[]>(`${serverUrl}/orders/delivery/platforms`);
      setPlatforms(Array.isArray(data) ? data : []);
    } catch {
      setPlatforms([]);
      showToast(t('orders.platformToastLoadFail'), 'error');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async () => {
    const n = name.trim();
    const p = parseFloat(percent.replace(',', '.'));
    if (!n) {
      showToast(t('orders.platformToastNameRequired'), 'error');
      return;
    }
    if (Number.isNaN(p) || p < 0 || p > 100) {
      showToast(t('orders.platformToastPercentRange'), 'error');
      return;
    }
    setSaving(true);
    try {
      const serverUrl = getServerUrl();
      await fetchJson(`${serverUrl}/orders/delivery/platforms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n, commission_percent: p }),
      });
      setName('');
      setPercent('');
      showToast(t('orders.platformToastAdded'), 'success');
      await load();
    } catch (e: any) {
      showToast(e?.message || t('orders.platformToastSaveFail'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('orders.platformConfirmDelete'))) return;
    try {
      const serverUrl = getServerUrl();
      await fetchJson(`${serverUrl}/orders/delivery/platforms/${id}`, { method: 'DELETE' });
      showToast(t('orders.platformToastDeleted'), 'success');
      await load();
    } catch (e: any) {
      showToast(e?.message || t('orders.platformToastDeleteFail'), 'error');
    }
  };

  return (
    <div className="rounded-soft-xl border border-black/5 bg-cloud-soft-white p-6 shadow-soft">
      <div className="mb-6">
        <h2 className="text-[20px] leading-tight font-semibold text-obsidian mb-2">{t('orders.platformsTitle')}</h2>
        <p className="text-[14px] leading-relaxed text-obsidian/70">{t('orders.platformsIntro')}</p>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-soft-lg border border-cyber-aqua/20 bg-cyber-aqua/5 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block text-[13px] font-bold text-obsidian mb-1">{t('orders.platformNameLabel')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('orders.platformNamePlaceholder')}
            className="w-full rounded-soft-lg border border-black/10 bg-white px-3 py-2 text-[15px] text-obsidian"
          />
        </div>
        <div className="w-full sm:w-32">
          <label className="block text-[13px] font-bold text-obsidian mb-1">{t('orders.platformCommissionLabel')}</label>
          <input
            type="text"
            inputMode="decimal"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            onFocus={percentField.onFocus}
            placeholder="15"
            className="w-full rounded-soft-lg border border-black/10 bg-white px-3 py-2 text-[15px] text-obsidian"
          />
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleAdd()}
          className="rounded-soft-lg bg-cyber-aqua px-5 py-2.5 text-[15px] font-bold text-white shadow-soft hover:bg-cyber-aqua/90 disabled:opacity-50"
        >
          {t('orders.platformAdd')}
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-obsidian/60">{t('orders.platformLoading')}</div>
      ) : platforms.length === 0 ? (
        <div className="rounded-soft-lg border border-dashed border-black/10 py-12 text-center text-obsidian/60">
          {t('orders.platformEmpty')}
        </div>
      ) : (
        <ul className="space-y-2">
          {platforms.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-soft-lg border border-black/5 bg-white px-4 py-3"
            >
              <div>
                <span className="font-bold text-obsidian">{p.name}</span>
                <span className="ms-2 text-[14px] text-obsidian/70">
                  {t('orders.platformCommissionDisplay', { percent: p.commission_percent })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void handleDelete(p.id)}
                className="flex items-center gap-1 rounded-soft-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[13px] font-bold text-red-700 hover:bg-red-100"
              >
                <TrashIcon className="h-4 w-4" />
                {t('orders.platformDelete')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
