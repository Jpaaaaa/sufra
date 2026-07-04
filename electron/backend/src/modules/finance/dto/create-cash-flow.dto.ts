export class CreateCashFlowDto {
  business_day_id?: number | null;
  date?: string | null; // Optional - for display/legacy purposes
  type!: 'in' | 'out';
  reason!: string;
  amount!: number;
  linked_order_id?: number | null;
}

