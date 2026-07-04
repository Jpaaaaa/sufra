export class CreateRevenueDto {
  business_day_id?: number | null;
  date?: string | null; // Optional - for display/legacy purposes
  type!: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'extra';
  amount!: number;
  notes?: string | null;
}

