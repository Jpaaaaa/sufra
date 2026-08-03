import { BadRequestException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';
import type { ItemOption, ItemOptionGroup, ItemOptionPricingMode } from '../../types/item-options';

const PRICING_MODES: ItemOptionPricingMode[] = ['replace', 'inherit', 'add'];

function mapOptionRow(row: any): ItemOption {
  return {
    id: row.id,
    group_id: row.group_id,
    name: row.name,
    price: row.price,
    is_default: Boolean(row.is_default),
    is_out_of_stock: Boolean(row.is_out_of_stock),
    sort_order: row.sort_order,
  };
}

function mapGroupRow(row: any, options: ItemOption[]): ItemOptionGroup {
  return {
    id: row.id,
    item_id: row.item_id,
    name: row.name,
    pricing_mode: row.pricing_mode as ItemOptionPricingMode,
    min_select: row.min_select,
    max_select: row.max_select,
    sort_order: row.sort_order,
    options,
  };
}

class ItemOptionsService {
  constructor(private readonly db: DatabaseService) {}

  async getGroupsForItem(itemId: number): Promise<ItemOptionGroup[]> {
    const groupRows = await this.db.all(
      'SELECT * FROM item_option_groups WHERE item_id = ? ORDER BY sort_order ASC, id ASC',
      [itemId],
    );
    if (!groupRows.length) return [];

    const groupIds = groupRows.map((g: any) => g.id);
    const optionRows = await this.db.all(
      `SELECT * FROM item_options WHERE group_id IN (${groupIds.join(',')}) ORDER BY sort_order ASC, id ASC`,
    );

    return groupRows.map((g: any) => {
      const options = optionRows
        .filter((o: any) => o.group_id === g.id)
        .map(mapOptionRow);
      return mapGroupRow(g, options);
    });
  }

  async getGroupsForItems(itemIds: number[]): Promise<Map<number, ItemOptionGroup[]>> {
    const result = new Map<number, ItemOptionGroup[]>();
    if (!itemIds.length) return result;

    const uniqueIds = [...new Set(itemIds)];
    const groupRows = await this.db.all(
      `SELECT * FROM item_option_groups WHERE item_id IN (${uniqueIds.join(',')}) ORDER BY sort_order ASC, id ASC`,
    );
    if (!groupRows.length) {
      for (const id of uniqueIds) result.set(id, []);
      return result;
    }

    const groupIds = groupRows.map((g: any) => g.id);
    const optionRows = await this.db.all(
      `SELECT * FROM item_options WHERE group_id IN (${groupIds.join(',')}) ORDER BY sort_order ASC, id ASC`,
    );

    for (const id of uniqueIds) {
      const groups = groupRows
        .filter((g: any) => g.item_id === id)
        .map((g: any) => {
          const options = optionRows
            .filter((o: any) => o.group_id === g.id)
            .map(mapOptionRow);
          return mapGroupRow(g, options);
        });
      result.set(id, groups);
    }
    return result;
  }

  private validateGroups(groups: ItemOptionGroup[]): void {
    for (const group of groups) {
      if (!group.name?.trim()) {
        throw new BadRequestException('اسم مجموعة الخيارات مطلوب');
      }
      if (!PRICING_MODES.includes(group.pricing_mode)) {
        throw new BadRequestException('نوع التسعير غير صالح');
      }
      if (group.min_select < 0 || group.max_select < group.min_select) {
        throw new BadRequestException('حدود الاختيار غير صالحة');
      }
      if (!group.options?.length) {
        throw new BadRequestException(`مجموعة "${group.name}" تحتاج خياراً واحداً على الأقل`);
      }

      for (const opt of group.options) {
        if (!opt.name?.trim()) {
          throw new BadRequestException('اسم الخيار مطلوب');
        }
        if (group.pricing_mode === 'replace' && opt.price <= 0) {
          throw new BadRequestException(`سعر الخيار "${opt.name}" مطلوب`);
        }
        if (group.pricing_mode === 'inherit') {
          opt.price = 0;
        }
      }

      if (group.max_select === 1 && group.min_select >= 1) {
        const defaults = group.options.filter((o) => o.is_default);
        if (defaults.length === 0) {
          group.options[0].is_default = true;
        } else if (defaults.length > 1) {
          let found = false;
          for (const o of group.options) {
            if (o.is_default && !found) {
              found = true;
            } else {
              o.is_default = false;
            }
          }
        }
      }
    }
  }

  async saveGroupsForItem(itemId: number, groups: ItemOptionGroup[]): Promise<ItemOptionGroup[]> {
    this.validateGroups(groups);

    const existingGroups = await this.db.all(
      'SELECT id FROM item_option_groups WHERE item_id = ?',
      [itemId],
    );
    for (const g of existingGroups) {
      await this.db.run('DELETE FROM item_options WHERE group_id = ?', [g.id]);
    }
    await this.db.run('DELETE FROM item_option_groups WHERE item_id = ?', [itemId]);

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const groupId = await this.db.runInsert(
        `INSERT INTO item_option_groups (item_id, name, pricing_mode, min_select, max_select, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          group.name.trim(),
          group.pricing_mode,
          group.min_select,
          group.max_select,
          group.sort_order ?? gi,
        ],
      );

      for (let oi = 0; oi < group.options.length; oi++) {
        const opt = group.options[oi];
        const price = group.pricing_mode === 'inherit' ? 0 : opt.price;
        await this.db.run(
          `INSERT INTO item_options (group_id, name, price, is_default, is_out_of_stock, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            groupId,
            opt.name.trim(),
            price,
            opt.is_default ? 1 : 0,
            opt.is_out_of_stock ? 1 : 0,
            opt.sort_order ?? oi,
          ],
        );
      }
    }

    const hasOptions = groups.length > 0 ? 1 : 0;
    await this.db.run('UPDATE items SET has_options = ? WHERE id = ?', [hasOptions, itemId]);

    return this.getGroupsForItem(itemId);
  }

  async copyGroupsFromItem(sourceItemId: number, targetItemId: number): Promise<ItemOptionGroup[]> {
    const sourceGroups = await this.getGroupsForItem(sourceItemId);
    const cloned: ItemOptionGroup[] = sourceGroups.map((g) => ({
      name: g.name,
      pricing_mode: g.pricing_mode,
      min_select: g.min_select,
      max_select: g.max_select,
      sort_order: g.sort_order,
      options: g.options.map((o) => ({
        name: o.name,
        price: o.price,
        is_default: o.is_default,
        is_out_of_stock: o.is_out_of_stock,
        sort_order: o.sort_order,
      })),
    }));
    return this.saveGroupsForItem(targetItemId, cloned);
  }
}

let itemOptionsInstance: ItemOptionsService | null = null;

export function initializeItemOptions(db: DatabaseService): void {
  itemOptionsInstance = new ItemOptionsService(db);
}

function requireItemOptions(): ItemOptionsService {
  if (!itemOptionsInstance) {
    throw new Error('Item options not initialized');
  }
  return itemOptionsInstance;
}

export function getGroupsForItem(
  ...args: Parameters<ItemOptionsService['getGroupsForItem']>
): ReturnType<ItemOptionsService['getGroupsForItem']> {
  return requireItemOptions().getGroupsForItem(...args);
}

export function getGroupsForItems(
  ...args: Parameters<ItemOptionsService['getGroupsForItems']>
): ReturnType<ItemOptionsService['getGroupsForItems']> {
  return requireItemOptions().getGroupsForItems(...args);
}

export function saveGroupsForItem(
  ...args: Parameters<ItemOptionsService['saveGroupsForItem']>
): ReturnType<ItemOptionsService['saveGroupsForItem']> {
  return requireItemOptions().saveGroupsForItem(...args);
}

export function copyGroupsFromItem(
  ...args: Parameters<ItemOptionsService['copyGroupsFromItem']>
): ReturnType<ItemOptionsService['copyGroupsFromItem']> {
  return requireItemOptions().copyGroupsFromItem(...args);
}
