import type { Item } from '../../../hooks/useItems';
import { PosItemCard } from './PosItemCard';

export function PosItemGrid({
  items,
  kitchenColorOf,
  onPick,
  onInspect,
}: {
  items: Item[];
  kitchenColorOf: (item: Item) => string | undefined;
  onPick: (item: Item) => void;
  onInspect: (item: Item) => void;
}) {
  return (
    <div className="pos-items">
      {items.map((item) => (
        <PosItemCard
          key={item.id}
          item={item}
          kitchenColor={kitchenColorOf(item)}
          onTap={() => {
            if (item.is_out_of_stock) return;
            onPick(item);
          }}
          onLongPress={() => onInspect(item)}
        />
      ))}
    </div>
  );
}
