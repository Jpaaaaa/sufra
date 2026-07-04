import * as XLSX from 'xlsx';
import { ExportFinanceDto } from './dto/export-finance.dto';

export function generateFinanceExcel(dto: ExportFinanceDto): Buffer {
  const { type, from, to, data } = dto;
  const periodLabels = {
    daily: 'يومي',
    weekly: 'أسبوعي',
    monthly: 'شهري',
    yearly: 'سنوي',
  };

  const periodLabel = periodLabels[type];
  const workbook = XLSX.utils.book_new();

  // Profit & Loss Summary Sheet
  const profitData = [
    ['التقارير المالية', ''],
    ['نوع التقرير', periodLabel],
    ['من تاريخ', from],
    ['إلى تاريخ', to],
    [''],
    ['إجمالي الإيرادات', data.profit.totalRevenue],
    ['إجمالي المصروفات', data.profit.totalExpenses],
    ['صافي الربح', data.profit.netProfit],
  ];

  const profitSheet = XLSX.utils.aoa_to_sheet(profitData);
  XLSX.utils.book_append_sheet(workbook, profitSheet, 'الربح والخسارة');

  // Revenues Sheet
  const revenuesHeaders = [['التاريخ', 'الإيراد', 'عدد الطلبات', 'الملاحظات']];
  const revenuesRows = data.revenues.map((rev) => [
    rev.date,
    rev.amount,
    rev.order_count != null && rev.order_count !== undefined ? rev.order_count : '',
    rev.notes || '',
  ]);
  const revenuesData = [...revenuesHeaders, ...revenuesRows];
  const revenuesSheet = XLSX.utils.aoa_to_sheet(revenuesData);
  XLSX.utils.book_append_sheet(workbook, revenuesSheet, 'الإيرادات');

  // Expenses Sheet
  const expensesHeaders = [['التاريخ', 'الفئة', 'المبلغ', 'الملاحظات', 'معرف المستخدم']];
  const expensesRows = data.expenses.map((exp) => [
    exp.date,
    exp.category,
    exp.amount,
    exp.notes || '',
    exp.user_id || '',
  ]);
  const expensesData = [...expensesHeaders, ...expensesRows];
  const expensesSheet = XLSX.utils.aoa_to_sheet(expensesData);
  XLSX.utils.book_append_sheet(workbook, expensesSheet, 'المصروفات');

  // Cash Flow Sheet
  const cashFlowHeaders = [['التاريخ', 'النوع', 'السبب', 'المبلغ', 'معرف الطلب']];
  const cashFlowRows = data.cashFlow.map((cf) => [
    cf.date,
    cf.type === 'in' ? 'داخل' : 'خارج',
    cf.reason,
    cf.amount,
    cf.linked_order_id || '',
  ]);
  const cashFlowData = [...cashFlowHeaders, ...cashFlowRows];
  const cashFlowSheet = XLSX.utils.aoa_to_sheet(cashFlowData);
  XLSX.utils.book_append_sheet(workbook, cashFlowSheet, 'التدفق النقدي');

  // Generate buffer
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(excelBuffer);
}

