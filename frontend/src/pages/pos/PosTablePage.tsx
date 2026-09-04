import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { itemHasOptionGroups } from '../../lib/item-options';
import type { Item } from '../../hooks/useItems';
import { isComboMenuItem } from '../../hooks/cart-item-utils';
import type { SelectedItemOptions } from '../../lib/item-options';
import { PosCart } from './components/PosCart';
import { PosCategoryRail } from './components/PosCategoryRail';
import { PosDiscountSheet } from './components/PosDiscountSheet';
import { PosItemDetailSheet } from './components/PosItemDetailSheet';
import { PosItemGrid } from './components/PosItemGrid';
import { PosOptionsSheet } from './components/PosOptionsSheet';
import { PosTopBar } from './components/PosTopBar';
import { usePosTableOrder } from './usePosTableOrder';
import { useHallsStore } from '../../../stores/hallsStore';
import { useTablesStore } from '../../../stores/tablesStore';
import type { Hall, TableEntity } from '../../utils';

export default function PosTablePage() {
  const { hallId, tableId } = useParams();
  const [session, setSession] = useState(0);
  const onReload = useCallback(() => setSession((n) => n + 1), []);
  const hid = Number(hallId);
  const tid = Number(tableId);
  const halls = useHallsStore((s) => s.halls);
  const tablesByHallId = useTablesStore((s) => s.tablesByHallId);
  const hall = halls.find((h) => h.id === hid) ?? null;
  const table: TableEntity | undefined = (tablesByHallId[hid] || []).find((tb) => tb.id === tid);

  useEffect(() => {
    if (!hall) void useHallsStore.getState().loadHalls();
    if (Number.isFinite(hid) && !table) void useTablesStore.getState().loadTablesForHall(hid);
  }, [hall, hid, table]);

  if (!table || !Number.isFinite(tid)) {
    return <PosTableMissing />;
  }

  return <PosTableInner key={`${tid}-${session}`} table={table} hall={hall} onReload={onReload} />;
}

function PosTableMissing() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <>
      <PosTopBar title={t('pos.table')} showBrandText={false} onBack={() => navigate('/pos/floor')} />
      <div className="pos-content text-[13px]">{t('pos.tableMissing')}</div>
    </>
  );
}

function PosTableInner({
  table,
  hall,
  onReload,
}: {
  table: TableEntity;
  hall: Hall | null;
  onReload: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const order = usePosTableOrder(table, hall, onReload);
  const [cartOpen, setCartOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [optionItem, setOptionItem] = useState<Item | null>(null);
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  const [undoVisible, setUndoVisible] = useState(false);

  useEffect(() => {
    const st = location.state as { print?: boolean; discount?: boolean } | null;
    if (st?.print) void order.handlePrintAllKitchen();
    if (st?.discount) setDiscountOpen(true);
  }, []);

  const offline = order.connection === 'offline' || order.connection === 'reconnecting';

  const kitchenColorOf = useMemo(() => {
    const colors = ['#2EE7C9', '#f59e0b', '#6366f1', '#ec4899', '#10b981'];
    return (item: Item) => {
      const id = item.kitchen_id ?? 0;
      return colors[id % colors.length];
    };
  }, []);

  const onPick = (item: Item) => {
    if (item.is_out_of_stock) return;
    if (isComboMenuItem(item) || (item._comboProducts && item._comboProducts.length > 0)) {
      setDetailItem(item);
      return;
    }
    const shelf = (item as Item & { _shelfItem?: unknown })._shelfItem;
    if (itemHasOptionGroups(item)) {
      setOptionItem(item);
      return;
    }
    if (shelf) {
      order.addItemToOrder(item, { shelfItem: shelf as never });
      return;
    }
    order.addItemToOrder(item);
  };

  const addFromDetail = (item: Item) => {
    if (item.is_out_of_stock) return;
    const shelf = (item as Item & { _shelfItem?: unknown })._shelfItem;
    if (itemHasOptionGroups(item) && !isComboMenuItem(item)) {
      setDetailItem(null);
      setOptionItem(item);
      return;
    }
    if (shelf) {
      order.addItemToOrder(item, { shelfItem: shelf as never });
    } else {
      order.addItemToOrder(item);
    }
    setDetailItem(null);
  };

  const onConfirmOptions = (selected: SelectedItemOptions) => {
    if (optionItem) order.addItemToOrder(optionItem, { selectedOptions: selected });
    setOptionItem(null);
  };

  const submit = async () => {
    if (order.editingOrder) {
      await order.handleSaveEditedOrder();
      return;
    }
    const id = await order.handleSubmitOrder();
    if (id) {
      order.setUndoOrderId(id);
      setUndoVisible(true);
      window.setTimeout(() => setUndoVisible(false), 3000);
    }
  };

  return (
    <>
      <PosTopBar
        title={`${t('pos.table')} ${table.number}`}
        showBrandText={false}
        onBack={() => navigate('/pos/floor')}
        extra={
          <input
            className="pos-search-bar"
            value={order.searchQuery}
            onChange={(e) => order.setSearchQuery(e.target.value)}
            placeholder={t('pos.search')}
          />
        }
      />
      {order.conflict && (
        <div className="pos-banner mx-2 mt-2">
          <span>{t('pos.remoteUpdate')}</span>
          <button type="button" className="pos-topbar-btn" onClick={onReload}>
            {t('pos.reload')}
          </button>
        </div>
      )}
      <div className="pos-body">
        <PosCategoryRail
          categories={order.categories}
          selectedCategory={order.selectedCategory}
          onSelect={order.setSelectedCategory}
          hasOffers
          hasShelves
        />
        <div className="pos-content">
          <PosItemGrid
            items={order.items}
            kitchenColorOf={kitchenColorOf}
            onPick={onPick}
            onInspect={setDetailItem}
          />
        </div>
        <PosCart
          open={cartOpen}
          existingOrders={order.existingOrders}
          ordersExpanded={order.ordersExpanded}
          onToggleOrders={() => order.setOrdersExpanded(!order.ordersExpanded)}
          lines={order.selectedItems}
          tableTotal={order.tableTotal + order.subtotal}
          submitDisabled={offline || order.selectedItems.length === 0}
          printDisabled={offline || order.existingOrders.length === 0}
          submitHint={offline ? t('pos.offlineSubmit') : undefined}
          onInc={(line) => order.updateQuantity(line.cartLineId, line.quantity + 1)}
          onDec={(line) => order.updateQuantity(line.cartLineId, line.quantity - 1)}
          onDiscount={() => setDiscountOpen(true)}
          onSubmit={() => void submit()}
          onPrint={() => void order.handlePrintAllKitchen()}
          activeTrayId={order.activeTrayId}
          onAddTray={order.addTrayToOrder}
          onSelectTray={order.selectTray}
          editingOrder={order.editingOrder}
          onEditOrder={(o) => {
            order.handleEditOrder(o);
            order.setOrdersExpanded(true);
          }}
          onCancelEdit={order.handleCancelEdit}
          onPrintOrder={(id) => void order.handlePrintOrder(id)}
        />
      </div>
      <button type="button" className="pos-cart-toggle" onClick={() => setCartOpen((v) => !v)}>
        <span>{t('pos.total')}</span>
        <span className="tabular-nums font-bold">{(order.tableTotal + order.subtotal).toFixed(0)}</span>
      </button>
      <PosDiscountSheet
        open={discountOpen}
        onClose={() => setDiscountOpen(false)}
        tableSubtotal={order.tableSubtotal + order.subtotal}
        onApply={(amount) => {
          void order.handleApplyDiscount(amount);
          setDiscountOpen(false);
        }}
      />
      <PosOptionsSheet
        key={optionItem?.id ?? 'none'}
        open={Boolean(optionItem)}
        item={optionItem}
        onClose={() => setOptionItem(null)}
        onConfirm={onConfirmOptions}
      />
      <PosItemDetailSheet
        item={detailItem}
        onClose={() => setDetailItem(null)}
        onAdd={addFromDetail}
      />
      {undoVisible && order.undoOrderId != null && (
        <div className="pos-undo">
          <span>{t('pos.sent')}</span>
          <button
            type="button"
            onClick={() => {
              void order.handleCancelOrder(order.undoOrderId!, { skipConfirm: true });
              setUndoVisible(false);
            }}
          >
            {t('pos.undo')}
          </button>
        </div>
      )}
    </>
  );
}
