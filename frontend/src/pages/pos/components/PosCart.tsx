import { useTranslation } from 'react-i18next';
import type { CartItem, ExistingOrder } from '../../../hooks/useOrderModalTypes';
import { orderDisplayNumber } from '../../../utils/order-display-number';
import { PosCartLine } from './PosCartLine';

export function PosCart({
  open,
  existingOrders,
  ordersExpanded,
  onToggleOrders,
  lines,
  tableTotal,
  submitDisabled,
  printDisabled,
  submitHint,
  activeTrayId,
  editingOrder,
  onInc,
  onDec,
  onDiscount,
  onSubmit,
  onPrint,
  onAddTray,
  onSelectTray,
  onEditOrder,
  onCancelEdit,
  onPrintOrder,
}: {
  open?: boolean;
  existingOrders: ExistingOrder[];
  ordersExpanded: boolean;
  onToggleOrders: () => void;
  lines: CartItem[];
  tableTotal: number;
  submitDisabled: boolean;
  printDisabled: boolean;
  submitHint?: string;
  activeTrayId: string | null;
  editingOrder: ExistingOrder | null;
  onInc: (line: CartItem) => void;
  onDec: (line: CartItem) => void;
  onDiscount: () => void;
  onSubmit: () => void;
  onPrint: () => void;
  onAddTray: () => void;
  onSelectTray: (id: string | null) => void;
  onEditOrder: (order: ExistingOrder) => void;
  onCancelEdit: () => void;
  onPrintOrder: (orderId: number) => void;
}) {
  const { t } = useTranslation();
  const editing = Boolean(editingOrder);

  return (
    <aside className={`pos-cart ${open ? 'is-open' : ''}`}>
      <div className="pos-cart-head">
        <span>
          {editing
            ? t('pos.editingOrder', { id: orderDisplayNumber(editingOrder!) })
            : t('pos.cart')}
          {!editing && (
            <span className="ms-2 font-semibold tabular-nums text-graphite">({lines.length})</span>
          )}
        </span>
        <button type="button" className="pos-cart-tray-btn" onClick={onAddTray}>
          + {t('pos.addTray')}
        </button>
      </div>
      {activeTrayId && (
        <div className="pos-tray-hint">
          <span>{t('pos.trayAddHint')}</span>
          <button type="button" onClick={() => onSelectTray(null)}>
            {t('pos.trayExit')}
          </button>
        </div>
      )}
      {existingOrders.length > 0 && (
        <button type="button" className="pos-sheet-row text-[13px]" onClick={onToggleOrders}>
          {t('pos.existingOrders')} ({existingOrders.length})
        </button>
      )}
      {ordersExpanded && (
        <div className="pos-existing-list">
          {existingOrders.map((o) => {
            const tops = (o.items ?? []).filter((i) => i.parent_order_item_id == null);
            return (
              <div
                key={o.id}
                className={`pos-existing-card ${editingOrder?.id === o.id ? 'is-editing' : ''}`}
              >
                <div className="pos-existing-card-top">
                  <span>#{orderDisplayNumber(o)}</span>
                  <span className="tabular-nums">{Number(o.total).toFixed(0)}</span>
                </div>
                {tops.length > 0 && (
                  <ul className="pos-cart-children">
                    {tops.map((i) => (
                      <li key={i.id}>
                        {i.quantity}× {i.item_name}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="pos-existing-card-actions">
                  <button type="button" className="pos-primary" onClick={() => onEditOrder(o)}>
                    {t('pos.edit')}
                  </button>
                  <button type="button" className="pos-secondary" onClick={() => onPrintOrder(o.id)}>
                    {t('pos.print')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {lines.length === 0 ? (
        <div className="pos-cart-empty">{t('pos.cartEmpty')}</div>
      ) : (
        <div className="pos-cart-list">
          {lines.map((line) => (
            <PosCartLine
              key={line.cartLineId}
              line={line}
              active={line.cartLineId === activeTrayId}
              onInc={() => onInc(line)}
              onDec={() => onDec(line)}
              onSelect={
                line.lineKind === 'tray' && !line.trayLocked
                  ? () => onSelectTray(line.cartLineId)
                  : undefined
              }
            />
          ))}
        </div>
      )}
      <div className="pos-cart-foot">
        <div className="pos-cart-foot-row">
          <span>
            {t('pos.subtotal')}
            <span className="pos-cart-total"> {tableTotal.toFixed(0)}</span>
          </span>
          <button type="button" className="pos-cart-discount" onClick={onDiscount}>
            {t('pos.discount')}
          </button>
        </div>
        {submitHint && <div className="text-[13px] text-red-500">{submitHint}</div>}
        {editing && (
          <button type="button" className="pos-secondary" onClick={onCancelEdit}>
            {t('pos.cancel')}
          </button>
        )}
        <div className="pos-cart-actions">
          <button type="button" className="pos-primary" disabled={submitDisabled} onClick={onSubmit}>
            {editing ? t('pos.save') : t('pos.confirm')}
          </button>
          <button type="button" className="pos-secondary" disabled={printDisabled} onClick={onPrint}>
            {t('pos.print')}
          </button>
        </div>
      </div>
    </aside>
  );
}
