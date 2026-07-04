import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showToast } from '../ui/Toast';

function HeaderSupportAnyDesk() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const openAnyDesk = async () => {
    if (!window.sufra?.support?.openAnyDesk) {
      showToast(t('layout.toastSupportDesktopOnly'), 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await window.sufra.support.openAnyDesk();
      if (!res.ok) {
        showToast(res.error || t('layout.toastAnyDeskOpenFailed'), 'error');
        return;
      }
      if (res.action === 'launched') {
        showToast(t('layout.toastAnyDeskLaunched'), 'success');
      } else {
        showToast(t('layout.toastAnyDeskInstallerPage'), 'success');
      }
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || t('layout.toastAnyDeskFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const openDownloadOnly = async () => {
    if (!window.sufra?.support?.openAnyDeskDownloadPage) {
      showToast(t('layout.toastDownloadDesktopOnly'), 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await window.sufra.support.openAnyDeskDownloadPage();
      if (!res.ok) {
        showToast(res.error || t('layout.toastBrowserOpenFailed'), 'error');
        return;
      }
      showToast(t('layout.toastAnyDeskDownloadPageOpened'), 'success');
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || t('layout.toastLinkOpenFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex flex-col items-end gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#4A5668]/90">{t('layout.supportTitle')}</span>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => void openAnyDesk()}
          disabled={busy}
          className="rounded-lg bg-[#2EE7C9] px-2.5 py-1.5 text-[12px] font-semibold text-[#1A1F25] shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          {busy ? t('layout.supportBusy') : t('layout.openAnyDesk')}
        </button>
        <button
          type="button"
          onClick={() => void openDownloadOnly()}
          disabled={busy}
          className="rounded-lg border border-[#4A5668]/25 bg-white/80 px-2.5 py-1.5 text-[12px] font-medium text-[#1A1F25] hover:bg-white disabled:opacity-50"
        >
          {t('layout.download')}
        </button>
      </div>
    </div>
  );
}

export default memo(HeaderSupportAnyDesk);
