export class CreateRevenueDto {
  business_day_id?: number | null;
  date?: string | null;
  type!: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'extra';
  amount!: number;
  notes?: string | null;
}
