import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type { ExportPdfDto, ReportData, ReportSummary } from '../../types/reports/export-pdf.dto';
import {
  formatCurrency,
  formatNumber,
  getMovementLabel,
  formatDate,
  getPeriodLabel,
} from './report-utils';

Font.register({
  family: 'IBM Plex Sans Arabic',
  src: 'https://fonts.gstatic.com/s/ibmplexsansarabic/v14/Qw3MZRtWPQCuHMe67t1WIz9MBNANe6q.woff2',
});

const styles = StyleSheet.create({
  page: {
    fontFamily: 'IBM Plex Sans Arabic',
    direction: 'rtl',
    padding: 24,
    fontSize: 15,
    color: '#121212',
  },
  header: {
    textAlign: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: { fontSize: 28, fontWeight: 700, marginBottom: 8 },
  headerSubtitle: { fontSize: 20, fontWeight: 600, marginBottom: 12 },
  meta: { fontSize: 15, color: '#4A5668', marginTop: 8 },
  section: {
    marginBottom: 24,
    padding: 24,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
  },
  sectionTitle: { fontSize: 20, fontWeight: 600, marginBottom: 16 },
  sectionSubtitle: { fontSize: 15, color: 'rgba(18,18,18,0.6)', marginBottom: 16 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  summaryCard: { width: '30%', minWidth: 120, marginBottom: 8 },
  summaryLabel: { fontSize: 15, color: 'rgba(18,18,18,0.6)', marginBottom: 4, fontWeight: 500 },
  summaryValue: { fontSize: 24, fontWeight: 700 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', padding: '12 16' },
  tableHeader: { fontWeight: 700, fontSize: 15 },
  tableCell: { flex: 1, textAlign: 'right', fontSize: 15 },
  tableCellName: { flex: 2, textAlign: 'right', fontSize: 15 },
  tableCellNarrow: { flex: 0.8, textAlign: 'right', fontSize: 15 },
  badge: { padding: '4 10', borderRadius: 9999, fontSize: 13, fontWeight: 500 },
  badgeHigh: { backgroundColor: 'rgba(16,185,129,0.1)', color: '#10B981' },
  badgeMedium: { backgroundColor: 'rgba(245,158,11,0.1)', color: '#F59E0B' },
  badgeLow: { backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444' },
  drawerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16 },
  drawerItem: {
    width: '30%',
    minWidth: 140,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
  },
  drawerItemEmerald: { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' },
  drawerItemRed: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' },
  drawerItemAqua: { backgroundColor: 'rgba(46,231,201,0.1)', borderColor: 'rgba(46,231,201,0.2)' },
  drawerLabel: { fontSize: 15, color: 'rgba(18,18,18,0.6)', marginBottom: 4, fontWeight: 500 },
  drawerValue: { fontSize: 20, fontWeight: 700 },
  drawerValueEmerald: { color: '#10B981' },
  drawerValueRed: { color: '#EF4444' },
});

interface ReportDocumentProps {
  dto: ExportPdfDto;
}

function SummarySection({ summary }: { summary: Partial<ReportSummary> }) {
  return (
    <View style={styles.section}>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>إجمالي المبيعات</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary?.totalSales)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>عدد الطلبات</Text>
          <Text style={styles.summaryValue}>{formatNumber(summary?.orderCount)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>متوسط قيمة الطلب</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary?.averageOrder)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>الخصومات</Text>
          <Text style={styles.summaryValue}>{formatCurrency(summary?.discounts)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>الإلغاءات</Text>
          <Text style={styles.summaryValue}>{formatNumber(summary?.cancellations)}</Text>
        </View>
        {summary?.netProfit !== undefined && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>صافي الربح</Text>
            <Text style={styles.summaryValue}>{formatCurrency(summary?.netProfit)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function ItemsTable({ items }: { items: ReportData['items'] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>أداء الأصناف</Text>
      <View style={[styles.tableRow, styles.tableHeader]}>
        <Text style={[styles.tableCellName, styles.tableHeader]}>اسم الصنف</Text>
        <Text style={[styles.tableCellNarrow, styles.tableHeader]}>عدد المرات</Text>
        <Text style={[styles.tableCell, styles.tableHeader]}>إجمالي المبيعات</Text>
        <Text style={[styles.tableCellNarrow, styles.tableHeader]}>الحركة</Text>
      </View>
      {(items || []).map((item, i) => (
        <View key={i} style={styles.tableRow}>
          <Text style={styles.tableCellName}>{item?.name || '-'}</Text>
          <Text style={styles.tableCellNarrow}>{formatNumber(item?.quantitySold)}</Text>
          <Text style={styles.tableCell}>{formatCurrency(item?.totalSales)}</Text>
          <Text style={[styles.tableCellNarrow, styles.badge, (item?.movementStatus || 'low') === 'high' ? styles.badgeHigh : (item?.movementStatus || 'low') === 'medium' ? styles.badgeMedium : styles.badgeLow]}>
            {getMovementLabel(item?.movementStatus || 'low')}
          </Text>
        </View>
      ))}
    </View>
  );
}

function EmployeesTable({ employees }: { employees: ReportData['employees'] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>أداء الموظفين</Text>
      <View style={[styles.tableRow, styles.tableHeader]}>
        <Text style={[styles.tableCellName, styles.tableHeader]}>الموظف</Text>
        <Text style={[styles.tableCellNarrow, styles.tableHeader]}>عدد الطلبات</Text>
        <Text style={[styles.tableCell, styles.tableHeader]}>إجمالي المبيعات</Text>
        <Text style={[styles.tableCellNarrow, styles.tableHeader]}>الإلغاءات</Text>
        <Text style={[styles.tableCell, styles.tableHeader]}>متوسط الطلب</Text>
      </View>
      {(employees || []).map((emp, i) => (
        <View key={i} style={styles.tableRow}>
          <Text style={styles.tableCellName}>{emp?.name || 'N/A'}</Text>
          <Text style={styles.tableCellNarrow}>{formatNumber(emp?.ordersHandled)}</Text>
          <Text style={styles.tableCell}>{formatCurrency(emp?.totalSales)}</Text>
          <Text style={styles.tableCellNarrow}>{formatNumber(emp?.cancellations)}</Text>
          <Text style={styles.tableCell}>{formatCurrency(emp?.avgOrderValue)}</Text>
        </View>
      ))}
    </View>
  );
}

function DrawerSection({ drawer }: { drawer: NonNullable<ReportData['drawer']> }) {
  const expected = (drawer?.openingBalance ?? 0) + (drawer?.cashIn ?? 0) - (drawer?.cashOut ?? 0);
  const variance = drawer?.variance ?? 0;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>تقرير الصندوق</Text>
      <Text style={styles.sectionSubtitle}>ملخص حركة الصندوق النقدي</Text>
      <View style={styles.drawerGrid}>
        <View style={styles.drawerItem}>
          <Text style={styles.drawerLabel}>الرصيد الافتتاحي</Text>
          <Text style={styles.drawerValue}>{formatCurrency(drawer?.openingBalance)}</Text>
        </View>
        <View style={[styles.drawerItem, styles.drawerItemEmerald]}>
          <Text style={styles.drawerLabel}>النقد الوارد</Text>
          <Text style={[styles.drawerValue, styles.drawerValueEmerald]}>{formatCurrency(drawer?.cashIn)}</Text>
        </View>
        <View style={[styles.drawerItem, styles.drawerItemRed]}>
          <Text style={styles.drawerLabel}>النقد الصادر</Text>
          <Text style={[styles.drawerValue, styles.drawerValueRed]}>{formatCurrency(drawer?.cashOut)}</Text>
        </View>
        <View style={styles.drawerItem}>
          <Text style={styles.drawerLabel}>الرصيد المتوقع</Text>
          <Text style={styles.drawerValue}>{formatCurrency(expected)}</Text>
        </View>
        <View style={[styles.drawerItem, styles.drawerItemAqua]}>
          <Text style={styles.drawerLabel}>الرصيد الفعلي</Text>
          <Text style={styles.drawerValue}>{formatCurrency(drawer?.closingBalance)}</Text>
        </View>
        <View style={[styles.drawerItem, variance >= 0 ? styles.drawerItemEmerald : styles.drawerItemRed]}>
          <Text style={styles.drawerLabel}>الفرق</Text>
          <Text style={[styles.drawerValue, variance >= 0 ? styles.drawerValueEmerald : styles.drawerValueRed]}>
            {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function DailySummaryTable({ orders, type }: { orders: ReportData['orders']; type: ExportPdfDto['type'] }) {
  const colLabel = type === 'daily' ? 'اليوم' : type === 'weekly' ? 'اليوم' : type === 'monthly' ? 'الأسبوع' : 'الشهر';
  const title = type === 'daily' ? 'ملخص اليوم' : type === 'weekly' ? 'ملخص الأيام' : type === 'monthly' ? 'ملخص الأسابيع' : 'ملخص الأشهر';
  const subtitle = type === 'daily' ? 'إجمالي المبيعات للعمل اليوم' : type === 'weekly' ? 'إجمالي المبيعات لكل يوم عمل' : type === 'monthly' ? 'إجمالي المبيعات لكل أسبوع' : 'إجمالي المبيعات لكل شهر';

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      <View style={[styles.tableRow, styles.tableHeader]}>
        <Text style={[styles.tableCellName, styles.tableHeader]}>{colLabel}</Text>
        <Text style={[styles.tableCell, styles.tableHeader]}>التاريخ</Text>
        <Text style={[styles.tableCellNarrow, styles.tableHeader]}>عدد الطلبات</Text>
        <Text style={[styles.tableCell, styles.tableHeader]}>إجمالي المبيعات</Text>
        <Text style={[styles.tableCell, styles.tableHeader]}>متوسط الطلب</Text>
        <Text style={[styles.tableCellNarrow, styles.tableHeader]}>الخصومات</Text>
        <Text style={[styles.tableCell, styles.tableHeader]}>صافي الربح</Text>
      </View>
      {(orders || []).map((order, i) => {
        if (!order || typeof order !== 'object') return null;
        const day = String(order.day ?? order.date ?? '-') || '-';
        const date = String(order.date ?? '-') || '-';
        return (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.tableCellName}>{day}</Text>
            <Text style={styles.tableCell}>{date}</Text>
            <Text style={styles.tableCellNarrow}>{formatNumber(order.orderCount)}</Text>
            <Text style={styles.tableCell}>{formatCurrency(order.totalSales)}</Text>
            <Text style={styles.tableCell}>{formatCurrency(order.averageOrder)}</Text>
            <Text style={styles.tableCellNarrow}>{formatCurrency(order.totalDiscounts)}</Text>
            <Text style={styles.tableCell}>{formatCurrency(order.netProfit)}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function ReportDocument({ dto }: ReportDocumentProps) {
  const { type, date, data } = dto;
  if (!data) throw new Error('Data is required');

  const periodLabel = getPeriodLabel(type);
  const reportDate = new Date(date);
  const formattedDate = formatDate(reportDate, type);
  const now = new Date();
  const printedAt = `${String(now.getDate()).padStart(2, '0')}/${now.getMonth() + 1}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const summary = data.summary ?? { totalSales: 0, orderCount: 0, averageOrder: 0, discounts: 0, cancellations: 0, netProfit: 0 };
  const items = (data.items || []).filter((i): i is NonNullable<typeof i> => i != null && typeof i === 'object');
  const employees = (data.employees || []).filter((e): e is NonNullable<typeof e> => e != null && typeof e === 'object');
  const orders = (data.orders || []).filter((o): o is NonNullable<typeof o> => o != null && typeof o === 'object');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>التقارير المالية</Text>
          <Text style={styles.headerSubtitle}>{periodLabel}</Text>
          <Text style={styles.meta}>التاريخ: {formattedDate}</Text>
          <Text style={styles.meta}>تم الطباعة: {printedAt}</Text>
        </View>

        <SummarySection summary={summary} />
        <ItemsTable items={items} />
        <EmployeesTable employees={employees} />
        {type === 'daily' && data.drawer && <DrawerSection drawer={data.drawer} />}
        <DailySummaryTable orders={orders} type={type} />
      </Page>
    </Document>
  );
}
