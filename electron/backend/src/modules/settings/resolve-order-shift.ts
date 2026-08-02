import { getLocalNowString } from '../../utils/business-date';
import { resolveOrderShift } from '../../utils/shift-window';
import { getShiftConfig } from './settings.service';
import { getShiftDefinitions } from './shift-definitions.service';

export interface OrderShiftFields {
  business_date: string;
  shift_definition_id: number | null;
}

export async function resolveOrderShiftFields(createdAt?: string): Promise<OrderShiftFields> {
  const at = createdAt || getLocalNowString();
  const config = await getShiftConfig();
  const definitions =
    config.shift_mode === 'multi' ? await getShiftDefinitions(true) : [];

  return resolveOrderShift(
    at,
    config.shift_mode,
    config.business_day_start_time,
    definitions,
  );
}

export async function getCurrentBusinessDateFromSettings(): Promise<string> {
  const fields = await resolveOrderShiftFields();
  return fields.business_date;
}
