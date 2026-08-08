import { DatabaseService } from '../../database/database.service';

export interface PrinterDevice {
  name: string;
  isDefault: boolean;
  status?: string;
}

export type PrinterConnectionType = 'network' | 'windows_spooler';

export interface PrinterSettings {
  id?: number;
  kitchen_id: number | null;
  connection_type: PrinterConnectionType;
  printer_ip: string | null;
  printer_port: number;
  printer_name: string | null;
  printer_type: 'kitchen' | 'customer';
  is_active: boolean;
}

function normalizeConnectionType(value: unknown): PrinterConnectionType {
  return value === 'windows_spooler' ? 'windows_spooler' : 'network';
}

function mapPrinterRow(row: any): PrinterSettings {
  const connection_type = normalizeConnectionType(row.connection_type);
  const printer_ip = row.printer_ip ?? null;
  const printer_name = row.printer_name ?? null;
  const printer_port = row.printer_port ?? 9100;
  const is_active =
    typeof row.is_active === 'boolean'
      ? row.is_active
      : Number(row.is_active) === 1;
  return {
    id: row.id,
    kitchen_id: row.kitchen_id ?? null,
    connection_type,
    printer_ip,
    printer_port,
    printer_name,
    printer_type: row.printer_type,
    is_active,
  };
}

class PrintersService {
  constructor(private readonly db: DatabaseService) {}

  // Get all available printers on the system (native printers only)
  // Note: In Electron apps, printer detection should be done via Electron IPC
  // This endpoint returns empty array - frontend should use window.sufra.print.getPrinters()
  async getAvailablePrinters(): Promise<PrinterDevice[]> {
    console.log('[PRINTERS] Printer detection handled by Electron - returning empty array');
    return [];
  }

  async getAllSettings(): Promise<PrinterSettings[]> {
    const rows = await this.db.all(
      `SELECT id, kitchen_id, connection_type, printer_ip, printer_port, printer_name, printer_type, is_active
       FROM printer_settings`,
    );
    return (rows || []).map(mapPrinterRow);
  }

  /**
   * Save or update printer setting.
   * printer_type is derived from kitchen_id (null → customer, else kitchen).
   */
  async saveSetting(data: {
    kitchen_id: number | null;
    connection_type?: PrinterConnectionType | string;
    printer_ip?: string | null;
    printer_port?: number;
    printer_name?: string | null;
    printer_type?: 'kitchen' | 'customer';
  }): Promise<PrinterSettings> {
    const printer_type: 'kitchen' | 'customer' =
      data.kitchen_id !== null ? 'kitchen' : 'customer';

    const connection_type = normalizeConnectionType(data.connection_type);

    const printer_ip =
      data.printer_ip && data.printer_ip.trim() !== ''
        ? data.printer_ip.trim()
        : null;

    const printer_name =
      data.printer_name && data.printer_name.trim() !== ''
        ? data.printer_name.trim()
        : null;

    const printer_port =
      data.printer_port && data.printer_port > 0 ? data.printer_port : 9100;

    const is_active =
      connection_type === 'windows_spooler'
        ? printer_name !== null
          ? 1
          : 0
        : printer_ip !== null
          ? 1
          : 0;

    const checkQuery =
      data.kitchen_id === null
        ? 'SELECT id FROM printer_settings WHERE kitchen_id IS NULL AND printer_type = ?'
        : 'SELECT id FROM printer_settings WHERE kitchen_id = ? AND printer_type = ?';

    const checkParams =
      data.kitchen_id === null ? [printer_type] : [data.kitchen_id, printer_type];

    const row = await this.db.get(checkQuery, checkParams);

    if (row) {
      await this.db.run(
        `UPDATE printer_settings
         SET connection_type = ?, printer_ip = ?, printer_port = ?, printer_name = ?,
             is_active = ?, kitchen_id = ?, printer_type = ?
         WHERE id = ?`,
        [
          connection_type,
          printer_ip,
          printer_port,
          printer_name,
          is_active,
          data.kitchen_id,
          printer_type,
          row.id,
        ],
      );
      return {
        id: row.id,
        kitchen_id: data.kitchen_id,
        connection_type,
        printer_ip,
        printer_port,
        printer_name,
        printer_type,
        is_active: is_active === 1,
      };
    }

    await this.db.run(
      `INSERT INTO printer_settings
         (kitchen_id, connection_type, printer_ip, printer_port, printer_name, printer_type, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.kitchen_id,
        connection_type,
        printer_ip,
        printer_port,
        printer_name,
        printer_type,
        is_active,
      ],
    );
    const id = await this.db.getLastInsertRowId();
    return {
      id,
      kitchen_id: data.kitchen_id,
      connection_type,
      printer_ip,
      printer_port,
      printer_name,
      printer_type,
      is_active: is_active === 1,
    };
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
      const rawOpts = item.options_json;
      const options = Array.isArray(rawOpts)
        ? rawOpts
        : typeof rawOpts === 'string' && rawOpts
          ? (() => {
              try {
                const parsed = JSON.parse(rawOpts);
                return Array.isArray(parsed) ? parsed : [];
              } catch {
                return [];
              }
            })()
          : [];
      for (const opt of options) {
        const sub = `  ${opt.group_name ? `${opt.group_name}: ` : ''}${opt.option_name ?? ''}`.trim();
        if (sub) output += `${sub}${LF}`;
      }
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
      const ticket =
        order.display_number != null && Number(order.display_number) > 0
          ? Number(order.display_number)
          : order.id;
      output += `طلب #${ticket}${LF}`;
      order.items.forEach((item: any) => {
        const lineTotal = item.quantity * item.price;
        const serviceType = item.service_type || 'dine-in';
        const serviceLabel = serviceType === 'pickup' ? ' [سفري]' : ' [طاولة]';
        output += `  ${item.quantity}x ${item.item_name}${serviceLabel}`;
        output += ' '.repeat(Math.max(1, 30 - (item.item_name.length + serviceLabel.length)));
        output += `${lineTotal} د.ع${LF}`;
        const rawOpts = item.options_json;
        const options = Array.isArray(rawOpts)
          ? rawOpts
          : typeof rawOpts === 'string' && rawOpts
            ? (() => {
                try {
                  const parsed = JSON.parse(rawOpts);
                  return Array.isArray(parsed) ? parsed : [];
                } catch {
                  return [];
                }
              })()
            : [];
        for (const opt of options) {
          const sub = `    ${opt.group_name ? `${opt.group_name}: ` : ''}${opt.option_name ?? ''}`.trim();
          if (sub) output += `${sub}${LF}`;
        }
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

let printersInstance: PrintersService | null = null;

export function initializePrinters(db: DatabaseService): void {
  printersInstance = new PrintersService(db);
}

function requirePrinters(): PrintersService {
  if (!printersInstance) {
    throw new Error('Printers not initialized');
  }
  return printersInstance;
}

export function getAvailablePrinters(): ReturnType<PrintersService['getAvailablePrinters']> {
  return requirePrinters().getAvailablePrinters();
}

export function getAllSettings(): ReturnType<PrintersService['getAllSettings']> {
  return requirePrinters().getAllSettings();
}

export function saveSetting(
  ...args: Parameters<PrintersService['saveSetting']>
): ReturnType<PrintersService['saveSetting']> {
  return requirePrinters().saveSetting(...args);
}

export function deleteSetting(
  ...args: Parameters<PrintersService['deleteSetting']>
): ReturnType<PrintersService['deleteSetting']> {
  return requirePrinters().deleteSetting(...args);
}

export function formatOrderForPrint(
  ...args: Parameters<PrintersService['formatOrderForPrint']>
): ReturnType<PrintersService['formatOrderForPrint']> {
  return requirePrinters().formatOrderForPrint(...args);
}

export function formatReceiptForPrint(
  ...args: Parameters<PrintersService['formatReceiptForPrint']>
): ReturnType<PrintersService['formatReceiptForPrint']> {
  return requirePrinters().formatReceiptForPrint(...args);
}
