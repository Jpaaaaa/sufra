import type { DatabaseService } from '../../database/database.service';

/**
 * Next shared daily ticket number across dine-in / pickup / delivery
 * for the given business_date. Resets when business_date changes.
 */
export async function allocateDailyDisplayNumber(
  db: DatabaseService,
  businessDate: string,
): Promise<number> {
  const date = (businessDate || '').trim();
  if (!date) {
    throw new Error('allocateDailyDisplayNumber: business_date is required');
  }

  const row = await db.get(
    `SELECT MAX(display_number) AS m FROM (
       SELECT display_number FROM dine_in_orders WHERE business_date = ?
       UNION ALL
       SELECT display_number FROM pickup_orders WHERE business_date = ?
       UNION ALL
       SELECT display_number FROM delivery_orders WHERE business_date = ?
     )`,
    [date, date, date],
  );

  const max = Number(row?.m ?? 0);
  return (Number.isFinite(max) ? max : 0) + 1;
}
