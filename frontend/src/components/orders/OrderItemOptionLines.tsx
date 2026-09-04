import { memo } from 'react';
import { formatOrderItemBaseName, formatOrderOptionSubLines } from '../../lib/item-options';

interface OrderItemOptionLinesProps {
  itemName: string;
  options_json?: unknown[] | string | null;
  nameClassName?: string;
  subLineClassName?: string;
  quantity?: number;
}

export const OrderItemOptionLines = memo(function OrderItemOptionLines({
  itemName,
  options_json,
  nameClassName = '',
  subLineClassName = 'text-[12px] text-obsidian/60 ps-2',
  quantity,
}: OrderItemOptionLinesProps) {
  const subLines = formatOrderOptionSubLines(options_json);
  const displayName = formatOrderItemBaseName(itemName, options_json);
  const qtySuffix = quantity != null ? ` ×${quantity}` : '';

  return (
    <div className="min-w-0 flex-1">
      <div className={nameClassName}>
        {displayName}
        {qtySuffix}
      </div>
      {subLines.map((line, idx) => (
        <div key={idx} className={subLineClassName}>
          {line}
        </div>
      ))}
    </div>
  );
});
