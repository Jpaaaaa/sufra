import * as fs from 'fs';
import * as path from 'path';

export async function registerArabicFontIfAvailable(): Promise<void> {
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
          console.log(`[RECIPE] Registered Arabic font: ${fontPath}`);
          return;
        } catch (e) {
          console.warn(`[RECIPE] Failed to register font ${fontPath}:`, e);
        }
      }
    }
    console.log('[RECIPE] No Arabic font found, using system default');
  } catch (e) {
    console.warn('[RECIPE] Error registering Arabic font:', e);
  }
}

export function wrapText(ctx: { measureText: (s: string) => { width: number } }, text: string, maxWidth: number): string[] {
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
