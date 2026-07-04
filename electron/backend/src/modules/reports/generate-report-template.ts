import { ExportPdfDto, ReportData, ReportSummary } from './dto/export-pdf.dto';

const ARABIC_DAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const ARABIC_MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export function generateReportTemplate(dto: ExportPdfDto): string {
  try {
    const { type, date, data, branchName, userName, comparedToYesterday } = dto;

    console.log('[Template] Starting template generation for type:', type);

    if (!data) {
      throw new Error('Data is required');
    }

    const periodLabels = {
      daily: 'تقرير الأداء اليومي',
      weekly: 'تقرير الأداء الأسبوعي',
      monthly: 'تقرير الأداء الشهري',
      yearly: 'تقرير الأداء السنوي',
    };

    const reportTitle = periodLabels[type] || type;
    const reportDate = new Date(date);
    const now = new Date();

    // Arabic date: الأحد 15 فبراير 2025
    const dayOfWeek = ARABIC_DAY_NAMES[reportDate.getDay()];
    const dayNum = reportDate.getDate();
    const monthName = ARABIC_MONTH_NAMES[reportDate.getMonth()];
    const yearNum = reportDate.getFullYear();
    const arabicDate = `${dayOfWeek} ${dayNum} ${monthName} ${yearNum}`;

    // Time: 10:45 ص
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours < 12 ? 'ص' : 'م';
    const displayHour = hours <= 12 ? (hours || 12) : hours - 12;
    const timeStr = `${displayHour}:${minutes} ${ampm}`;

    // Session: التاريخ — الوقت :التقواطع
    const sessionStr = `${arabicDate} — ${timeStr} :التقواطع`;

    const summary: Partial<ReportSummary> = data?.summary ?? {
      totalSales: 0,
      orderCount: 0,
      averageOrder: 0,
      discounts: 0,
      cancellations: 0,
      netProfit: 0,
    };

    const items = (Array.isArray(data?.items) ? data.items : []).filter((item): item is NonNullable<typeof item> => item != null && typeof item === 'object');
    const top5Items = items.slice(0, 5);

    const employees = (Array.isArray(data?.employees) ? data.employees : []).filter((emp): emp is NonNullable<typeof emp> => emp != null && typeof emp === 'object');
    const orders = (Array.isArray(data?.orders) ? data.orders : []).filter((order): order is NonNullable<typeof order> => order != null && typeof order === 'object');
    const drawer = data?.drawer ?? null;

    // Currency format: 12,450 ع.د (match reference PDF)
    const formatCurrency = (amount: number | null | undefined | string): string => {
      const num = Number(amount ?? 0);
      if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) return '0 ع.د';
      return `${num.toLocaleString('en')} ع.د`;
    };

    const formatNumber = (value: unknown): string => {
      const num = Number(value ?? 0);
      if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) return '0';
      return num.toLocaleString('en');
    };

    const branchDisplay = branchName ? `الفرع: ${branchName}` : '';
    const userDisplay = userName ? `المدخل: ${userName}` : '';

    // Compared to yesterday (daily only)
    const comparedHtml =
      type === 'daily' && comparedToYesterday != null
        ? `<div class="compare-badge ${comparedToYesterday < 0 ? 'negative' : ''}">%${Math.abs(comparedToYesterday)} ${comparedToYesterday >= 0 ? '↑' : '↓'} :مقارنة بالأمس</div>`
        : '';

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTitle} — Lite Sufra</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      color: #0f172a;
      background: linear-gradient(180deg, #f8fafc 0%, #ffffff 120px);
      font-size: 14px;
      line-height: 1.6;
      padding: 28px;
    }

    .report-header {
      text-align: center;
      margin-bottom: 28px;
      padding: 24px 20px;
      background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
      border-radius: 12px;
      color: #fff;
      box-shadow: 0 4px 14px rgba(13, 148, 136, 0.25);
    }
    .report-header .brand {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 6px;
      text-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }
    .report-header .title {
      font-size: 17px;
      font-weight: 500;
      opacity: 0.95;
      margin-bottom: 12px;
    }
    .report-header .meta {
      font-size: 13px;
      opacity: 0.9;
    }
    .report-header .meta div { margin: 3px 0; }
    .report-header .session {
      font-size: 11px;
      opacity: 0.8;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid rgba(255,255,255,0.3);
    }
    .report-header .header-footer {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid rgba(255,255,255,0.45);
      font-size: 13px;
      font-weight: 500;
      opacity: 0.95;
    }
    .report-header .header-footer div { margin: 4px 0; }
    .report-header .header-footer .brand-name { font-weight: 700; }

    .summary-compact {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 28px;
    }
    .summary-item {
      text-align: right;
      padding: 18px 16px;
      background: #fff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      transition: box-shadow 0.2s;
    }
    .summary-item:nth-child(1) { border-right: 4px solid #0d9488; }
    .summary-item:nth-child(2) { border-right: 4px solid #6366f1; }
    .summary-item:nth-child(3) { border-right: 4px solid #f59e0b; }
    .summary-item:nth-child(4) { border-right: 4px solid #10b981; }
    .summary-item .label {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .summary-item .value {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.3px;
    }
    .summary-item .sublabel {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 4px;
    }
    .compare-badge {
      grid-column: 1 / -1;
      font-size: 14px;
      font-weight: 600;
      padding: 10px 16px;
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      color: #047857;
      border-radius: 8px;
      margin-top: 4px;
      border: 1px solid #a7f3d0;
    }
    .compare-badge.negative {
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
      color: #b91c1c;
      border-color: #fecaca;
    }

    .section {
      margin-bottom: 28px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 14px;
      padding: 10px 14px;
      background: #f1f5f9;
      border-radius: 8px;
      border-right: 4px solid #0d9488;
    }

    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 13px;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    th, td {
      padding: 12px 16px;
      text-align: right;
    }
    th {
      font-weight: 600;
      color: #fff;
      background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td {
      color: #334155;
      background: #fff;
      border-bottom: 1px solid #f1f5f9;
    }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    tbody tr:last-child td { border-bottom: none; }
    .rank-badge {
      display: inline-block;
      width: 28px;
      height: 28px;
      line-height: 28px;
      text-align: center;
      border-radius: 50%;
      font-weight: 700;
      font-size: 12px;
    }
    .rank-1 { background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #fff; }
    .rank-2 { background: linear-gradient(135deg, #94a3b8, #64748b); color: #fff; }
    .rank-3 { background: linear-gradient(135deg, #d97706, #b45309); color: #fff; }
    .rank-4, .rank-5 { background: #e2e8f0; color: #475569; }

    .drawer-list {
      background: #fff;
      border-radius: 12px;
      padding: 20px;
      max-width: 420px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .drawer-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 14px;
    }
    .drawer-row:last-of-type { border-bottom: none; }
    .drawer-row .label { color: #64748b; font-weight: 500; }
    .drawer-row .value { font-weight: 700; color: #0f172a; }
    .drawer-row .value.positive { color: #059669; }
    .drawer-row .value.negative { color: #dc2626; }
    .drawer-ok {
      margin-top: 14px;
      padding: 10px 14px;
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      color: #047857;
      font-weight: 700;
      border-radius: 8px;
      text-align: center;
      border: 1px solid #a7f3d0;
    }

    .sales-by-type {
      background: #fff;
      border-radius: 12px;
      padding: 20px;
      max-width: 420px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .sales-type-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 14px;
    }
    .sales-type-row:last-of-type { border-bottom: none; }
    .sales-type-label { color: #64748b; font-weight: 500; }
    .sales-type-value { font-weight: 700; color: #0f172a; }

    @media print {
      body { padding: 16px; background: #fff; }
      .report-header { box-shadow: none; }
      .summary-item { box-shadow: none; }
      .sales-by-type { box-shadow: none; }
      .section { page-break-inside: avoid; }
      thead { display: table-header-group; }
      table { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <div class="brand">Lite Sufra</div>
    <div class="title">${reportTitle}</div>
    ${branchDisplay ? `<div class="meta">${branchDisplay}</div>` : ''}
    <div class="meta">
      <div>${timeStr}</div>
      <div>${arabicDate}</div>
    </div>
    <div class="session">${sessionStr}</div>
    <div class="header-footer">
      <div>تم إنشاء هذا التقرير بواسطة <span class="brand-name">Lite Sufra</span></div>
      ${userDisplay ? `<div>${userDisplay}</div>` : ''}
      ${branchDisplay ? `<div>${branchDisplay}</div>` : ''}
    </div>
  </div>

  <div class="summary-compact">
    <div class="summary-item">
      <div class="label">إجمالي المبيعات</div>
      <div class="value">${formatCurrency(summary?.totalSales)}</div>
      <div class="sublabel">كل ما تم بيعه اليوم</div>
    </div>
    <div class="summary-item">
      <div class="label">عدد الطلبات</div>
      <div class="value">${formatNumber(summary?.orderCount)}</div>
      <div class="sublabel">إجمالي الطلبات</div>
    </div>
    <div class="summary-item">
      <div class="label">متوسط قيمة الطلب</div>
      <div class="value">${formatCurrency(summary?.averageOrder)}</div>
      <div class="sublabel">عدد ÷ الطلبات</div>
    </div>
    <div class="summary-item">
      <div class="label">بعد الخصم</div>
      <div class="value">+${formatCurrency(summary?.netProfit ?? summary?.totalSales)}</div>
      <div class="sublabel">صافي الربح</div>
    </div>
    ${comparedHtml}
  </div>

  ${summary?.salesByType ? `
  <div class="section">
    <h2 class="section-title">المبيعات حسب نوع الطلب</h2>
    <div class="sales-by-type">
      <div class="sales-type-row">
        <span class="sales-type-label">داخل المطعم</span>
        <span class="sales-type-value">${formatCurrency(summary.salesByType.dineIn)}</span>
      </div>
      <div class="sales-type-row">
        <span class="sales-type-label">سفري</span>
        <span class="sales-type-value">${formatCurrency(summary.salesByType.pickup)}</span>
      </div>
      <div class="sales-type-row">
        <span class="sales-type-label">توصيل</span>
        <span class="sales-type-value">${formatCurrency(summary.salesByType.delivery)}</span>
      </div>
    </div>
  </div>
  ` : ''}

  <div class="section">
    <h2 class="section-title">أفضل 5 أصناف</h2>
    <table>
      <thead>
        <tr>
          <th>الترتيب</th>
          <th>الصنف</th>
          <th>الكمية</th>
          <th>إجمالي المبيعات</th>
        </tr>
      </thead>
      <tbody>
        ${top5Items.length > 0 ? top5Items.map((item, i) => `
        <tr>
          <td><span class="rank-badge rank-${Math.min(i + 1, 5)}">${i + 1}</span></td>
          <td>${item?.name ?? '-'}</td>
          <td>${formatNumber(item?.quantitySold ?? (item as any)?.quantity)}</td>
          <td>${formatCurrency(item?.totalSales ?? (item as any)?.revenue)}</td>
        </tr>
        `).join('') : '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:24px;">لا توجد أصناف</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2 class="section-title">أداء الموظفين</h2>
    <table>
      <thead>
        <tr>
          <th>الموظف</th>
          <th>عدد الطلبات</th>
          <th>إجمالي المبيعات</th>
          <th>متوسط الطلب</th>
        </tr>
      </thead>
      <tbody>
        ${employees.length > 0 ? employees.map(emp => `
        <tr>
          <td>${emp?.name ?? '-'}</td>
          <td>${formatNumber(emp?.ordersHandled)}</td>
          <td>${formatCurrency(emp?.totalSales)}</td>
          <td>${formatCurrency(emp?.avgOrderValue)}</td>
        </tr>
        `).join('') : '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:24px;">لا يوجد موظفين</td></tr>'}
      </tbody>
    </table>
  </div>

  ${type === 'daily' && drawer ? `
  <div class="section">
    <h2 class="section-title">تقرير الصندوق</h2>
    <div class="drawer-list">
      <div class="drawer-row">
        <span class="label">الرصيد الافتتاحي</span>
        <span class="value">${formatCurrency(drawer?.openingBalance)}</span>
      </div>
      <div class="drawer-row">
        <span class="label">النقد الوارد</span>
        <span class="value positive">${formatCurrency(drawer?.cashIn)}</span>
      </div>
      <div class="drawer-row">
        <span class="label">النقد الصادر</span>
        <span class="value negative">${formatCurrency(drawer?.cashOut)}</span>
      </div>
      <div class="drawer-row">
        <span class="label">الرصيد المتوقع =</span>
        <span class="value">${formatCurrency((drawer?.openingBalance ?? 0) + (drawer?.cashIn ?? 0) - (drawer?.cashOut ?? 0))}</span>
      </div>
      <div class="drawer-row">
        <span class="label">الرصيد الفعلي</span>
        <span class="value">${formatCurrency(drawer?.closingBalance)}</span>
      </div>
      <div class="drawer-row">
        <span class="label">الفرق</span>
        <span class="value ${(drawer?.variance ?? 0) >= 0 ? 'positive' : 'negative'}">${formatCurrency(drawer?.variance)}</span>
      </div>
      <div class="drawer-ok">صالح البرح ✓</div>
    </div>
  </div>
  ` : ''}

  ${orders.length > 0 && type !== 'daily' ? `
  <div class="section">
    <h2 class="section-title">${type === 'weekly' ? 'ملخص الأيام' : type === 'monthly' ? 'ملخص الأسابيع' : 'ملخص الأشهر'}</h2>
    <table>
      <thead>
        <tr>
          <th>${type === 'weekly' ? 'اليوم' : type === 'monthly' ? 'الأسبوع' : 'الشهر'}</th>
          <th>التاريخ</th>
          <th>عدد الطلبات</th>
          <th>إجمالي المبيعات</th>
          <th>متوسط الطلب</th>
        </tr>
      </thead>
      <tbody>
        ${orders.map(order => `
        <tr>
          <td>${order?.day ?? '-'}</td>
          <td>${order?.date ?? '-'}</td>
          <td>${formatNumber(order?.orderCount)}</td>
          <td>${formatCurrency(order?.totalSales)}</td>
          <td>${formatCurrency(order?.averageOrder)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}
</body>
</html>`;
  } catch (error) {
    console.error('Error generating report template:', error);
    throw new Error(`Failed to generate report template: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
