import { useTranslation } from 'react-i18next';
import type { Category } from '../../../hooks/useOrderModalTypes';

export const OFFERS_CATEGORY_ID = -1;
export const SHELF_CATEGORY_ID = -2;

export function PosCategoryRail({
  categories,
  selectedCategory,
  onSelect,
  hasOffers,
  hasShelves,
}: {
  categories: Category[];
  selectedCategory: number | null;
  onSelect: (id: number | null) => void;
  hasOffers: boolean;
  hasShelves: boolean;
}) {
  const { t } = useTranslation();
  return (
    <nav className="pos-rail" aria-label={t('pos.allMenu')}>
      <button
        type="button"
        className={`pos-cat-btn ${selectedCategory == null ? 'is-active' : ''}`}
        onClick={() => onSelect(null)}
      >
        <span className="line-clamp-2 text-[13px] font-semibold">{t('pos.allMenu')}</span>
      </button>
      {hasOffers && (
        <button
          type="button"
          className={`pos-cat-btn is-offers ${selectedCategory === OFFERS_CATEGORY_ID ? 'is-active' : ''}`}
          onClick={() => onSelect(OFFERS_CATEGORY_ID)}
        >
          <span className="line-clamp-2 text-[13px] font-semibold">{t('pos.offersMenu')}</span>
        </button>
      )}
      {hasShelves && (
        <button
          type="button"
          className={`pos-cat-btn is-shelf ${selectedCategory === SHELF_CATEGORY_ID ? 'is-active' : ''}`}
          onClick={() => onSelect(SHELF_CATEGORY_ID)}
        >
          <span className="line-clamp-2 text-[13px] font-semibold">{t('pos.shelvesMenu')}</span>
        </button>
      )}
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`pos-cat-btn ${selectedCategory === c.id ? 'is-active' : ''}`}
          onClick={() => onSelect(c.id)}
        >
          <span className="line-clamp-2 text-[13px] font-semibold">{c.name}</span>
        </button>
      ))}
    </nav>
  );
}
