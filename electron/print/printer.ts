import { PNG } from 'pngjs';
import * as net from 'net';

export { scanForPrinters } from './printer-scanner';

/**
 * Convert PNG buffer to ESC/POS raster graphics format
 * Supports 80mm thermal printers (576px width)
 * @param pngBuffer - Valid PNG image buffer (3-20 KB expected)
 * @returns Buffer with ESC/POS commands ready for network printer
 */
function pngToEscPos(pngBuffer: Buffer): Buffer {
  console.log('[ESC/POS] Starting conversion...');
  console.log(`[ESC/POS] Input PNG size: ${pngBuffer.length} bytes (${(pngBuffer.length / 1024).toFixed(2)} KB)`);
  
  // Validate PNG buffer
  if (!pngBuffer || pngBuffer.length < 100) {
    console.error(`[ESC/POS] ✕ Invalid PNG buffer: ${pngBuffer?.length || 0} bytes`);
    throw new Error(`Invalid PNG buffer: too small (${pngBuffer?.length || 0} bytes)`);
  }

  // Check PNG signature
  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  if (!pngBuffer.subarray(0, 8).equals(pngSignature)) {
    console.error('[ESC/POS] ✕ Invalid PNG signature');
    throw new Error('Invalid PNG: missing PNG signature');
  }

  try {
    // Decode PNG using pngjs
    console.log('[ESC/POS] Decoding PNG with pngjs...');
    const png = PNG.sync.read(pngBuffer);
    const width = png.width;
    const height = png.height;
    
    console.log(`[ESC/POS] PNG decoded: ${width}x${height} pixels, ${png.data.length} bytes of pixel data`);
    
    if (width === 0 || height === 0) {
      throw new Error(`Invalid PNG dimensions: ${width}x${height}`);
    }

    if (png.data.length !== width * height * 4) {
      console.warn(`[ESC/POS] ⚠ PNG data length mismatch: expected ${width * height * 4}, got ${png.data.length}`);
    }

    // ESC/POS thermal printer: 80mm = 576px width (standard for 80mm printers)
    const PRINTER_WIDTH = 576;
    const BYTES_PER_LINE = Math.ceil(PRINTER_WIDTH / 8); // 72 bytes per line (576/8)
    
    console.log(`[ESC/POS] Printer width: ${PRINTER_WIDTH}px (80mm), bytes per line: ${BYTES_PER_LINE}`);

    const buffers: Buffer[] = [];
    
    // ESC/POS initialization commands
    buffers.push(Buffer.from([0x1b, 0x40])); // ESC @ - Initialize printer (reset)
    buffers.push(Buffer.from([0x1b, 0x61, 0x00])); // ESC a 0 - Left alignment (default)
    buffers.push(Buffer.from([0x1b, 0x33, 0x1e])); // ESC 3 30 - Set line spacing to 30/180 inch

    // Process image in strips (ESC/POS can handle up to 255 lines per command)
    const STRIP_HEIGHT = 255;
    const totalStrips = Math.ceil(height / STRIP_HEIGHT);
    console.log(`[ESC/POS] Processing ${totalStrips} strip(s) of max ${STRIP_HEIGHT} lines each...`);
    
    for (let stripStart = 0; stripStart < height; stripStart += STRIP_HEIGHT) {
      const stripEnd = Math.min(stripStart + STRIP_HEIGHT, height);
      const stripLines = stripEnd - stripStart;
      const stripNum = Math.floor(stripStart / STRIP_HEIGHT) + 1;
      
      if (stripNum === 1 || stripNum % 5 === 0 || stripNum === totalStrips) {
        console.log(`[ESC/POS] Processing strip ${stripNum}/${totalStrips} (lines ${stripStart}-${stripEnd - 1})...`);
      }
      
      // GS v 0 - Print raster graphics (normal density)
      // Format: GS v 0 m xL xH yL yH d1...dk
      // m = 0 (normal mode), xL/xH = width in bytes (little-endian), yL/yH = height in lines (little-endian)
      const stripHeader = Buffer.from([
        0x1d, 0x76, 0x30, // GS v 0
        0x00, // m = 0 (normal mode)
        BYTES_PER_LINE & 0xff, // Width low byte
        (BYTES_PER_LINE >> 8) & 0xff, // Width high byte
        stripLines & 0xff, // Height low byte
        (stripLines >> 8) & 0xff, // Height high byte
      ]);
      buffers.push(stripHeader);
      
      // Convert image data to bitmap - process line by line
      const stripData = Buffer.allocUnsafe(BYTES_PER_LINE * stripLines);
      let stripOffset = 0;
      
      for (let y = stripStart; y < stripEnd; y++) {
        const bitmapLine = Buffer.allocUnsafe(BYTES_PER_LINE);
        bitmapLine.fill(0); // Initialize to white (all bits 0)
        
        for (let x = 0; x < PRINTER_WIDTH && x < width; x++) {
          // Get pixel from PNG data (RGBA format, row-major order)
          // PNG data format: [R, G, B, A, R, G, B, A, ...] per row
          const idx = (y * width + x) * 4;
          
          if (idx >= 0 && idx + 3 < png.data.length) {
            // Get pixel (R, G, B, A)
            const r = png.data[idx] || 0;
            const g = png.data[idx + 1] || 0;
            const b = png.data[idx + 2] || 0;
            const a = png.data[idx + 3] !== undefined ? png.data[idx + 3] : 255;
            
            // Convert to grayscale and check if pixel should be black
            // Consider alpha channel - if transparent, treat as white
            if (a >= 128) {
              // Convert RGB to grayscale using standard weights
              const gray = (r * 0.299 + g * 0.587 + b * 0.114);
              const isBlack = gray < 128; // Threshold for black/white
              
              if (isBlack) {
                // Pack 8 pixels into 1 byte (MSB first, left to right)
                const byteIndex = Math.floor(x / 8);
                const bitIndex = 7 - (x % 8); // MSB is leftmost pixel
                
                if (byteIndex < BYTES_PER_LINE) {
                  bitmapLine[byteIndex] |= 1 << bitIndex;
                }
              }
            }
          }
        }
        
        // Copy bitmap line to strip buffer
        bitmapLine.copy(stripData, stripOffset);
        stripOffset += BYTES_PER_LINE;
      }
      
      buffers.push(stripData);
    }
    
    // Add more feed lines at end (before cutting) - gives printer time to finish printing
    buffers.push(Buffer.from("\n\n\n\n\n", "utf8")); // Five line feeds before cutting for better timing
    
    // Full cut paper command: GS V 0
    buffers.push(Buffer.from([0x1d, 0x56, 0x00])); // GS V 0 - Full cut
    
    const result = Buffer.concat(buffers);
    console.log(`[ESC/POS] ✓ Conversion complete: ${result.length} bytes (${(result.length / 1024).toFixed(2)} KB) ESC/POS commands`);
    console.log(`[ESC/POS] Paper cutting command included (full cut)`);
    
    return result;
  } catch (error: any) {
    console.error('[ESC/POS] ✕ Error converting PNG to ESC/POS:', error);
    console.error('[ESC/POS] Error message:', error.message);
    console.error('[ESC/POS] Error stack:', error.stack);
    throw error;
  }
}

/**
 * Print ESC/POS buffer to LAN printer via TCP socket (port 9100)
 * Ensures all buffers are written before closing socket
 * @param ip - Printer IP address (e.g., "192.168.1.50")
 * @param port - Printer port (default: 9100)
 * @param buffer - ESC/POS command buffer to send
 * @returns Promise<void> - Resolves on success, rejects on error
 */
export async function printToLanPrinter(
  ip: string,
  port: number = 9100,
  buffer: Buffer,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    console.log(`[LAN PRINT] Connecting to printer ${ip}:${port}...`);
    
    if (!ip || ip.trim() === '') {
      reject(new Error('Printer IP address is required'));
      return;
    }

    const socket = new net.Socket();
    let connected = false;
    let allDataWritten = false;
    
    // Set socket options for better reliability
    socket.setNoDelay(true); // Disable Nagle algorithm for faster transmission
    
    // Connection timeout (8 seconds)
    const connectTimeout = setTimeout(() => {
      if (!connected) {
        socket.destroy();
        reject(new Error(`Cannot connect to printer ${ip}:${port} (connection timeout)`));
      }
    }, 8000);
    
    // Data send timeout (15 seconds)
    const sendTimeout = setTimeout(() => {
      if (!allDataWritten) {
        socket.destroy();
        reject(new Error(`Cannot send data to printer ${ip}:${port} (send timeout)`));
      }
    }, 15000);
    
    socket.on('connect', () => {
      connected = true;
      clearTimeout(connectTimeout);
      console.log(`[LAN PRINT] ✓ Connected to ${ip}:${port}`);
      
      // Write all buffer data
      socket.write(buffer, (err) => {
        if (err) {
          clearTimeout(sendTimeout);
          socket.destroy();
          reject(new Error(`Failed to send data to printer ${ip}:${port}: ${err.message}`));
        } else {
          allDataWritten = true;
          console.log(`[LAN PRINT] ✓ All data sent successfully (${buffer.length} bytes)`);
          
          // Wait a bit to ensure all data is flushed, then end connection
          setTimeout(() => {
            clearTimeout(sendTimeout);
            socket.end(); // Close connection gracefully
            console.log(`[LAN PRINT] Connection closed after sending all data`);
          }, 300);
        }
      });
    });
    
    socket.on('close', () => {
      clearTimeout(connectTimeout);
      clearTimeout(sendTimeout);
      if (connected && allDataWritten) {
        console.log(`[LAN PRINT] ✓ Connection closed successfully`);
        resolve();
      } else if (!connected) {
        // Connection was never established, error already handled
      } else {
        // Connection established but data not sent
        if (!allDataWritten) {
          reject(new Error(`Connection to printer ${ip}:${port} closed before all data was sent`));
        } else {
          resolve();
        }
      }
    });
    
    socket.on('error', (err: Error) => {
      clearTimeout(connectTimeout);
      clearTimeout(sendTimeout);
      socket.destroy();
      const errorMsg = err.message.includes('ECONNREFUSED')
        ? `Cannot connect to printer ${ip}:${port} (connection refused - is the printer on and connected to the network?)`
        : `Cannot connect to printer ${ip}:${port}: ${err.message}`;
      reject(new Error(errorMsg));
    });
    
    // Connect to printer
    socket.connect(port, ip);
  });
}

/**
 * Print PNG buffer to LAN thermal printer via TCP
 * @param pngBuffer - PNG image buffer (must be valid, 3-20 KB expected)
 * @param printerIp - Printer IP address (e.g., "192.168.1.50")
 * @param printerPort - Printer port (default: 9100)
 * @returns Promise<boolean> - Success status
 */
export async function printPngToPrinter(
  pngBuffer: Buffer,
  printerIp?: string,
  printerPort: number = 9100,
): Promise<{ success: boolean; error?: string }> {
  console.log('[PRINT] Starting print job...');
  console.log(`[PRINT] PNG buffer size: ${pngBuffer.length} bytes (${(pngBuffer.length / 1024).toFixed(2)} KB)`);
  
  // Defensive checks
  if (!pngBuffer || pngBuffer.length < 100) {
    const errorMsg = `Invalid PNG buffer: ${pngBuffer?.length || 0} bytes`;
    console.error(`[PRINT] ✕ ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  if (!printerIp || printerIp.trim() === '') {
    const errorMsg = 'No printer IP address provided';
    console.error(`[PRINT] ✕ ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  try {
    // Convert PNG buffer to ESC/POS commands (includes paper cutting)
    console.log('[PRINT] Converting PNG to ESC/POS format...');
    const escPosBuffer = pngToEscPos(pngBuffer);
    console.log(`[PRINT] ESC/POS buffer size: ${escPosBuffer.length} bytes (${(escPosBuffer.length / 1024).toFixed(2)} KB)`);

    // Send to LAN printer via TCP - ensure this is properly awaited
    console.log(`[PRINT] Sending to printer ${printerIp}:${printerPort}...`);
    await printToLanPrinter(printerIp, printerPort, escPosBuffer);
    
    // Add delay before cutting to ensure all data is printed
    console.log('[PRINT] Waiting before paper cut...');
    await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
    
    console.log('[PRINT] ✓ Print job completed successfully (paper cut included)');
    return { success: true };
  } catch (error: any) {
    const errorMsg = error?.message || 'Unknown print error';
    console.error('[PRINT] ✕ Print error:', error);
    console.error('[PRINT] Error details:', {
      message: errorMsg,
      stack: error?.stack,
    });
    return { success: false, error: errorMsg };
  }
}

/**
 * Get list of available printers (LAN-based)
 * Returns empty list - printers are configured by IP address in settings
 */
export async function getAvailablePrinters(): Promise<
  Array<{ name: string; isDefault: boolean }>
> {
  // LAN printers are configured by IP address, not discovered
  // Return empty list - frontend will use saved IP addresses from settings
  return [];
}
