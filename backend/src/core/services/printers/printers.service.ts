import { DatabaseService } from '../../database/database.service';

export interface PrinterDevice {
  name: string;
  isDefault: boolean;
  status?: string;
}

export interface PrinterSettings {
  id?: number;
  kitchen_id: number | null;
  printer_ip: string | null;
  printer_port: number;
  printer_type: 'kitchen' | 'customer';
  is_active: boolean;
}

export class PrintersService {
  constructor(private readonly db: DatabaseService) {}

  async getAvailablePrinters(): Promise<PrinterDevice[]> {
    console.log('[PRINTERS] Printer detection handled by Electron - returning empty array');
    return [];
  }

  async getAllSettings(): Promise<PrinterSettings[]> {
    const rows = await this.db.all(
      'SELECT id, kitchen_id, printer_ip, printer_port, printer_type, is_active FROM printer_settings',
    );
    return (rows || []).map((row: any) => ({
      ...row,
      printer_port: row.printer_port ?? 9100,
    }));
  }

  async saveSetting(data: {
    kitchen_id: number | null;
    printer_ip: string | null;
    printer_port?: number;
    printer_type?: 'kitchen' | 'customer';
  }): Promise<PrinterSettings> {
    const printer_type: 'kitchen' | 'customer' = data.kitchen_id !== null ? 'kitchen' : 'customer';

    const printer_ip = data.printer_ip && data.printer_ip.trim() !== ''
      ? data.printer_ip.trim()
      : null;

    const printer_port = data.printer_port && data.printer_port > 0 ? data.printer_port : 9100;

    const is_active = printer_ip !== null ? 1 : 0;

    const checkQuery = data.kitchen_id === null
      ? 'SELECT id FROM printer_settings WHERE kitchen_id IS NULL AND printer_type = ?'
      : 'SELECT id FROM printer_settings WHERE kitchen_id = ? AND printer_type = ?';

    const checkParams = data.kitchen_id === null
      ? [printer_type]
      : [data.kitchen_id, printer_type];

    const row = await this.db.get(checkQuery, checkParams);

    if (row) {
      await this.db.run(
        'UPDATE printer_settings SET printer_ip = ?, printer_port = ?, is_active = ?, kitchen_id = ?, printer_type = ? WHERE id = ?',
        [printer_ip, printer_port, is_active, data.kitchen_id, printer_type, row.id],
      );
      return {
        id: row.id,
        kitchen_id: data.kitchen_id,
        printer_ip: printer_ip,
        printer_port: printer_port,
        printer_type: printer_type,
        is_active: is_active === 1,
      };
    } else {
      await this.db.run(
        'INSERT INTO printer_settings (kitchen_id, printer_ip, printer_port, printer_type, is_active) VALUES (?, ?, ?, ?, ?)',
        [data.kitchen_id, printer_ip, printer_port, printer_type, is_active],
      );
      const id = await this.db.getLastInsertRowId();
      return {
        id: id,
        kitchen_id: data.kitchen_id,
        printer_ip: printer_ip,
        printer_port: printer_port,
        printer_type: printer_type,
        is_active: is_active === 1,
      };
    }
  }

  async deleteSetting(id: number): Promise<void> {
    await this.db.run('DELETE FROM printer_settings WHERE id = ?', [id]);
  }

  formatOrderForPrint(
    kitchenName: string,
    orderNumber: number,
    items: any[],
    tableName: string,
  ): string {
    const LF = '\n';

    let output = '';
    output += kitchenName + LF + LF;
    output += `طلب رقم: ${orderNumber}${LF}`;
    output += `الطاولة: ${tableName}${LF}`;
    output += '================================' + LF;

    items.forEach((item) => {
      const serviceType = item.service_type || 'dine-in';
      const serviceLabel = serviceType === 'pickup' ? ' [سفري]' : '';
      output += `${item.quantity}x ${item.item_name}${serviceLabel}${LF}`;
    });

    output += '================================' + LF + LF;
    output += `الوقت: ${new Date().toLocaleString('ar-IQ')}${LF}`;
    output += LF + LF;

    return output;
  }

  formatReceiptForPrint(
    tableNumber: number,
    hallName: string,
    orders: any[],
    total: number,
    subtotal?: number,
    globalDiscount?: { percent: number; amount: number } | null,
  ): string {
    const LF = '\n';

    let output = '';
    output += 'فاتورة العميل' + LF + LF;
    output += `الطاولة: ${tableNumber}${LF}`;
    output += `الصالة: ${hallName}${LF}`;
    output += `الوقت: ${new Date().toLocaleString('ar-IQ')}${LF}`;
    output += '================================' + LF;

    orders.forEach((order) => {
      output += `طلب #${order.id}${LF}`;
      order.items.forEach((item: any) => {
        const lineTotal = item.quantity * item.price;
        const serviceType = item.service_type || 'dine-in';
        const serviceLabel = serviceType === 'pickup' ? ' [سفري]' : ' [طاولة]';
        output += `  ${item.quantity}x ${item.item_name}${serviceLabel}`;
        output += ' '.repeat(Math.max(1, 30 - (item.item_name.length + serviceLabel.length)));
        output += `${lineTotal} د.ع${LF}`;
      });
    });

    output += '================================' + LF;

    if (globalDiscount && subtotal) {
      output += `المجموع الفرعي: ${Math.round(subtotal).toLocaleString('ar-IQ')} د.ع${LF}`;
      output += `الخصم العام: ${globalDiscount.percent}% (${Math.round(globalDiscount.amount).toLocaleString('ar-IQ')} د.ع)${LF}`;
      output += `الإجمالي بعد الخصم: ${Math.round(total).toLocaleString('ar-IQ')} د.ع${LF}`;
      output += '* تم تطبيق الخصم على الفاتورة *' + LF;
    } else {
      output += `الإجمالي: ${Math.round(total).toLocaleString('ar-IQ')} د.ع${LF}`;
    }

    output += LF + 'شكراً لزيارتكم' + LF + LF;

    return output;
  }
}
