import { BadRequestException, NotFoundException } from '../../utils/exceptions';
import { DatabaseService } from '../../database/database.service';
import { isValidHHmm } from '../../utils/business-date';
import { timeToMinutes, isInShiftWindow } from '../../utils/shift-window';

export interface ShiftDefinition {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  is_active: boolean;
}

class ShiftDefinitionsService {
  constructor(private readonly db: DatabaseService) {}

  private rowToDef(row: any): ShiftDefinition {
    return {
      id: row.id,
      name: row.name,
      start_time: row.start_time,
      end_time: row.end_time,
      sort_order: row.sort_order ?? 0,
      is_active: Boolean(row.is_active),
    };
  }

  async findAll(activeOnly = false): Promise<ShiftDefinition[]> {
    const query = activeOnly
      ? `SELECT id, name, start_time, end_time, sort_order, is_active
         FROM shift_definitions WHERE is_active = 1 ORDER BY sort_order ASC, id ASC`
      : `SELECT id, name, start_time, end_time, sort_order, is_active
         FROM shift_definitions ORDER BY sort_order ASC, id ASC`;
    const rows = await this.db.all(query);
    return (rows || []).map((r: any) => this.rowToDef(r));
  }

  private validateTimes(start: string, end: string): void {
    if (!isValidHHmm(start) || !isValidHHmm(end)) {
      throw new BadRequestException('أوقات الوردية غير صالحة (HH:mm)');
    }
    if (start === end) {
      throw new BadRequestException('وقت البداية والنهاية يجب أن يكونا مختلفين');
    }
  }

  private shiftsOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
    const sA = timeToMinutes(startA);
    const eA = timeToMinutes(endA);
    const sB = timeToMinutes(startB);
    const eB = timeToMinutes(endB);
    for (let m = 0; m < 1440; m += 15) {
      if (isInShiftWindow(m, sA, eA) && isInShiftWindow(m, sB, eB)) return true;
    }
    return false;
  }

  private assertBatchNoOverlaps(
    shifts: Array<{ name: string; start_time: string; end_time: string }>,
  ): void {
    for (let i = 0; i < shifts.length; i++) {
      for (let j = i + 1; j < shifts.length; j++) {
        if (this.shiftsOverlap(shifts[i].start_time, shifts[i].end_time, shifts[j].start_time, shifts[j].end_time)) {
          throw new BadRequestException(
            `تداخل بين "${shifts[i].name}" و "${shifts[j].name}"`,
          );
        }
      }
    }
  }

  private async assertNoOverlap(
    start: string,
    end: string,
    excludeId?: number,
  ): Promise<void> {
    const defs = await this.findAll(false);

    for (const def of defs) {
      if (excludeId != null && def.id === excludeId) continue;
      if (!def.is_active) continue;
      if (this.shiftsOverlap(start, end, def.start_time, def.end_time)) {
        throw new BadRequestException(`تداخل مع وردية "${def.name}"`);
      }
    }
  }

  async create(data: {
    name: string;
    start_time: string;
    end_time: string;
    sort_order?: number;
  }): Promise<ShiftDefinition> {
    const name = data.name?.trim();
    const start = data.start_time?.trim();
    const end = data.end_time?.trim();
    if (!name) throw new BadRequestException('اسم الوردية مطلوب');

    this.validateTimes(start, end);
    await this.assertNoOverlap(start, end);

    await this.db.run(
      `INSERT INTO shift_definitions (name, start_time, end_time, sort_order, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [name, start, end, data.sort_order ?? 0],
    );
    const id = await this.db.getLastInsertRowId();
    const row = await this.db.get('SELECT * FROM shift_definitions WHERE id = ?', [id]);
    if (!row) throw new Error('Failed to create shift definition');
    return this.rowToDef(row);
  }

  async update(
    id: number,
    data: { name?: string; start_time?: string; end_time?: string; sort_order?: number; is_active?: boolean },
  ): Promise<ShiftDefinition> {
    const existing = await this.db.get('SELECT * FROM shift_definitions WHERE id = ?', [id]);
    if (!existing) throw new NotFoundException('الوردية غير موجودة');

    const name = data.name?.trim() ?? existing.name;
    const start = data.start_time?.trim() ?? existing.start_time;
    const end = data.end_time?.trim() ?? existing.end_time;
    const sortOrder = data.sort_order ?? existing.sort_order;
    const isActive = data.is_active !== undefined ? (data.is_active ? 1 : 0) : existing.is_active;

    this.validateTimes(start, end);
    if (isActive) await this.assertNoOverlap(start, end, id);

    await this.db.run(
      `UPDATE shift_definitions SET name = ?, start_time = ?, end_time = ?, sort_order = ?, is_active = ? WHERE id = ?`,
      [name, start, end, sortOrder, isActive, id],
    );
    const row = await this.db.get('SELECT * FROM shift_definitions WHERE id = ?', [id]);
    return this.rowToDef(row);
  }

  async remove(id: number): Promise<void> {
    const existing = await this.db.get('SELECT id FROM shift_definitions WHERE id = ?', [id]);
    if (!existing) throw new NotFoundException('الوردية غير موجودة');
    await this.db.run('DELETE FROM shift_definitions WHERE id = ?', [id]);
  }

  async replaceAll(
    shifts: Array<{ id?: number; name: string; start_time: string; end_time: string; sort_order?: number }>,
  ): Promise<ShiftDefinition[]> {
    const normalized = shifts.map((s, index) => {
      const name = s.name?.trim();
      const start = s.start_time?.trim();
      const end = s.end_time?.trim();
      if (!name) throw new BadRequestException('اسم الوردية مطلوب');
      this.validateTimes(start, end);
      return { id: s.id, name, start_time: start, end_time: end, sort_order: s.sort_order ?? index };
    });

    this.assertBatchNoOverlaps(normalized);

    const existing = await this.findAll(false);
    const existingIds = new Set(existing.map((d) => d.id));
    const payloadIds = new Set(
      normalized.map((s) => s.id).filter((id): id is number => id != null),
    );

    for (const id of payloadIds) {
      if (!existingIds.has(id)) {
        throw new BadRequestException(`الوردية ${id} غير موجودة`);
      }
    }

    await this.db.run('BEGIN TRANSACTION');
    try {
      for (const shift of normalized) {
        if (shift.id != null) {
          await this.db.run(
            `UPDATE shift_definitions SET name = ?, start_time = ?, end_time = ?, sort_order = ?, is_active = 1 WHERE id = ?`,
            [shift.name, shift.start_time, shift.end_time, shift.sort_order, shift.id],
          );
        } else {
          await this.db.run(
            `INSERT INTO shift_definitions (name, start_time, end_time, sort_order, is_active)
             VALUES (?, ?, ?, ?, 1)`,
            [shift.name, shift.start_time, shift.end_time, shift.sort_order],
          );
        }
      }

      for (const def of existing) {
        if (!payloadIds.has(def.id)) {
          await this.db.run('DELETE FROM shift_definitions WHERE id = ?', [def.id]);
        }
      }

      await this.db.run('COMMIT');
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }

    return this.findAll(false);
  }
}

let instance: ShiftDefinitionsService | null = null;

export function initializeShiftDefinitions(db: DatabaseService): void {
  instance = new ShiftDefinitionsService(db);
}

function requireShiftDefinitions(): ShiftDefinitionsService {
  if (!instance) throw new Error('Shift definitions not initialized');
  return instance;
}

export function getShiftDefinitions(activeOnly?: boolean) {
  return requireShiftDefinitions().findAll(activeOnly);
}

export function createShiftDefinition(...args: Parameters<ShiftDefinitionsService['create']>) {
  return requireShiftDefinitions().create(...args);
}

export function updateShiftDefinition(...args: Parameters<ShiftDefinitionsService['update']>) {
  return requireShiftDefinitions().update(...args);
}

export function removeShiftDefinition(...args: Parameters<ShiftDefinitionsService['remove']>) {
  return requireShiftDefinitions().remove(...args);
}

export function replaceShiftDefinitions(...args: Parameters<ShiftDefinitionsService['replaceAll']>) {
  return requireShiftDefinitions().replaceAll(...args);
}
