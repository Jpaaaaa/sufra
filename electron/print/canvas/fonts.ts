import * as fs from 'fs';
import * as path from 'path';

let registered = false;

/**
 * Register an Arabic-capable font once for node-canvas.
 */
export async function registerArabicFontIfAvailable(): Promise<void> {
  if (registered) return;
  try {
    // @ts-ignore - canvas is a native module
    const { registerFont } = await import('canvas');
    const fontPaths = [
      path.join(__dirname, '../../fonts/arial.ttf'),
      path.join(__dirname, '../../fonts/Arial.ttf'),
      path.join(__dirname, '../fonts/arial.ttf'),
      'C:/Windows/Fonts/arial.ttf',
      'C:/Windows/Fonts/tahoma.ttf',
      'C:/Windows/Fonts/segoeui.ttf',
    ];

    for (const fontPath of fontPaths) {
      if (fs.existsSync(fontPath)) {
        try {
          registerFont(fontPath, { family: 'Arabic' });
          registered = true;
          console.log(`[PRINT] Registered Arabic font: ${fontPath}`);
          return;
        } catch (e) {
          console.warn(`[PRINT] Failed to register font ${fontPath}:`, e);
        }
      }
    }
    console.log('[PRINT] No Arabic font found, using system default');
  } catch (e) {
    console.warn('[PRINT] Error registering Arabic font:', e);
  }
}

export function printFont(size: number, bold = false): string {
  return `${bold ? 'bold ' : ''}${size}px Arial, "Arabic", Tahoma, sans-serif`;
}
