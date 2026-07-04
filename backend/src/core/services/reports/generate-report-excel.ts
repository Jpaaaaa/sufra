import * as XLSX from 'xlsx';
import { ExportPdfDto } from '../../types/reports/export-pdf.dto';

export function generateReportExcel(dto: ExportPdfDto): Buffer {
  const { type, date, data } = dto;
  const periodLabels = {
    daily: 'يومي',
    weekly: 'أسبوعي',
    monthly: 'شهري',
    yearly: 'سنوي',
  };

  const periodLabel = periodLabels[type];
  const workbook = XLSX.utils.book_new();

  // Summary Sheet - Use safe number formatting
  const summaryData = [
    ['التقارير المالية', ''],
    ['نوع التقرير', periodLabel],
    ['التاريخ', date],
    [''],
    ['إجمالي المبيعات', Number(data.summary?.totalSales || 0)],
    ['عدد الطلبات', Number(data.summary?.orderCount || 0)],
    ['متوسط قيمة الطلب', Number(data.summary?.averageOrder || 0)],
    ['الخصومات', Number(data.summary?.discounts || 0)],
    ['الإلغاءات', Number(data.summary?.cancellations || 0)],
  ];

  if (data.summary?.netProfit !== undefined) {
    summaryData.push(['صافي الربح', Number(data.summary.netProfit || 0)]);
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'الملخص');

  // Items Performance Sheet - Use safe number formatting
  const itemsHeaders = [['اسم الصنف', 'عدد المرات', 'إجمالي المبيعات', 'الحركة']];
  const itemsRows = (data.items || []).map((item: any) => {
    const movementLabels: Record<string, string> = {
      high: 'عالي',
      medium: 'متوسط',
      low: 'منخفض',
    };
    return [
      item?.name || '-',
      Number(item?.quantitySold || 0),
      Number(item?.totalSales || 0),
      movementLabels[item?.movementStatus] || 'منخفض'
    ];
  });
  const itemsData = [...itemsHeaders, ...itemsRows];
  const itemsSheet = XLSX.utils.aoa_to_sheet(itemsData);
  XLSX.utils.book_append_sheet(workbook, itemsSheet, 'أداء الأصناف');

  // Employees Sheet - Use safe number formatting
  const employeesHeaders = [
    ['الموظف', 'عدد الطلبات', 'إجمالي المبيعات', 'الإلغاءات', 'متوسط الطلب'],
  ];
  const employeesRows = (data.employees || []).map((emp: any) => [
    emp?.name || 'N/A',
    Number(emp?.ordersHandled || 0),
    Number(emp?.totalSales || 0),
    Number(emp?.cancellations || 0),
    Number(emp?.avgOrderValue || 0),
  ]);
  const employeesData = [...employeesHeaders, ...employeesRows];
  const employeesSheet = XLSX.utils.aoa_to_sheet(employeesData);
  XLSX.utils.book_append_sheet(workbook, employeesSheet, 'أداء الموظفين');

  // Orders Sheet - Now uses DailyAggregate structure
  // For daily/weekly reports, orders are DailyAggregate objects
  const ordersHeaders = [
    ['اليوم', 'التاريخ', 'عدد الطلبات', 'إجمالي المبيعات', 'متوسط الطلب', 'الخصومات', 'صافي الربح'],
  ];
  const ordersRows = data.orders.map((order: any) => {
    // Handle DailyAggregate structure (id, date, day, totalSales, totalDiscounts, netProfit, orderCount, averageOrder)
    return [
      order.day || order.date || '-',
      order.date || '-',
      Number(order.orderCount || 0),
      Number(order.totalSales || 0),
      Number(order.averageOrder || 0),
      Number(order.totalDiscounts || 0),
      Number(order.netProfit || 0),
    ];
  });
  const ordersData = [...ordersHeaders, ...ordersRows];
  const ordersSheet = XLSX.utils.aoa_to_sheet(ordersData);
  XLSX.utils.book_append_sheet(workbook, ordersSheet, type === 'daily' ? 'ملخص اليوم' : type === 'weekly' ? 'ملخص الأيام' : 'الطلبات');

  // Cash Drawer Sheet (Daily only) - Use safe number formatting
  if (type === 'daily' && data.drawer) {
    const openingBalance = Number(data.drawer?.openingBalance || 0);
    const cashIn = Number(data.drawer?.cashIn || 0);
    const cashOut = Number(data.drawer?.cashOut || 0);
    const closingBalance = Number(data.drawer?.closingBalance || 0);
    const variance = Number(data.drawer?.variance || 0);
    
    const drawerData = [
      ['تقرير الصندوق', ''],
      ['الرصيد الافتتاحي', openingBalance],
      ['النقد الوارد', cashIn],
      ['النقد الصادر', cashOut],
      ['الرصيد المتوقع', openingBalance + cashIn - cashOut],
      ['الرصيد الفعلي', closingBalance],
      ['الفرق', variance],
    ];
    const drawerSheet = XLSX.utils.aoa_to_sheet(drawerData);
    XLSX.utils.book_append_sheet(workbook, drawerSheet, 'الصندوق');
  }

  // Generate buffer
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(excelBuffer);
}

