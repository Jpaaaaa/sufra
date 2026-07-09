export class CreateCashFlowDto {
  business_day_id?: number | null;
  date?: string | null;
  type!: 'in' | 'out';
  reason!: string;
  amount!: number;
  linked_order_id?: number | null;
}
