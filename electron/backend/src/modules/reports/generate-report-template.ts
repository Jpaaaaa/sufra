import { ExportPdfDto, ReportData, ReportSummary, ShiftBreakdownRow } from './dto/export-pdf.dto';

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

    const periodShort = {
      daily: 'يومي',
      weekly: 'أسبوعي',
      monthly: 'شهري',
      yearly: 'سنوي',
    };

    const reportTitle = periodLabels[type] || type;
    const reportDate = new Date(date);
    const now = new Date();

    const dayOfWeek = ARABIC_DAY_NAMES[reportDate.getDay()];
    const dayNum = reportDate.getDate();
    const monthName = ARABIC_MONTH_NAMES[reportDate.getMonth()];
    const yearNum = reportDate.getFullYear();
    const arabicDate = `${dayOfWeek} ${dayNum} ${monthName} ${yearNum}`;

    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours < 12 ? 'ص' : 'م';
    const displayHour = hours <= 12 ? (hours || 12) : hours - 12;
    const timeStr = `${displayHour}:${minutes} ${ampm}`;

    const sessionStr = `${arabicDate} — ${timeStr} :التقواطع`;

    const summary: Partial<ReportSummary> = data?.summary ?? {
      totalSales: 0,
      orderCount: 0,
      averageOrder: 0,
      discounts: 0,
      cancellations: 0,
      netProfit: 0,
    };

    const items = (Array.isArray(data?.items) ? data.items : []).filter(
      (item): item is NonNullable<typeof item> => item != null && typeof item === 'object',
    );
    const top5Items = items.slice(0, 5);

    const employees = (Array.isArray(data?.employees) ? data.employees : []).filter(
      (emp): emp is NonNullable<typeof emp> => emp != null && typeof emp === 'object',
    );
    const orders = (Array.isArray(data?.orders) ? data.orders : []).filter(
      (order): order is NonNullable<typeof order> => order != null && typeof order === 'object',
    );
    const drawer = data?.drawer ?? null;

    const shiftBreakdown = Array.isArray(data?.shiftBreakdown) ? data.shiftBreakdown : [];
    const shiftBreakdownByDay = data?.shiftBreakdownByDay ?? {};
    const shiftBreakdownByMonth = data?.shiftBreakdownByMonth ?? {};
    const shiftBreakdownTotals = Array.isArray(data?.shiftBreakdownTotals) ? data.shiftBreakdownTotals : [];

    const formatShiftHours = (start: string | null | undefined, end: string | null | undefined): string => {
      if (!start || !end) return '—';
      return `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
    };

    const renderShiftTable = (rows: ShiftBreakdownRow[]): string => {
      if (!rows.length) {
        return `<div class="empty-state inline">
          <div class="empty-title">لا توجد بيانات ورديات</div>
        </div>`;
      }
      return `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>اسم الوردية</th>
              <th>الساعات</th>
              <th>عدد الطلبات</th>
              <th>إجمالي المبيعات</th>
              <th>متوسط الطلب</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
            <tr>
              <td class="cell-strong">${row?.shiftName ?? '-'}</td>
              <td>${formatShiftHours(row?.startTime, row?.endTime)}</td>
              <td>${formatNumber(row?.orderCount)}</td>
              <td>${formatCurrency(row?.totalSales)}</td>
              <td>${formatCurrency(row?.averageOrder)}</td>
            </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>`;
    };

    const aggregateShiftsForMonth = (daysMap: Record<string, ShiftBreakdownRow[]>): ShiftBreakdownRow[] => {
      const byShift = new Map<string, ShiftBreakdownRow>();
      for (const dayRows of Object.values(daysMap)) {
        for (const row of dayRows) {
          const key = String(row.shiftId ?? row.shiftName ?? 'unknown');
          const existing = byShift.get(key);
          if (existing) {
            existing.orderCount = (Number(existing.orderCount) || 0) + (Number(row.orderCount) || 0);
            existing.totalSales = (Number(existing.totalSales) || 0) + (Number(row.totalSales) || 0);
          } else {
            byShift.set(key, {
              shiftId: row.shiftId ?? null,
              shiftName: row.shiftName ?? '-',
              startTime: row.startTime ?? null,
              endTime: row.endTime ?? null,
              orderCount: Number(row.orderCount) || 0,
              totalSales: Number(row.totalSales) || 0,
              averageOrder: 0,
            });
          }
        }
      }
      return Array.from(byShift.values()).map((row) => ({
        ...row,
        averageOrder: row.orderCount > 0 ? Math.round(row.totalSales / row.orderCount) : 0,
      }));
    };

    const getMonthShiftRows = (monthKey: string): ShiftBreakdownRow[] => {
      const monthMap = shiftBreakdownByMonth[monthKey];
      if (monthMap && Object.keys(monthMap).length > 0) {
        return aggregateShiftsForMonth(monthMap);
      }
      const daysMap: Record<string, ShiftBreakdownRow[]> = {};
      for (const [dateKey, rows] of Object.entries(shiftBreakdownByDay)) {
        if (dateKey.startsWith(`${monthKey}-`)) {
          daysMap[dateKey] = rows;
        }
      }
      return Object.keys(daysMap).length > 0 ? aggregateShiftsForMonth(daysMap) : [];
    };

    const hasShiftPeriodData =
      shiftBreakdownTotals.length > 0 ||
      Object.keys(shiftBreakdownByDay).length > 0 ||
      Object.keys(shiftBreakdownByMonth).length > 0;

    const getWeekEndStr = (weekStartStr: string): string => {
      const d = new Date(`${weekStartStr}T12:00:00`);
      d.setDate(d.getDate() + 7);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    const getDayShiftRows = (dateKey: string): ShiftBreakdownRow[] => shiftBreakdownByDay[dateKey] ?? [];

    const getWeekShiftRows = (weekStartStr: string, weekEndStr: string): ShiftBreakdownRow[] => {
      const daysMap: Record<string, ShiftBreakdownRow[]> = {};
      for (const [dateKey, rows] of Object.entries(shiftBreakdownByDay)) {
        if (dateKey >= weekStartStr && dateKey < weekEndStr) {
          daysMap[dateKey] = rows;
        }
      }
      return Object.keys(daysMap).length > 0 ? aggregateShiftsForMonth(daysMap) : [];
    };

    const getShiftRowsForOrder = (order: (typeof orders)[number]): ShiftBreakdownRow[] => {
      if (!hasShiftPeriodData) return [];
      if (type === 'yearly') return getMonthShiftRows(order?.date?.slice(0, 7) ?? '');
      if (type === 'weekly') return getDayShiftRows(order?.date ?? '');
      if (type === 'monthly') {
        const weekStart = order?.date ?? '';
        if (!weekStart) return [];
        return getWeekShiftRows(weekStart, getWeekEndStr(weekStart));
      }
      return [];
    };

    const periodColumnHeader =
      type === 'weekly' ? 'اليوم / التاريخ' : type === 'monthly' ? 'الأسبوع / التاريخ' : 'الشهر / التاريخ';

    const buildMergedPeriodOrderRows = (): string =>
      orders
        .map((order) => {
          const shiftRows = getShiftRowsForOrder(order);
          const mergedCell = (rowspan?: number) =>
            `<td${rowspan ? ` rowspan="${rowspan}"` : ''} colspan="2" class="month-date-merged">
              <div class="month-date-label">${order?.day ?? '-'}</div>
              <div class="month-date-sub">${order?.date ?? '-'}</div>
            </td>`;

          if (hasShiftPeriodData && shiftRows.length > 0) {
            return shiftRows
              .map(
                (shift, index) => `
          <tr>
            ${index === 0 ? mergedCell(shiftRows.length) : ''}
            <td class="cell-strong">${shift.shiftName ?? '-'}</td>
            <td>${formatNumber(shift.orderCount)}</td>
            <td>${formatCurrency(shift.totalSales)}</td>
            <td>${formatCurrency(shift.averageOrder)}</td>
          </tr>`,
              )
              .join('');
          }

          return `
          <tr>
            ${mergedCell()}
            ${hasShiftPeriodData ? '<td>—</td>' : ''}
            <td>${formatNumber(order?.orderCount)}</td>
            <td>${formatCurrency(order?.totalSales)}</td>
            <td>${formatCurrency(order?.averageOrder)}</td>
          </tr>`;
        })
        .join('');

    const buildShiftSectionHtml = (): string => {
      const hasShiftData =
        shiftBreakdown.length > 0 ||
        shiftBreakdownTotals.length > 0 ||
        Object.keys(shiftBreakdownByDay).length > 0 ||
        Object.keys(shiftBreakdownByMonth).length > 0;

      if (!hasShiftData) return '';

      let body = '';

      if (type === 'daily') {
        const dailyRows = shiftBreakdown.length > 0 ? shiftBreakdown : shiftBreakdownTotals;
        body += renderShiftTable(dailyRows);
      } else if (shiftBreakdownTotals.length > 0) {
        body += `
        <div class="shift-totals-block avoid-break">
          <div class="shift-subtitle">إجماليات الورديات للفترة</div>
          ${renderShiftTable(shiftBreakdownTotals)}
        </div>`;
      }

      if (!body.trim()) return '';

      return `
  <section class="block avoid-break">
    <div class="section-head">
      <h2 class="section-title">تفاصيل الورديات</h2>
      <span class="section-sub">${type === 'daily' ? 'أداء كل وردية' : 'إجمالي الفترة'}</span>
    </div>
    ${body}
  </section>`;
    };

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

    const shiftSectionHtml = buildShiftSectionHtml();
    const shiftOnPage1 = type === 'daily' && shiftSectionHtml;

    const branchDisplay = branchName ? branchName : '';
    const userDisplay = userName ? userName : '';
    const reportNumber = `LS-${date.replace(/-/g, '')}-${type.substring(0, 2).toUpperCase()}`;
    const periodLabel = periodShort[type] || type;

    const salesByType = summary?.salesByType;
    const salesTypeTotal = salesByType
      ? (Number(salesByType.dineIn) || 0) + (Number(salesByType.pickup) || 0) + (Number(salesByType.delivery) || 0)
      : 0;
    const salesPct = (amount: number) => (salesTypeTotal > 0 ? Math.round((amount / salesTypeTotal) * 100) : 0);

    const bestItemName = top5Items.length > 0 ? (top5Items[0]?.name ?? '-') : '-';
    const expectedDrawerBalance = drawer
      ? (drawer.openingBalance ?? 0) + (drawer.cashIn ?? 0) - (drawer.cashOut ?? 0)
      : 0;
    const drawerVariance = drawer?.variance ?? 0;
    const drawerMatched = Math.abs(drawerVariance) < 1;

    const netProfit = summary?.netProfit ?? summary?.totalSales ?? 0;

    const comparedHtml =
      type === 'daily' && comparedToYesterday != null
        ? `
    <div class="compare-card ${comparedToYesterday < 0 ? 'compare-down' : 'compare-up'}">
      <div class="compare-icon">${comparedToYesterday >= 0 ? '↑' : '↓'}</div>
      <div class="compare-body">
        <div class="compare-label">مقارنة بالأمس</div>
        <div class="compare-value">${comparedToYesterday >= 0 ? 'ارتفاع' : 'انخفاض'} بنسبة ${Math.abs(comparedToYesterday)}%</div>
        <div class="compare-desc">مقارنة بإجمالي مبيعات اليوم السابق</div>
      </div>
    </div>`
        : '';

    const salesByTypeHtml = salesByType
      ? `
  <section class="block avoid-break">
    <div class="section-head">
      <h2 class="section-title">المبيعات حسب نوع الطلب</h2>
      <span class="section-sub">توزيع الإيرادات</span>
    </div>
    <div class="sales-grid">
      <div class="sales-card">
        <div class="sales-card-top">
          <span class="sales-card-label">داخل المطعم</span>
          <span class="sales-card-pct">${salesPct(salesByType.dineIn)}%</span>
        </div>
        <div class="sales-card-amount">${formatCurrency(salesByType.dineIn)}</div>
        <div class="progress-track"><div class="progress-fill" style="width:${salesPct(salesByType.dineIn)}%"></div></div>
      </div>
      <div class="sales-card">
        <div class="sales-card-top">
          <span class="sales-card-label">سفري</span>
          <span class="sales-card-pct">${salesPct(salesByType.pickup)}%</span>
        </div>
        <div class="sales-card-amount">${formatCurrency(salesByType.pickup)}</div>
        <div class="progress-track"><div class="progress-fill secondary" style="width:${salesPct(salesByType.pickup)}%"></div></div>
      </div>
      <div class="sales-card">
        <div class="sales-card-top">
          <span class="sales-card-label">توصيل</span>
          <span class="sales-card-pct">${salesPct(salesByType.delivery)}%</span>
        </div>
        <div class="sales-card-amount">${formatCurrency(salesByType.delivery)}</div>
        <div class="progress-track"><div class="progress-fill dark" style="width:${salesPct(salesByType.delivery)}%"></div></div>
      </div>
    </div>
  </section>`
      : '';

    const top5Html =
      top5Items.length > 0
        ? top5Items
            .map(
              (item, i) => `
      <div class="item-row">
        <span class="rank-badge rank-${Math.min(i + 1, 5)}">${i + 1}</span>
        <div class="item-info">
          <div class="item-name">${item?.name ?? '-'}</div>
          <div class="item-meta">الكمية: ${formatNumber(item?.quantitySold ?? (item as any)?.quantity)}</div>
        </div>
        <div class="item-sales">${formatCurrency(item?.totalSales ?? (item as any)?.revenue)}</div>
      </div>`,
            )
            .join('')
        : `<div class="empty-state inline">
        <div class="empty-icon">—</div>
        <div class="empty-title">لا توجد أصناف</div>
        <div class="empty-desc">لم يتم تسجيل مبيعات أصناف في هذه الفترة</div>
      </div>`;

    const employeesHtml =
      employees.length > 0
        ? `
    <div class="table-wrap avoid-break">
      <table class="data-table">
        <thead>
          <tr>
            <th>الموظف</th>
            <th>عدد الطلبات</th>
            <th>إجمالي المبيعات</th>
            <th>متوسط الطلب</th>
          </tr>
        </thead>
        <tbody>
          ${employees
            .map(
              (emp) => `
          <tr>
            <td class="cell-strong">${emp?.name ?? '-'}</td>
            <td>${formatNumber(emp?.ordersHandled)}</td>
            <td>${formatCurrency(emp?.totalSales)}</td>
            <td>${formatCurrency(emp?.avgOrderValue)}</td>
          </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>`
        : `
    <div class="empty-state">
      <div class="empty-icon">—</div>
      <div class="empty-title">لا يوجد موظفون</div>
      <div class="empty-desc">لم يتم تسجيل نشاط موظفين في هذه الفترة</div>
    </div>`;

    const drawerHtml =
      type === 'daily' && drawer
        ? `
  <section class="block avoid-break">
    <div class="section-head">
      <h2 class="section-title">تقرير الصندوق</h2>
      <span class="section-sub">ملخص الحركة النقدية</span>
    </div>
    <div class="drawer-dashboard">
      <div class="drawer-grid">
        <div class="drawer-metric">
          <div class="drawer-metric-label">الرصيد الافتتاحي</div>
          <div class="drawer-metric-value">${formatCurrency(drawer.openingBalance)}</div>
        </div>
        <div class="drawer-metric">
          <div class="drawer-metric-label">النقد الداخل</div>
          <div class="drawer-metric-value text-success">${formatCurrency(drawer.cashIn)}</div>
        </div>
        <div class="drawer-metric">
          <div class="drawer-metric-label">النقد الخارج</div>
          <div class="drawer-metric-value text-danger">${formatCurrency(drawer.cashOut)}</div>
        </div>
        <div class="drawer-metric">
          <div class="drawer-metric-label">الرصيد المتوقع</div>
          <div class="drawer-metric-value">${formatCurrency(expectedDrawerBalance)}</div>
        </div>
        <div class="drawer-metric">
          <div class="drawer-metric-label">الرصيد الفعلي</div>
          <div class="drawer-metric-value">${formatCurrency(drawer.closingBalance)}</div>
        </div>
        <div class="drawer-metric">
          <div class="drawer-metric-label">الفرق</div>
          <div class="drawer-metric-value ${drawerVariance >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(drawer.variance)}</div>
        </div>
      </div>
      <div class="drawer-status ${drawerMatched ? 'status-ok' : 'status-bad'}">
        ${drawerMatched ? '✓ الصندوق متطابق' : '⚠ يوجد فرق في الصندوق'}
      </div>
    </div>
  </section>`
        : '';

    const ordersHtml =
      orders.length > 0 && type !== 'daily'
        ? `
  <section class="block avoid-break">
    <div class="section-head">
      <h2 class="section-title">${type === 'weekly' ? 'ملخص الأيام' : type === 'monthly' ? 'ملخص الأسابيع' : 'ملخص الأشهر'}</h2>
      <span class="section-sub">تفصيل الفترة</span>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th colspan="2">${periodColumnHeader}</th>
            ${hasShiftPeriodData ? '<th>اسم الوردية</th>' : ''}
            <th>عدد الطلبات</th>
            <th>إجمالي المبيعات</th>
            <th>متوسط الطلب</th>
          </tr>
        </thead>
        <tbody>
          ${buildMergedPeriodOrderRows()}
        </tbody>
      </table>
    </div>
  </section>`
        : '';

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTitle} — sufra pos</title>
  <style>
    :root {
      --primary: #0F8E81;
      --secondary: #14B8A6;
      --dark: #0F172A;
      --gray: #64748B;
      --bg: #F8FAFC;
      --success: #10B981;
      --warning: #F59E0B;
      --danger: #EF4444;
      --white: #FFFFFF;
      --border: #E2E8F0;
      --radius: 16px;
      --shadow: 0 4px 20px rgba(15, 23, 42, 0.06);
    }

    @page {
      size: A4 portrait;
      margin: 10mm 9mm 14mm 9mm;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    html, body {
      font-family: 'IBM Plex Sans Arabic', system-ui, sans-serif;
      direction: rtl;
      color: var(--dark);
      background: var(--bg);
      font-size: 11px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .report {
      width: 100%;
      max-width: 100%;
    }

    .avoid-break {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .page-break-before {
      break-before: page;
      page-break-before: always;
    }

    /* Header */
    .report-header {
      background: linear-gradient(135deg, var(--primary) 0%, #0A6B62 55%, var(--secondary) 100%);
      border-radius: var(--radius);
      padding: 18px 20px;
      color: var(--white);
      box-shadow: var(--shadow);
      margin-bottom: 14px;
      position: relative;
      overflow: hidden;
    }
    .report-header::before {
      content: '';
      position: absolute;
      top: -40px;
      left: -40px;
      width: 140px;
      height: 140px;
      background: rgba(255,255,255,0.08);
      border-radius: 50%;
    }
    .report-header::after {
      content: '';
      position: absolute;
      bottom: -30px;
      right: -20px;
      width: 100px;
      height: 100px;
      background: rgba(255,255,255,0.06);
      border-radius: 50%;
    }
    .header-inner { position: relative; z-index: 1; }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 14px;
    }
    .brand-block { display: flex; align-items: center; gap: 10px; }
    .logo {
      width: 44px;
      height: 44px;
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 18px;
      letter-spacing: -0.5px;
    }
    .brand-name {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.3px;
    }
    .brand-tag {
      font-size: 9px;
      opacity: 0.85;
      font-weight: 500;
    }
    .report-meta-box {
      text-align: left;
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 12px;
      padding: 8px 12px;
      min-width: 130px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      font-size: 9px;
      margin-bottom: 3px;
    }
    .meta-row:last-child { margin-bottom: 0; }
    .meta-label { opacity: 0.8; font-weight: 500; }
    .meta-value { font-weight: 700; }

    .header-title-block {
      border-top: 1px solid rgba(255,255,255,0.2);
      padding-top: 12px;
    }
    .report-title {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .report-period {
      font-size: 11px;
      font-weight: 600;
      opacity: 0.95;
      margin-bottom: 8px;
    }
    .header-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      background: rgba(255,255,255,0.14);
      border: 1px solid rgba(255,255,255,0.22);
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 9px;
      font-weight: 600;
    }
    .session-line {
      margin-top: 8px;
      font-size: 8.5px;
      opacity: 0.8;
    }

    /* KPI Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 12px;
    }
    .kpi-card {
      background: var(--white);
      border-radius: var(--radius);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
      padding: 12px;
      position: relative;
      overflow: hidden;
    }
    .kpi-card::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 4px;
      height: 100%;
      background: var(--primary);
    }
    .kpi-card:nth-child(2)::before { background: var(--secondary); }
    .kpi-card:nth-child(3)::before { background: var(--warning); }
    .kpi-card:nth-child(4)::before { background: var(--success); }

    .kpi-icon {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: rgba(15, 142, 129, 0.1);
      color: var(--primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      margin-bottom: 8px;
      font-weight: 700;
    }
    .kpi-card:nth-child(2) .kpi-icon { background: rgba(20,184,166,0.12); color: var(--secondary); }
    .kpi-card:nth-child(3) .kpi-icon { background: rgba(245,158,11,0.12); color: var(--warning); }
    .kpi-card:nth-child(4) .kpi-icon { background: rgba(16,185,129,0.12); color: var(--success); }

    .kpi-value {
      font-size: 15px;
      font-weight: 800;
      color: var(--dark);
      margin-bottom: 2px;
      letter-spacing: -0.2px;
    }
    .kpi-label {
      font-size: 9px;
      font-weight: 700;
      color: var(--gray);
      margin-bottom: 2px;
    }
    .kpi-desc {
      font-size: 8px;
      color: #94A3B8;
      font-weight: 500;
    }

    /* Comparison */
    .compare-card {
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--white);
      border-radius: var(--radius);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
      padding: 12px 14px;
      margin-bottom: 12px;
    }
    .compare-up { border-color: rgba(16,185,129,0.35); background: linear-gradient(90deg, #fff 0%, #F0FDF9 100%); }
    .compare-down { border-color: rgba(239,68,68,0.35); background: linear-gradient(90deg, #fff 0%, #FEF2F2 100%); }
    .compare-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: 800;
      flex-shrink: 0;
    }
    .compare-up .compare-icon { background: rgba(16,185,129,0.15); color: var(--success); }
    .compare-down .compare-icon { background: rgba(239,68,68,0.15); color: var(--danger); }
    .compare-label { font-size: 9px; color: var(--gray); font-weight: 600; }
    .compare-value { font-size: 13px; font-weight: 800; color: var(--dark); }
    .compare-desc { font-size: 8px; color: #94A3B8; margin-top: 2px; }

    /* Sections */
    .block { margin-bottom: 12px; }
    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 800;
      color: var(--dark);
    }
    .section-sub {
      font-size: 8.5px;
      color: var(--gray);
      font-weight: 600;
    }

    /* Sales by Type */
    .sales-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .sales-card {
      background: var(--white);
      border-radius: var(--radius);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
      padding: 12px;
    }
    .sales-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .sales-card-label { font-size: 9px; font-weight: 700; color: var(--gray); }
    .sales-card-pct { font-size: 10px; font-weight: 800; color: var(--primary); }
    .sales-card-amount { font-size: 13px; font-weight: 800; color: var(--dark); margin-bottom: 8px; }
    .progress-track {
      height: 6px;
      background: #EEF2F7;
      border-radius: 999px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--primary), var(--secondary));
      border-radius: 999px;
    }
    .progress-fill.secondary { background: linear-gradient(90deg, var(--secondary), #5EEAD4); }
    .progress-fill.dark { background: linear-gradient(90deg, #334155, var(--dark)); }

    /* Top Items */
    .items-card {
      background: var(--white);
      border-radius: var(--radius);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
      padding: 10px 12px;
    }
    .item-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      border-bottom: 1px solid #F1F5F9;
    }
    .item-row:last-child { border-bottom: none; }
    .rank-badge {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 800;
      flex-shrink: 0;
    }
    .rank-1 { background: linear-gradient(135deg, #FBBF24, var(--warning)); color: #fff; }
    .rank-2 { background: linear-gradient(135deg, #94A3B8, var(--gray)); color: #fff; }
    .rank-3 { background: linear-gradient(135deg, #D97706, #B45309); color: #fff; }
    .rank-4, .rank-5 { background: #E2E8F0; color: #475569; }
    .item-info { flex: 1; min-width: 0; }
    .item-name { font-size: 10px; font-weight: 700; color: var(--dark); }
    .item-meta { font-size: 8px; color: var(--gray); margin-top: 1px; }
    .item-sales { font-size: 10px; font-weight: 800; color: var(--primary); white-space: nowrap; }

    /* Tables */
    .table-wrap {
      background: var(--white);
      border-radius: var(--radius);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
    }
    .data-table thead th {
      background: linear-gradient(135deg, var(--primary), #0A6B62);
      color: #fff;
      font-weight: 700;
      padding: 9px 10px;
      text-align: right;
      font-size: 8.5px;
    }
    .data-table tbody td {
      padding: 8px 10px;
      border-bottom: 1px solid #F1F5F9;
      color: #334155;
    }
    .data-table tbody tr:nth-child(even) td { background: #FAFBFC; }
    .data-table tbody tr:last-child td { border-bottom: none; }
    .cell-strong { font-weight: 700; color: var(--dark); }
    .month-date-merged {
      vertical-align: middle;
      text-align: center;
      background: #FAFBFC;
      border-left: 1px solid #F1F5F9;
    }
    .month-date-label {
      font-size: 10px;
      font-weight: 800;
      color: var(--dark);
      margin-bottom: 3px;
    }
    .month-date-sub {
      font-size: 8px;
      color: var(--gray);
      font-weight: 600;
    }

    /* Drawer Dashboard */
    .drawer-dashboard {
      background: var(--white);
      border-radius: var(--radius);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
      padding: 12px;
    }
    .drawer-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 10px;
    }
    .drawer-metric {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 10px;
    }
    .drawer-metric-label { font-size: 8px; color: var(--gray); font-weight: 600; margin-bottom: 4px; }
    .drawer-metric-value { font-size: 11px; font-weight: 800; color: var(--dark); }
    .text-success { color: var(--success) !important; }
    .text-danger { color: var(--danger) !important; }
    .drawer-status {
      text-align: center;
      padding: 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 800;
    }
    .status-ok {
      background: rgba(16,185,129,0.12);
      color: #047857;
      border: 1px solid rgba(16,185,129,0.3);
    }
    .status-bad {
      background: rgba(239,68,68,0.1);
      color: #B91C1C;
      border: 1px solid rgba(239,68,68,0.3);
    }

    /* Final Summary */
    .final-summary {
      background: var(--white);
      border-radius: var(--radius);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
      padding: 12px;
      margin-bottom: 10px;
    }
    .final-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
    }
    .final-item {
      background: var(--bg);
      border-radius: 10px;
      padding: 8px;
      text-align: center;
      border: 1px solid var(--border);
    }
    .final-label { font-size: 7.5px; color: var(--gray); font-weight: 600; margin-bottom: 3px; }
    .final-value { font-size: 10px; font-weight: 800; color: var(--dark); }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 24px 12px;
      background: var(--white);
      border-radius: var(--radius);
      border: 1px dashed var(--border);
    }
    .empty-state.inline {
      border: none;
      background: transparent;
      padding: 16px 12px;
    }
    .empty-icon { font-size: 18px; margin-bottom: 6px; color: var(--gray); }
    .empty-title { font-size: 11px; font-weight: 800; color: var(--dark); }
    .empty-desc { font-size: 8.5px; color: var(--gray); margin-top: 3px; }

    /* Footer */
    .print-footer {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8px;
      color: var(--gray);
      font-weight: 600;
    }
    .footer-brand { font-weight: 800; color: var(--primary); }
    .footer-center { text-align: center; }

    .shift-totals-block { margin-bottom: 10px; }
    .shift-subtitle {
      font-size: 10px;
      font-weight: 700;
      color: var(--gray);
      margin-bottom: 6px;
    }
    .shift-day-block { margin-bottom: 10px; }
    .shift-day-label {
      font-size: 10px;
      font-weight: 800;
      color: var(--dark);
      margin-bottom: 6px;
      padding: 6px 10px;
      background: var(--bg);
      border-radius: 8px;
      border: 1px solid var(--border);
    }
    .shift-month-block { margin-bottom: 12px; }
    .shift-month-label {
      font-size: 11px;
      font-weight: 800;
      color: var(--primary);
      margin-bottom: 8px;
    }

    @media print {
      body { background: #fff; }
      .report-header, .kpi-card, .sales-card, .items-card, .table-wrap,
      .drawer-dashboard, .final-summary, .compare-card {
        box-shadow: none;
      }
      thead { display: table-header-group; }
      tr { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="report">

    <header class="report-header avoid-break">
      <div class="header-inner">
        <div class="header-top">
          <div class="brand-block">
            <div class="logo">LS</div>
            <div>
              <div class="brand-name">sufra pos</div>
              <div class="brand-tag">نظام إدارة المطاعم المتكامل</div>
            </div>
          </div>
          <div class="report-meta-box">
            <div class="meta-row"><span class="meta-label">رقم التقرير</span><span class="meta-value">${reportNumber}</span></div>
            <div class="meta-row"><span class="meta-label">التاريخ</span><span class="meta-value">${arabicDate}</span></div>
            <div class="meta-row"><span class="meta-label">الوقت</span><span class="meta-value">${timeStr}</span></div>
          </div>
        </div>
        <div class="header-title-block">
          <div class="report-title">${reportTitle}</div>
          <div class="report-period">الفترة: ${periodLabel}</div>
          <div class="header-chips">
            ${userDisplay ? `<span class="chip">المستخدم: ${userDisplay}</span>` : ''}
            ${branchDisplay ? `<span class="chip">الفرع: ${branchDisplay}</span>` : ''}
            <span class="chip">تم الإنشاء تلقائياً</span>
          </div>
          <div class="session-line">${sessionStr}</div>
        </div>
      </div>
    </header>

    <div class="kpi-grid avoid-break">
      <div class="kpi-card">
        <div class="kpi-icon">₪</div>
        <div class="kpi-value">${formatCurrency(summary?.totalSales)}</div>
        <div class="kpi-label">إجمالي المبيعات</div>
        <div class="kpi-desc">إجمالي الإيرادات للفترة</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">#</div>
        <div class="kpi-value">${formatNumber(summary?.orderCount)}</div>
        <div class="kpi-label">عدد الطلبات</div>
        <div class="kpi-desc">إجمالي الطلبات المسجلة</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">Ø</div>
        <div class="kpi-value">${formatCurrency(summary?.averageOrder)}</div>
        <div class="kpi-label">متوسط الطلب</div>
        <div class="kpi-desc">متوسط قيمة الطلب الواحد</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon">+</div>
        <div class="kpi-value">${formatCurrency(netProfit)}</div>
        <div class="kpi-label">صافي الربح</div>
        <div class="kpi-desc">بعد الخصومات والإلغاءات</div>
      </div>
    </div>

    ${comparedHtml}

    ${salesByTypeHtml}

    ${shiftOnPage1 ? shiftSectionHtml : ''}

    <section class="block avoid-break">
      <div class="section-head">
        <h2 class="section-title">أفضل 5 أصناف</h2>
        <span class="section-sub">الأكثر مبيعاً</span>
      </div>
      <div class="items-card">${top5Html}</div>
    </section>

    <div class="page-break-before"></div>

    ${!shiftOnPage1 && shiftSectionHtml ? shiftSectionHtml : ''}

    <section class="block avoid-break">
      <div class="section-head">
        <h2 class="section-title">أداء الموظفين</h2>
        <span class="section-sub">${formatNumber(employees.length)} موظف</span>
      </div>
      ${employeesHtml}
    </section>

    ${drawerHtml}
    ${ordersHtml}

    <section class="block avoid-break">
      <div class="section-head">
        <h2 class="section-title">ملخص التقرير</h2>
        <span class="section-sub">نظرة شاملة</span>
      </div>
      <div class="final-summary">
        <div class="final-grid">
          <div class="final-item">
            <div class="final-label">إجمالي الطلبات</div>
            <div class="final-value">${formatNumber(summary?.orderCount)}</div>
          </div>
          <div class="final-item">
            <div class="final-label">إجمالي المبيعات</div>
            <div class="final-value">${formatCurrency(summary?.totalSales)}</div>
          </div>
          <div class="final-item">
            <div class="final-label">عدد الأصناف</div>
            <div class="final-value">${formatNumber(items.length)}</div>
          </div>
          <div class="final-item">
            <div class="final-label">أفضل صنف</div>
            <div class="final-value">${bestItemName}</div>
          </div>
          <div class="final-item">
            <div class="final-label">إجمالي الموظفين</div>
            <div class="final-value">${formatNumber(employees.length)}</div>
          </div>
        </div>
      </div>
    </section>

    <footer class="print-footer avoid-break">
      <div><span class="footer-brand">sufra pos</span> — Generated Automatically</div>
      <div class="footer-center">وقت الإنشاء: ${arabicDate} ${timeStr}</div>
      <div>sufra pos</div>
    </footer>

  </div>
</body>
</html>`;
  } catch (error) {
    console.error('Error generating report template:', error);
    throw new Error(`Failed to generate report template: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
