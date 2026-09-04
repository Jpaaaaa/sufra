import { useTranslation } from 'react-i18next';
import { formatItemDisplayName } from '../../../lib/item-options';
import type { CartItem } from '../../../hooks/useOrderModalTypes';

export function PosCartLine({
  line,
  active,
  onInc,
  onDec,
  onSelect,
}: {
  line: CartItem;
  active?: boolean;
  onInc: () => void;
  onDec: () => void;
  onSelect?: () => void;
}) {
  const { t } = useTranslation();
  const isTray = line.lineKind === 'tray';
  const name =
    isTray
      ? line.trayName || line.item.name
      : formatItemDisplayName(line.offerDisplayName || line.item.name, line.selectedOptions);
  const children = isTray ? line.children ?? [] : [];

  return (
    <div className={`pos-cart-line ${isTray ? 'is-tray' : ''} ${active ? 'is-active' : ''}`}>
      <div className="pos-cart-line-main">
        <button
          type="button"
          className="pos-cart-line-name"
          onClick={onSelect}
          disabled={!onSelect}
        >
          {name}
          {isTray && (
            <span className="pos-cart-badge">
              {line.trayLocked ? t('pos.trayLocked') : t('pos.trayBadge')}
            </span>
          )}
        </button>
        <div className="pos-stepper">
          <button type="button" onClick={onDec}>
            −
          </button>
          <span className="min-w-[1.25rem] text-center text-[14px] font-bold tabular-nums">
            {line.quantity}
          </span>
          <button type="button" onClick={onInc}>
            +
          </button>
        </div>
        <div className="pos-cart-line-price">{(line.linePrice * line.quantity).toFixed(0)}</div>
      </div>
      {children.length > 0 && (
        <ul className="pos-cart-children">
          {children.map((child) => (
            <li key={child.cartLineId}>
              {child.quantity}× {child.item.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
