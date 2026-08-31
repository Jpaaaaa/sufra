import { useTranslation } from 'react-i18next';

export function PosMoveBanner({ onCancel }: { onCancel: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="pos-banner">
      <span>{t('pos.pickTargetTable')}</span>
      <button type="button" className="pos-topbar-btn" onClick={onCancel}>
        {t('pos.cancel')}
      </button>
    </div>
  );
}
