import { useTranslation } from 'react-i18next';
import type { Item } from '../../../hooks/useItems';
import { PosSideSheet } from './PosSideSheet';

export function PosItemDetailSheet({
  item,
  onClose,
  onAdd,
}: {
  item: Item | null;
  onClose: () => void;
  onAdd?: (item: Item) => void;
}) {
  const { t } = useTranslation();
  const notes = item?.description?.trim() || '';
  const combo = item?._comboProducts ?? [];

  return (
    <PosSideSheet
      open={Boolean(item)}
      wide
      title={item?.name || t('pos.notes')}
      onClose={onClose}
      footer={
        item && onAdd && !item.is_out_of_stock ? (
          <button type="button" className="pos-primary" onClick={() => onAdd(item)}>
            {t('pos.add')}
          </button>
        ) : null
      }
    >
      {item && (
        <div className="px-4 py-3">
          <div className="mb-3 text-[15px] font-bold tabular-nums">{item.price}</div>
          {combo.length > 0 && (
            <>
              <div className="mb-2 text-[13px] font-bold text-graphite">{t('pos.comboItems')}</div>
              <ul className="mb-4 list-disc ps-5 text-[15px]">
                {combo.map((p) => (
                  <li key={p.id}>
                    {p.quantity && p.quantity > 1 ? `${p.quantity}× ` : ''}
                    {p.name}
                  </li>
                ))}
              </ul>
            </>
          )}
          {notes ? (
            <>
              <div className="mb-2 text-[13px] font-bold text-graphite">{t('pos.notes')}</div>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{notes}</p>
            </>
          ) : (
            combo.length === 0 && (
              <p className="text-[15px] text-graphite">{t('pos.noItemNotes')}</p>
            )
          )}
        </div>
      )}
    </PosSideSheet>
  );
}
