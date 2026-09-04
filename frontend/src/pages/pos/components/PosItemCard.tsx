import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Item } from '../../../hooks/useItems';
import { posItemImageSrc } from '../item-image';

export function PosItemCard({
  item,
  kitchenColor,
  onTap,
  onLongPress,
}: {
  item: Item;
  kitchenColor?: string;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const { t } = useTranslation();
  const src = posItemImageSrc(item);
  const out = Boolean(item.is_out_of_stock);
  const mono = (item.name || '?').trim().charAt(0);
  const suppressClick = useRef(false);

  return (
    <button
      type="button"
      className={`pos-item-card ${out ? 'is-oos' : ''}`}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const id = window.setTimeout(() => {
          suppressClick.current = true;
          onLongPress();
        }, 500);
        const clear = () => {
          window.clearTimeout(id);
          window.removeEventListener('pointerup', clear);
          window.removeEventListener('pointercancel', clear);
        };
        window.addEventListener('pointerup', clear);
        window.addEventListener('pointercancel', clear);
      }}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        if (out) return;
        onTap();
      }}
    >
      <div className="pos-item-band" style={{ ['--pos-kitchen' as string]: kitchenColor || '#d6d3d1' }}>
        {src ? (
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <span className="pos-item-mono">{mono}</span>
        )}
        <span className="pos-item-kitchen-dot" />
        {out && <span className="pos-oos-badge">{t('pos.outOfStock')}</span>}
      </div>
      <div className="pos-item-body">
        <span className="truncate text-[13px] leading-snug">{item.name}</span>
        {item._comboProducts && item._comboProducts.length > 0 && (
          <span className="pos-item-combo">
            {item._comboProducts
              .map((p) => (p.quantity && p.quantity > 1 ? `${p.quantity}× ${p.name}` : p.name))
              .join(' · ')}
          </span>
        )}
        <span className="text-[15px] font-bold tabular-nums">{item.price}</span>
      </div>
    </button>
  );
}
