import { ExportFinanceDto } from './dto/export-finance.dto';

export function generateFinanceTemplate(dto: ExportFinanceDto): string {
  const { type, from, to, data } = dto;
  const periodLabels = {
    daily: 'يومي',
    weekly: 'أسبوعي',
    monthly: 'شهري',
    yearly: 'سنوي',
  };

  const periodLabel = periodLabels[type];
  const formattedFrom = new Date(from).toLocaleDateString('ar-IQ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTo = new Date(to).toLocaleDateString('ar-IQ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const printedAt = new Date().toLocaleString('ar-IQ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('ar-IQ', {
      style: 'currency',
      currency: 'IQD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-IQ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getCashFlowTypeLabel = (type: string): string => {
    return type === 'in' ? 'داخل' : 'خارج';
  };

  const categories: Record<string, string> = {
    Salaries: 'الرواتب',
    Rent: 'الإيجار',
    Electricity: 'الكهرباء',
    Water: 'المياه',
    Internet: 'الإنترنت',
    Ingredients: 'المكونات',
    Packaging: 'التعبئة',
    'Cleaning supplies': 'مواد التنظيف',
    Maintenance: 'الصيانة',
    Marketing: 'التسويق',
    Other: 'أخرى',
  };

  const getCategoryLabel = (category: string): string => {
    return categories[category] || category;
  };

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>التقارير المالية - ${periodLabel}</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;900&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Tajawal', sans-serif;
      direction: rtl;
      color: #222;
      background: #fff;
      font-size: 13px;
      line-height: 1.6;
      padding: 20px;
    }

    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #E0E0E0;
    }

    .header h1 {
      font-size: 28px;
      font-weight: 900;
      color: #000;
      margin-bottom: 8px;
    }

    .header h2 {
      font-size: 18px;
      font-weight: 700;
      color: #444;
      margin-bottom: 12px;
    }

    .header .meta {
      font-size: 12px;
      color: #666;
      margin-top: 8px;
    }

    .profit-section {
      background: #F7F7F7;
      border: 1px solid #DDDDDD;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
    }

    .profit-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }

    .profit-card {
      background: #fff;
      border: 1px solid #E0E0E0;
      border-radius: 6px;
      padding: 15px;
      text-align: center;
    }

    .profit-card-label {
      font-size: 12px;
      color: #666;
      margin-bottom: 8px;
      font-weight: 500;
    }

    .profit-card-value {
      font-size: 20px;
      font-weight: 700;
      color: #000;
    }

    .profit-positive {
      color: #155724;
    }

    .profit-negative {
      color: #721C24;
    }

    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: #000;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #E0E0E0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      page-break-inside: auto;
      background: #fff;
    }

    thead {
      background: #F4F4F4;
    }

    th {
      padding: 12px 8px;
      text-align: right;
      font-weight: 700;
      font-size: 12px;
      color: #000;
      border: 1px solid #E0E0E0;
      border-bottom: 2px solid #DDD;
    }

    td {
      padding: 10px 8px;
      text-align: right;
      font-size: 12px;
      color: #222;
      border: 1px solid #E0E0E0;
      background: #fff;
    }

    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }

    tbody tr:nth-child(even) {
      background: #FAFAFA;
    }

    .cash-flow-in {
      color: #155724;
      font-weight: 600;
    }

    .cash-flow-out {
      color: #721C24;
      font-weight: 600;
    }

    @media print {
      body {
        padding: 0;
      }
      
      .section {
        page-break-inside: avoid;
      }

      table {
        page-break-inside: auto;
      }

      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <h1>التقارير المالية</h1>
    <h2>${periodLabel}</h2>
    <div class="meta">
      <div>من: ${formattedFrom}</div>
      <div>إلى: ${formattedTo}</div>
      <div>تم الطباعة: ${printedAt}</div>
    </div>
  </div>

  <!-- Profit & Loss Summary -->
  <div class="profit-section">
    <h2 class="section-title" style="margin-top: 0;">ملخص الربح والخسارة</h2>
    <div class="profit-grid">
      <div class="profit-card">
        <div class="profit-card-label">إجمالي الإيرادات</div>
        <div class="profit-card-value">${formatCurrency(data.profit.totalRevenue)}</div>
      </div>
      <div class="profit-card">
        <div class="profit-card-label">إجمالي المصروفات</div>
        <div class="profit-card-value">${formatCurrency(data.profit.totalExpenses)}</div>
      </div>
      <div class="profit-card">
        <div class="profit-card-label">صافي الربح</div>
        <div class="profit-card-value ${data.profit.netProfit >= 0 ? 'profit-positive' : 'profit-negative'}">
          ${formatCurrency(data.profit.netProfit)}
        </div>
      </div>
    </div>
  </div>

  <!-- Revenues Table -->
  <div class="section">
    <h2 class="section-title">الإيرادات</h2>
    <table>
      <thead>
        <tr>
          <th>التاريخ</th>
          <th>الإيراد</th>
          <th>عدد الطلبات</th>
          <th>الملاحظات</th>
        </tr>
      </thead>
      <tbody>
        ${data.revenues.length > 0 ? data.revenues.map(rev => `
        <tr>
          <td>${formatDate(rev.date)}</td>
          <td>${formatCurrency(rev.amount)}</td>
          <td>${rev.order_count != null && rev.order_count !== undefined ? String(rev.order_count) : '—'}</td>
          <td>${rev.notes || ''}</td>
        </tr>
        `).join('') : '<tr><td colspan="4" style="text-align: center; color: #666;">لا توجد بيانات</td></tr>'}
      </tbody>
    </table>
  </div>

  <!-- Expenses Table -->
  <div class="section">
    <h2 class="section-title">المصروفات</h2>
    <table>
      <thead>
        <tr>
          <th>التاريخ</th>
          <th>الفئة</th>
          <th>المبلغ</th>
          <th>الملاحظات</th>
        </tr>
      </thead>
      <tbody>
        ${data.expenses.length > 0 ? data.expenses.map(exp => `
        <tr>
          <td>${formatDate(exp.date)}</td>
          <td>${getCategoryLabel(exp.category)}</td>
          <td>${formatCurrency(exp.amount)}</td>
          <td>${exp.notes || ''}</td>
        </tr>
        `).join('') : '<tr><td colspan="4" style="text-align: center; color: #666;">لا توجد بيانات</td></tr>'}
      </tbody>
    </table>
  </div>

  <!-- Cash Flow Table -->
  <div class="section">
    <h2 class="section-title">التدفق النقدي</h2>
    <table>
      <thead>
        <tr>
          <th>التاريخ</th>
          <th>النوع</th>
          <th>السبب</th>
          <th>المبلغ</th>
          <th>معرف الطلب</th>
        </tr>
      </thead>
      <tbody>
        ${data.cashFlow.length > 0 ? data.cashFlow.map(cf => `
        <tr>
          <td>${formatDate(cf.date)}</td>
          <td class="${cf.type === 'in' ? 'cash-flow-in' : 'cash-flow-out'}">${getCashFlowTypeLabel(cf.type)}</td>
          <td>${cf.reason}</td>
          <td>${formatCurrency(cf.amount)}</td>
          <td>${cf.linked_order_id ? `#${cf.linked_order_id}` : ''}</td>
        </tr>
        `).join('') : '<tr><td colspan="5" style="text-align: center; color: #666;">لا توجد بيانات</td></tr>'}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

