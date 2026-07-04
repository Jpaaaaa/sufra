export class UpdateExpenseDto {
  business_day_id?: number | null;
  date?: string | null;
  category?: string;
  amount?: number;
  notes?: string | null;
  user_id?: number | null;
  is_recurring?: boolean;
  recurrence_type?: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  recurrence_interval?: number | null;
  next_occurrence_date?: string | null;
}

