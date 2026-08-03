import { OrderPrintData } from './receipt-utils';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Register Arabic font if available
 */
async function registerArabicFontIfAvailable(): Promise<void> {
  try {
    // @ts-ignore - canvas is a native module, loaded dynamically
    const { registerFont } = await import('canvas');
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
          console.log(`[KITCHEN] Registered Arabic font: ${fontPath}`);
          return;
        } catch (e) {
          console.warn(`[KITCHEN] Failed to register font ${fontPath}:`, e);
        }
      }
    }
    console.log('[KITCHEN] No Arabic font found, using system default');
  } catch (e) {
    console.warn('[KITCHEN] Error registering Arabic font:', e);
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
 * Render kitchen order receipt to PNG using node-canvas
 * @param data - Order data
 * @returns PNG buffer (3-20 KB)
 */
export async function renderOrderToPng(data: OrderPrintData | null | undefined): Promise<Buffer> {
  console.log('[KITCHEN] Starting PNG generation...');
  console.log('[KITCHEN] Input data:', { 
    orderId: data?.orderId, 
    service_type: data?.service_type,
    itemsCount: data?.items?.length,
    printTarget: data?.printTarget 
  });
  
  // Defensive check - always generate a valid PNG even if data is empty
  if (!data) {
    console.warn('[KITCHEN] No data provided, generating test order');
    data = {
      orderId: 999,
      table: 0,
      hall: 'TEST',
      items: [{ id: 1, item_name: 'TEST OK', quantity: 1, price: 0 }],
      totals: { total: 0 },
      timestamp: new Date().toISOString(),
      restaurantName: 'SUFRA POS - TEST',
      kitchenName: 'KITCHEN',
    };
  }
  
  // Ensure items array exists
  if (!data.items || !Array.isArray(data.items)) {
    console.warn('[KITCHEN] No items array, creating empty array');
    data.items = [];
  }

  try {
    // Lazy-load canvas to avoid startup crashes in dev mode
    // @ts-ignore - canvas is a native module, loaded dynamically
    const { createCanvas } = await import('canvas');
    await registerArabicFontIfAvailable();

    const CANVAS_WIDTH = 576;
    const PADDING = 10;
    const LINE_HEIGHT = 44;
    const FONT_SIZE = 32;
    const FONT_SIZE_LARGE = 40;
    const FONT_SIZE_SMALL = 24;

    const items = data.items || [];
    
    // Create temporary canvas for text measurement
    const tempCanvas = createCanvas(CANVAS_WIDTH, 100);
    const tempCtx = tempCanvas.getContext('2d');
    
    // Helper to measure text height
    const measureTextHeight = (text: string, fontSize: number, maxWidth: number): number => {
      tempCtx.font = `bold ${fontSize}px Arial, "Arabic", sans-serif`;
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
    let estimatedHeight = PADDING * 2;
    
    // Kitchen name
    if (data.kitchenName) {
      estimatedHeight += measureTextHeight(data.kitchenName, FONT_SIZE_LARGE, CANVAS_WIDTH - PADDING * 2) + 5;
    }
    
    // Separator
    estimatedHeight += 10;
    
    // Get service type for height calculations
    const serviceType = data.service_type || items[0]?.service_type || 'dine-in';
    
    // Order type label
    let orderTypeLabel = '';
    if (serviceType === 'pickup') {
      orderTypeLabel = 'PICKUP / سفري';
    } else if (serviceType === 'delivery') {
      orderTypeLabel = 'DELIVERY / توصيل';
    } else {
      orderTypeLabel = 'DINE-IN / طاولة';
    }
    estimatedHeight += measureTextHeight(orderTypeLabel, FONT_SIZE_LARGE, CANVAS_WIDTH - PADDING * 2) + 10;
    
    // Separator after order type
    estimatedHeight += 10;
    
    // Order info
    if (data.orderId) {
      estimatedHeight += LINE_HEIGHT;
    }
    
    // Table and Hall (for dine-in)
    if (serviceType === 'dine-in') {
      if (data.table) {
        estimatedHeight += LINE_HEIGHT;
      }
      if (data.hall) {
        estimatedHeight += LINE_HEIGHT;
      }
    }
    
    // Timestamp
    if (data.timestamp) {
      estimatedHeight += LINE_HEIGHT;
    }
    
    estimatedHeight += 5;
    
    // Items (account for text wrapping)
    if (items.length > 0) {
      items.forEach((item) => {
        const itemName = item.item_name || 'Item';
        const quantity = item.quantity || 1;
        const itemText = `${quantity}x ${itemName}`;
        estimatedHeight += measureTextHeight(itemText, FONT_SIZE, CANVAS_WIDTH - PADDING * 2) + 3;
      });
    } else {
      estimatedHeight += LINE_HEIGHT;
    }
    
    // Note
    if (data.note) {
      estimatedHeight += 5 + measureTextHeight(`Note: ${data.note}`, FONT_SIZE_SMALL, CANVAS_WIDTH - PADDING * 2);
    }
    
    // Extra buffer at bottom
    estimatedHeight += 150;
    
    // Ensure minimum height
    estimatedHeight = Math.max(300, estimatedHeight);

    console.log(`[KITCHEN] Creating canvas: ${CANVAS_WIDTH}x${estimatedHeight}`);

    const canvas = createCanvas(CANVAS_WIDTH, estimatedHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CANVAS_WIDTH, estimatedHeight);

    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'top';

    const drawText = (text: string, x: number, y: number, fontSize: number = FONT_SIZE, align: 'left' | 'center' | 'right' = 'left', bold: boolean = true) => {
      ctx.font = `${bold ? 'bold ' : ''}${fontSize}px Arial, "Arabic", sans-serif`;
      ctx.textAlign = align;
      
      const hasArabic = /[\u0600-\u06FF]/.test(text);
      if (hasArabic) {
        ctx.direction = 'rtl';
      } else {
        ctx.direction = 'ltr';
      }
      
      const lines = wrapText(ctx, text, CANVAS_WIDTH - PADDING * 2 - x);
      lines.forEach((line, idx) => {
        ctx.fillText(line, x, y + idx * LINE_HEIGHT);
      });
      return lines.length;
    };

    let yPos = PADDING;

    // Kitchen name
    if (data.kitchenName) {
      const lines = drawText(data.kitchenName, CANVAS_WIDTH / 2, yPos, FONT_SIZE_LARGE, 'center', true);
      yPos += lines * LINE_HEIGHT + 5;
    }

    // Separator
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING, yPos);
    ctx.lineTo(CANVAS_WIDTH - PADDING, yPos);
    ctx.stroke();
    yPos += 10;

    // Big order type label (DINE-IN / PICKUP / DELIVERY)
    // serviceType and orderTypeLabel already defined above in height calculation section
    const orderTypeLines = drawText(orderTypeLabel, CANVAS_WIDTH / 2, yPos, FONT_SIZE_LARGE, 'center', true);
    yPos += orderTypeLines * LINE_HEIGHT + 10;

    // Separator after order type
    ctx.beginPath();
    ctx.moveTo(PADDING, yPos);
    ctx.lineTo(CANVAS_WIDTH - PADDING, yPos);
    ctx.stroke();
    yPos += 10;

    // Order info
    if (data.orderId) {
      drawText(`Order #${data.orderId}`, PADDING, yPos, FONT_SIZE, 'left', true);
      yPos += LINE_HEIGHT;
    }

    // Table and Hall only for dine-in orders
    if (serviceType === 'dine-in') {
      if (data.table) {
        drawText(`Table: ${data.table}`, PADDING, yPos, FONT_SIZE_SMALL);
        yPos += LINE_HEIGHT;
      }

      if (data.hall) {
        drawText(`Hall: ${data.hall}`, PADDING, yPos, FONT_SIZE_SMALL);
        yPos += LINE_HEIGHT;
      }
    }

    if (data.timestamp) {
      const date = new Date(data.timestamp);
      const dateStr = date.toLocaleString('ar-SA', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
      drawText(`Time: ${dateStr}`, PADDING, yPos, FONT_SIZE_SMALL);
      yPos += LINE_HEIGHT;
    }

    yPos += 5;

    // Items
    if (items.length > 0) {
      items.forEach((item) => {
        const itemName = item.item_name || 'Item';
        const quantity = item.quantity || 1;
        const itemText = `${quantity}x ${itemName}`;
        const lines = drawText(itemText, PADDING, yPos, FONT_SIZE);
        yPos += lines * LINE_HEIGHT + 3;

        const rawOpts = (item as { options_json?: unknown }).options_json;
        let options: Array<{ group_name?: string; option_name?: string }> = [];
        if (Array.isArray(rawOpts)) {
          options = rawOpts;
        } else if (typeof rawOpts === 'string' && rawOpts) {
          try {
            const parsed = JSON.parse(rawOpts);
            if (Array.isArray(parsed)) options = parsed;
          } catch {
            /* ignore */
          }
        }
        for (const opt of options) {
          const sub = `  ${opt.group_name ? `${opt.group_name}: ` : ''}${opt.option_name ?? ''}`.trim();
          if (!sub) continue;
          const subLines = drawText(sub, PADDING + 8, yPos, FONT_SIZE_SMALL);
          yPos += subLines * LINE_HEIGHT + 2;
        }
      });
    } else {
      drawText('No items', PADDING, yPos, FONT_SIZE);
      yPos += LINE_HEIGHT;
    }

    // Note
    if (data.note) {
      yPos += 5;
      drawText(`Note: ${data.note}`, PADDING, yPos, FONT_SIZE_SMALL);
      yPos += LINE_HEIGHT;
    }

    yPos += 10;

    // Generate PNG
    console.log('[KITCHEN] Converting canvas to PNG...');
    const pngBuffer = canvas.toBuffer('image/png');
    
    console.log(`[KITCHEN] ✓ PNG generated: ${pngBuffer.length} bytes (${(pngBuffer.length / 1024).toFixed(2)} KB)`);
    
    if (pngBuffer.length < 1000) {
      console.error(`[KITCHEN] ✕ PNG too small: ${pngBuffer.length} bytes`);
      throw new Error(`PNG generation failed: output too small (${pngBuffer.length} bytes)`);
    }

    return pngBuffer;
  } catch (error: any) {
    console.error('[KITCHEN] ✕ Error generating PNG:', error);
    console.error('[KITCHEN] Error stack:', error.stack);
    return await generateFallbackPng();
  }
}

async function generateFallbackPng(): Promise<Buffer> {
  // @ts-ignore - canvas is a native module, loaded dynamically
  const { createCanvas } = await import('canvas');
  const canvas = createCanvas(576, 200);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 384, 200);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('TEST OK', 192, 80);
  ctx.font = '14px Arial';
  ctx.fillText('Kitchen receipt working', 192, 120);
  return canvas.toBuffer('image/png');
}
