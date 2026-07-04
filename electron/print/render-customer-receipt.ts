import { ReceiptPrintData } from './receipt-utils';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Register Arabic font if available
 */
async function registerArabicFontIfAvailable(): Promise<void> {
  try {
    // @ts-ignore - canvas is a native module, loaded dynamically
    const { registerFont } = await import('canvas');
    // Try to find Arabic font in common locations
    const fontPaths = [
      path.join(__dirname, '../../fonts/arial.ttf'),
      path.join(__dirname, '../../fonts/Arial.ttf'),
      'C:/Windows/Fonts/arial.ttf',
      'C:/Windows/Fonts/tahoma.ttf',
    ];

    for (const fontPath of fontPaths) {
      if (fs.existsSync(fontPath)) {
        try {
          registerFont(fontPath, { family: 'Arabic' });
          console.log(`[RECEIPT] Registered Arabic font: ${fontPath}`);
          return;
        } catch (e) {
          console.warn(`[RECEIPT] Failed to register font ${fontPath}:`, e);
        }
      }
    }
    console.log('[RECEIPT] No Arabic font found, using system default');
  } catch (e) {
    console.warn('[RECEIPT] Error registering Arabic font:', e);
  }
}

/**
 * Wrap text to fit within maxWidth
 */
function wrapText(ctx: any, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines.length > 0 ? lines : [text];
}

/**
 * Format currency in Iraqi Dinars (no decimal places)
 */
function formatCurrency(amount: number): string {
  return `${Math.round(amount)} د.ع`;
}

/**
 * Render customer receipt to PNG using node-canvas
 * Professional table-like layout similar to Excel
 * @param data - Receipt data
 * @returns PNG buffer (3-20 KB)
 */
export async function renderReceiptToPng(data: ReceiptPrintData | null | undefined): Promise<Buffer> {
  console.log('[RECEIPT] Starting PNG generation...');
  
  // Defensive check - always generate a valid PNG even if data is empty
  if (!data) {
    console.warn('[RECEIPT] No data provided, generating test receipt');
    data = {
      orderId: 999,
      table: 0,
      hall: 'TEST',
      items: [{ order_id: 999, item_name: 'TEST OK', quantity: 1, price: 0 }],
      totals: { total: 0 },
      timestamp: new Date().toISOString(),
      restaurantName: 'SUFRA POS - TEST',
    };
  }

  try {
    // Lazy-load canvas to avoid startup crashes in dev mode
    // @ts-ignore - canvas is a native module, loaded dynamically
    const { createCanvas } = await import('canvas');
    // Register Arabic font
    await registerArabicFontIfAvailable();

    // Thermal printer dimensions: 80mm = 576px at 150 DPI
    const CANVAS_WIDTH = 576;
    const PADDING = 15;
    const LINE_HEIGHT = 42;
    const FONT_SIZE = 28;
    const FONT_SIZE_LARGE = 38;
    const FONT_SIZE_SMALL = 22;
    const FONT_SIZE_TINY = 20;
    const SECTION_SPACING = 18; // Extra spacing between major sections

    // Table column positions (from right to left for RTL)
    const COL_ITEM_NAME = CANVAS_WIDTH - PADDING; // Rightmost
    const COL_QUANTITY = 420;
    const COL_UNIT_PRICE = 320;
    const COL_TOTAL = 180;
    const COL_LEFT_EDGE = PADDING;

    // Calculate height dynamically with proper measurement
    let yPos = PADDING;
    const items = data.items || [];
    
    // Create temporary canvas for text measurement
    const tempCanvas = createCanvas(CANVAS_WIDTH, 100);
    const tempCtx = tempCanvas.getContext('2d');
    
    // Helper to measure text height
    const measureTextHeight = (text: string, fontSize: number, maxWidth: number): number => {
      tempCtx.font = `${fontSize}px Arial, "Arabic", sans-serif`;
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = tempCtx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine) {
        lines.push(currentLine);
      }
      
      return Math.max(1, lines.length) * LINE_HEIGHT;
    };
    
    // Calculate actual height needed
    let estimatedHeight = PADDING * 2; // Top and bottom padding
    
    // Get service type for height calculations
    const serviceType = data.service_type || data.items[0]?.service_type || 'dine-in';
    
    // Header section
    if (data.restaurantName) {
      estimatedHeight += measureTextHeight(data.restaurantName, FONT_SIZE_LARGE, CANVAS_WIDTH - PADDING * 2) + SECTION_SPACING;
    }
    
    // Service type label
    if (serviceType === 'pickup' || serviceType === 'delivery') {
      estimatedHeight += LINE_HEIGHT + SECTION_SPACING;
    }
    
    // Date and time
    if (data.timestamp) {
      estimatedHeight += LINE_HEIGHT + 8;
    }
    
    // Delivery customer info (can be multiple lines)
    if (serviceType === 'delivery') {
      if (data.customer_name) {
        estimatedHeight += LINE_HEIGHT;
      }
      if (data.customer_phone) {
        estimatedHeight += LINE_HEIGHT;
      }
      if (data.customer_address) {
        estimatedHeight += measureTextHeight(`العنوان: ${data.customer_address}`, FONT_SIZE_SMALL, CANVAS_WIDTH - PADDING * 2);
      }
      estimatedHeight += SECTION_SPACING;
    }
    
    // Table/Hall info or Order ID
    if ((serviceType === 'dine-in' && (data.table || data.hall)) || data.orderId) {
      estimatedHeight += LINE_HEIGHT + SECTION_SPACING;
    }
    
    // Separator line
    estimatedHeight += SECTION_SPACING;
    
    // Table header
    estimatedHeight += LINE_HEIGHT + 6 + SECTION_SPACING;
    
    // Items (account for text wrapping)
    if (items.length > 0) {
      items.forEach((item, index) => {
        const itemName = item.item_name || 'Item';
        const itemNameHeight = measureTextHeight(itemName, FONT_SIZE, CANVAS_WIDTH - PADDING * 2);
        const rowHeight = Math.max(LINE_HEIGHT, itemNameHeight + 12);
        estimatedHeight += rowHeight;
        
        // Row separator
        if (index < items.length - 1) {
          estimatedHeight += 8;
        }
      });
    } else {
      estimatedHeight += LINE_HEIGHT;
    }
    
    // Table bottom border
    estimatedHeight += SECTION_SPACING;
    
    // Totals section
    if (data.totals) {
      if (data.totals.subtotal !== undefined) {
        estimatedHeight += LINE_HEIGHT + 6;
      }
      if (data.totals.globalDiscount) {
        estimatedHeight += LINE_HEIGHT + 6;
      }
      // Total line
      estimatedHeight += SECTION_SPACING + LINE_HEIGHT + SECTION_SPACING;
    }
    
    // Payment method
    if (data.paymentMethod) {
      estimatedHeight += LINE_HEIGHT + SECTION_SPACING;
    }
    
    // Footer separator
    estimatedHeight += SECTION_SPACING;
    
    // Thank you message
    estimatedHeight += LINE_HEIGHT + SECTION_SPACING;
    
    // Add extra buffer at bottom to prevent cutting (important for thermal printers)
    estimatedHeight += 150;
    
    // Ensure minimum height
    estimatedHeight = Math.max(500, estimatedHeight);

    console.log(`[RECEIPT] Creating canvas: ${CANVAS_WIDTH}x${estimatedHeight}`);

    // Create canvas with properly calculated height
    const canvas = createCanvas(CANVAS_WIDTH, estimatedHeight);
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CANVAS_WIDTH, estimatedHeight);

    // Set default font
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'top';

    // Helper to draw text with RTL support for Arabic
    const drawText = (text: string, x: number, y: number, fontSize: number = FONT_SIZE, align: 'left' | 'center' | 'right' = 'left', bold: boolean = false) => {
      ctx.font = `${bold ? 'bold ' : ''}${fontSize}px Arial, "Arabic", sans-serif`;
      
      // Check if text contains Arabic characters (RTL)
      const hasArabic = /[\u0600-\u06FF]/.test(text);
      
      // For Arabic text, use right alignment; for numbers/English, use specified alignment
      if (hasArabic && align !== 'center') {
        ctx.textAlign = 'right';
        ctx.direction = 'rtl';
        const lines = wrapText(ctx, text, CANVAS_WIDTH - PADDING * 2);
        lines.forEach((line, idx) => {
          ctx.fillText(line, x, y + idx * LINE_HEIGHT);
        });
        return lines.length;
      } else {
        ctx.textAlign = align;
        ctx.direction = 'ltr';
        const lines = wrapText(ctx, text, CANVAS_WIDTH - PADDING * 2);
        lines.forEach((line, idx) => {
          ctx.fillText(line, x, y + idx * LINE_HEIGHT);
        });
        return lines.length;
      }
    };

    // Draw horizontal line
    const drawLine = (y: number, width: number = 1) => {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(PADDING, y);
      ctx.lineTo(CANVAS_WIDTH - PADDING, y);
      ctx.stroke();
    };

    // Draw vertical line
    const drawVerticalLine = (x: number, yStart: number, yEnd: number) => {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, yStart);
      ctx.lineTo(x, yEnd);
      ctx.stroke();
    };

    // ============================================
    // HEADER SECTION
    // ============================================
    
    // Restaurant name (centered, large, bold)
    if (data.restaurantName) {
      const lines = drawText(data.restaurantName, CANVAS_WIDTH / 2, yPos, FONT_SIZE_LARGE, 'center', true);
      yPos += lines * LINE_HEIGHT + SECTION_SPACING;
    }

    // Order type label (for pickup/delivery only)
    // serviceType already defined above in height calculation section
    if (serviceType === 'pickup') {
      const lines = drawText('طلب سفري', CANVAS_WIDTH / 2, yPos, FONT_SIZE_LARGE, 'center', true);
      yPos += lines * LINE_HEIGHT + SECTION_SPACING;
    } else if (serviceType === 'delivery') {
      const lines = drawText('طلب توصيل', CANVAS_WIDTH / 2, yPos, FONT_SIZE_LARGE, 'center', true);
      yPos += lines * LINE_HEIGHT + SECTION_SPACING;
    }

    // Date and time side by side
    if (data.timestamp) {
      const date = new Date(data.timestamp);
      const dateStr = date.toLocaleDateString('ar-IQ', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit'
      });
      const timeStr = date.toLocaleTimeString('ar-IQ', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Date on right, time on left
      drawText(`التاريخ: ${dateStr}`, CANVAS_WIDTH - PADDING, yPos, FONT_SIZE_SMALL, 'right', false);
      drawText(`${timeStr} :الوقت`, COL_LEFT_EDGE, yPos, FONT_SIZE_SMALL, 'left', false);
      yPos += LINE_HEIGHT + 8;
    }

    // For delivery orders, show customer info
    if (serviceType === 'delivery') {
      if (data.customer_name) {
        drawText(`العميل: ${data.customer_name}`, CANVAS_WIDTH - PADDING, yPos, FONT_SIZE_SMALL, 'right', true);
        yPos += LINE_HEIGHT;
      }
      if (data.customer_phone) {
        drawText(`الهاتف: ${data.customer_phone}`, CANVAS_WIDTH - PADDING, yPos, FONT_SIZE_SMALL, 'right', false);
        yPos += LINE_HEIGHT;
      }
      if (data.customer_address) {
        const addressLines = drawText(`العنوان: ${data.customer_address}`, CANVAS_WIDTH - PADDING, yPos, FONT_SIZE_SMALL, 'right', false);
        yPos += addressLines * LINE_HEIGHT;
      }
      yPos += SECTION_SPACING;
    }

    // Table and Hall info (only for dine-in)
    if (serviceType === 'dine-in' && (data.table || data.hall)) {
      let infoText = '';
      if (data.hall) infoText += `القاعة: ${data.hall}`;
      if (data.table) infoText += infoText ? ` | الطاولة: ${data.table}` : `الطاولة: ${data.table}`;
      if (data.orderId) infoText += infoText ? ` | الطلب: #${data.orderId}` : `الطلب: #${data.orderId}`;
      drawText(infoText, CANVAS_WIDTH - PADDING, yPos, FONT_SIZE_SMALL, 'right', false);
      yPos += LINE_HEIGHT + SECTION_SPACING;
    } else if (data.orderId) {
      // For pickup/delivery, just show order ID
      drawText(`الطلب: #${data.orderId}`, CANVAS_WIDTH - PADDING, yPos, FONT_SIZE_SMALL, 'right', false);
      yPos += LINE_HEIGHT + SECTION_SPACING;
    }

    drawLine(yPos, 2);
    yPos += SECTION_SPACING;

    // ============================================
    // TABLE HEADER
    // ============================================
    
    const tableHeaderY = yPos;
    
    // Draw table header background (optional - can be left white)
    // Draw header text
    drawText('اسم الصنف', COL_ITEM_NAME, yPos, FONT_SIZE_SMALL, 'right', true);
    drawText('الكمية', COL_QUANTITY, yPos, FONT_SIZE_SMALL, 'center', true);
    drawText('سعر الوحدة', COL_UNIT_PRICE, yPos, FONT_SIZE_SMALL, 'center', true);
    drawText('المجموع', COL_TOTAL, yPos, FONT_SIZE_SMALL, 'left', true);
    
    yPos += LINE_HEIGHT + 6;
    
    // Draw header separator line
    drawLine(yPos, 2);
    yPos += SECTION_SPACING;

    // ============================================
    // ITEMS TABLE
    // ============================================
    
    const tableStartY = yPos;
    
    if (items.length > 0) {
      items.forEach((item, index) => {
        const itemName = item.item_name || 'Item';
        const quantity = item.quantity || 1;
        const unitPrice = item.price || 0;
        const lineTotal = quantity * unitPrice;
        const itemServiceType = item.service_type || serviceType;
        const serviceLabel = itemServiceType === 'pickup' ? 'سفري' : itemServiceType === 'delivery' ? 'توصيل' : 'طاولة';
        
        // Item name (bold, right-aligned)
        const itemNameLines = drawText(itemName, COL_ITEM_NAME, yPos, FONT_SIZE, 'right', true);
        const itemNameHeight = itemNameLines * LINE_HEIGHT;
        
        // Service type label (under item name, smaller font, not bold) - only if not all items are same type
        if (itemServiceType !== serviceType) {
          drawText(serviceLabel, COL_ITEM_NAME, yPos + itemNameHeight - 8, FONT_SIZE_SMALL, 'right', false);
        }
        
        // Quantity (center-aligned) - aligned with item name
        drawText(String(quantity), COL_QUANTITY, yPos, FONT_SIZE, 'center', false);
        
        // Unit price (center-aligned) - aligned with item name
        drawText(formatCurrency(unitPrice), COL_UNIT_PRICE, yPos, FONT_SIZE, 'center', false);
        
        // Total price (left-aligned) - aligned with item name
        drawText(formatCurrency(lineTotal), COL_TOTAL, yPos, FONT_SIZE, 'left', false);
        
        // Calculate row height based on item name (if it wraps)
        const rowHeight = Math.max(LINE_HEIGHT, itemNameHeight + 12);
        yPos += rowHeight;
        
        // Draw row separator (lighter line)
        if (index < items.length - 1) {
          drawLine(yPos, 1);
          yPos += 8;
        }
      });
    } else {
      drawText('لا توجد أصناف', CANVAS_WIDTH / 2, yPos, FONT_SIZE, 'center', false);
      yPos += LINE_HEIGHT;
    }

    // Draw table bottom border
    drawLine(yPos, 2);
    yPos += SECTION_SPACING;

    // ============================================
    // TOTALS SECTION
    // ============================================
    
    if (data.totals) {
      // Subtotal
      if (data.totals.subtotal !== undefined) {
        drawText('المجموع الفرعي:', CANVAS_WIDTH - PADDING, yPos, FONT_SIZE, 'right', false);
        drawText(formatCurrency(data.totals.subtotal), COL_TOTAL, yPos, FONT_SIZE, 'left', false);
        yPos += LINE_HEIGHT + 6;
      }

      // Discount
      if (data.totals.globalDiscount) {
        const discountText = `خصم (${data.totals.globalDiscount.percent}%):`;
        drawText(discountText, CANVAS_WIDTH - PADDING, yPos, FONT_SIZE, 'right', false);
        drawText(`-${formatCurrency(data.totals.globalDiscount.amount)}`, COL_TOTAL, yPos, FONT_SIZE, 'left', false);
        yPos += LINE_HEIGHT + 6;
      }

      // Total (bold, larger)
      drawLine(yPos, 2);
      yPos += SECTION_SPACING;
      drawText('المجموع:', CANVAS_WIDTH - PADDING, yPos, FONT_SIZE_LARGE, 'right', true);
      drawText(formatCurrency(data.totals.total), COL_TOTAL, yPos, FONT_SIZE_LARGE, 'left', true);
      yPos += LINE_HEIGHT + SECTION_SPACING;
    }

    // Payment method
    if (data.paymentMethod) {
      drawText(`طريقة الدفع: ${data.paymentMethod}`, CANVAS_WIDTH - PADDING, yPos, FONT_SIZE_SMALL, 'right', false);
      yPos += LINE_HEIGHT + SECTION_SPACING;
    }

    drawLine(yPos, 2);
    yPos += SECTION_SPACING;

    // ============================================
    // FOOTER
    // ============================================
    
    // Thank you message (centered, distinct)
    drawText('شكراً لكم', CANVAS_WIDTH / 2, yPos, FONT_SIZE, 'center', true);
    yPos += LINE_HEIGHT + SECTION_SPACING;

    // Generate PNG buffer
    console.log('[RECEIPT] Converting canvas to PNG...');
    const pngBuffer = canvas.toBuffer('image/png');
    
    console.log(`[RECEIPT] ✓ PNG generated successfully: ${pngBuffer.length} bytes (${(pngBuffer.length / 1024).toFixed(2)} KB)`);
    
    // Validate PNG size (should be 3-20 KB)
    if (pngBuffer.length < 1000) {
      console.error(`[RECEIPT] ✕ PNG too small: ${pngBuffer.length} bytes - likely corrupted`);
      throw new Error(`PNG generation failed: output too small (${pngBuffer.length} bytes)`);
    }
    
    if (pngBuffer.length > 50000) {
      console.warn(`[RECEIPT] ⚠ PNG very large: ${pngBuffer.length} bytes (${(pngBuffer.length / 1024).toFixed(2)} KB)`);
    }

    return pngBuffer;
  } catch (error: any) {
    console.error('[RECEIPT] ✕ Error generating PNG:', error);
    console.error('[RECEIPT] Error stack:', error.stack);
    
    // Fallback: generate minimal valid PNG
    console.log('[RECEIPT] Generating fallback test PNG...');
    return await generateFallbackPng();
  }
}

/**
 * Generate a minimal valid test PNG (fallback)
 */
async function generateFallbackPng(): Promise<Buffer> {
  // @ts-ignore - canvas is a native module, loaded dynamically
  const { createCanvas } = await import('canvas');
  const canvas = createCanvas(576, 200);
  const ctx = canvas.getContext('2d');
  
  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 384, 200);
  
  // Black text
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('TEST OK', 192, 80);
  ctx.font = '14px Arial';
  ctx.fillText('Receipt generation working', 192, 120);
  
  return canvas.toBuffer('image/png');
}
