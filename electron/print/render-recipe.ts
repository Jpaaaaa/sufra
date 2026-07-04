import { mergeRecipePrintBranding } from '../recipe-print-branding-store';
import type { RecipePrintData } from './render-recipe-types';
import { registerArabicFontIfAvailable, wrapText } from './render-recipe-shared';
import { generateFallbackPng } from './render-recipe-fallback';

export type { RecipePrintData } from './render-recipe-types';

export type RenderRecipeToPngOptions = {
  /** When false (e.g. Settings preview), uses only the passed branding fields. Default true merges saved JSON from disk. */
  mergeBranding?: boolean;
};

/**
 * Render Arabic recipe to PNG for thermal printer
 */
export async function renderRecipeToPng(
  data: RecipePrintData | null | undefined,
  options?: RenderRecipeToPngOptions,
): Promise<Buffer> {
  console.log('[RECIPE] Starting PNG generation...');

  let recipe: RecipePrintData;
  if (!data) {
    console.warn('[RECIPE] No data provided, generating test recipe');
    recipe = {
      name: 'وصفة تجريبية',
      description: 'وصفة تجريبية للطباعة',
      ingredients: [{ name: 'مكون تجريبي', amount: '1', unit: 'كوب' }],
      instructions: [{ step: 1, text: 'خطوة تجريبية' }],
      restaurantName: 'مطعم سفرا لايت',
    };
  } else {
    recipe = data;
  }

  try {
    if (options?.mergeBranding !== false) {
      recipe = await mergeRecipePrintBranding(recipe);
    }

    // @ts-ignore - canvas is a native module, loaded dynamically
    const { createCanvas } = await import('canvas');
    await registerArabicFontIfAvailable();

    const CANVAS_WIDTH = 576;
    const PADDING = 15;
    const LINE_HEIGHT = 38;
    const FONT_SIZE = 28;
    const FONT_SIZE_LARGE = 36;
    const FONT_SIZE_SMALL = 24;
    const FONT_SIZE_TINY = 20;

    const tempCanvas = createCanvas(CANVAS_WIDTH, 100);
    const tempCtx = tempCanvas.getContext('2d');

    const measureTextHeight = (text: string, fontSize: number, bold: boolean = true): number => {
      tempCtx.font = `${bold ? 'bold ' : ''}${fontSize}px Arial, "Arabic", sans-serif`;
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      const maxWidth = CANVAS_WIDTH - PADDING * 2;

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

      return Math.max(1, lines.length) * (fontSize * 1.3);
    };

    let estimatedHeight = PADDING * 2;

    if (recipe.restaurantName) {
      estimatedHeight += measureTextHeight(recipe.restaurantName, FONT_SIZE_SMALL, true) + LINE_HEIGHT;
    }

    estimatedHeight += measureTextHeight(recipe.name, FONT_SIZE_LARGE, true);
    if (recipe.description) {
      estimatedHeight += measureTextHeight(recipe.description, FONT_SIZE_SMALL, false);
    }
    estimatedHeight += LINE_HEIGHT;

    if (recipe.prep_time || recipe.cook_time || recipe.servings || recipe.difficulty) {
      estimatedHeight += LINE_HEIGHT * 2;
    }
    estimatedHeight += LINE_HEIGHT;

    estimatedHeight += LINE_HEIGHT * 1.5;
    recipe.ingredients.forEach((ingredient) => {
      const ingredientText = `${ingredient.name} - ${ingredient.amount}${ingredient.unit ? ' ' + ingredient.unit : ''}`;
      estimatedHeight += measureTextHeight(ingredientText, FONT_SIZE_SMALL, false);
    });
    estimatedHeight += LINE_HEIGHT;

    estimatedHeight += LINE_HEIGHT * 1.5;
    recipe.instructions.forEach((instruction) => {
      const instructionText = `${instruction.step}. ${instruction.text}`;
      estimatedHeight += measureTextHeight(instructionText, FONT_SIZE, false);
    });
    estimatedHeight += LINE_HEIGHT;

    if (recipe.notes) {
      estimatedHeight += LINE_HEIGHT * 1.5;
      estimatedHeight += measureTextHeight(recipe.notes, FONT_SIZE_SMALL, false);
    }

    if (recipe.thankYouLine) {
      estimatedHeight += measureTextHeight(recipe.thankYouLine, FONT_SIZE_TINY, false) + 10;
    }
    if (recipe.mobileNumber) {
      estimatedHeight += measureTextHeight(recipe.mobileNumber, FONT_SIZE_TINY, false) + 10;
    }
    estimatedHeight += LINE_HEIGHT * 2;

    estimatedHeight += 150;
    estimatedHeight = Math.max(600, estimatedHeight);

    console.log(`[RECIPE] Creating canvas: ${CANVAS_WIDTH}x${estimatedHeight}`);

    const canvas = createCanvas(CANVAS_WIDTH, estimatedHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CANVAS_WIDTH, estimatedHeight);

    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'top';

    const drawText = (
      text: string,
      x: number,
      y: number,
      fontSize: number = FONT_SIZE,
      align: 'left' | 'center' | 'right' = 'right',
      bold: boolean = true,
    ): number => {
      ctx.font = `${bold ? 'bold ' : ''}${fontSize}px Arial, "Arabic", sans-serif`;

      const hasArabic = /[\u0600-\u06FF]/.test(text);

      if (hasArabic && align !== 'center') {
        ctx.textAlign = 'right';
        ctx.direction = 'rtl';
        const adjustedX = CANVAS_WIDTH - PADDING;
        const lines = wrapText(ctx, text, CANVAS_WIDTH - PADDING * 2);
        lines.forEach((line, idx) => {
          ctx.fillText(line, adjustedX, y + idx * (fontSize * 1.3));
        });
        return lines.length;
      } else {
        ctx.textAlign = align;
        ctx.direction = 'ltr';
        const lines = wrapText(ctx, text, CANVAS_WIDTH - PADDING * 2 - (align === 'right' ? 0 : x));
        lines.forEach((line, idx) => {
          ctx.fillText(line, x, y + idx * (fontSize * 1.3));
        });
        return lines.length;
      }
    };

    const drawSeparator = (y: number, style: 'single' | 'double' = 'single') => {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = style === 'double' ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(PADDING, y);
      ctx.lineTo(CANVAS_WIDTH - PADDING, y);
      ctx.stroke();
      if (style === 'double') {
        ctx.beginPath();
        ctx.moveTo(PADDING, y + 3);
        ctx.lineTo(CANVAS_WIDTH - PADDING, y + 3);
        ctx.stroke();
      }
    };

    let yPos = PADDING;

    if (recipe.restaurantName) {
      const lines = drawText(recipe.restaurantName, CANVAS_WIDTH / 2, yPos, FONT_SIZE_SMALL, 'center', true);
      yPos += lines * (FONT_SIZE_SMALL * 1.3) + 5;
      drawSeparator(yPos, 'double');
      yPos += 10;
    }

    const nameLines = drawText(recipe.name, CANVAS_WIDTH / 2, yPos, FONT_SIZE_LARGE, 'center', true);
    yPos += nameLines * (FONT_SIZE_LARGE * 1.3) + 8;

    if (recipe.description) {
      const descLines = drawText(recipe.description, CANVAS_WIDTH / 2, yPos, FONT_SIZE_SMALL, 'center', false);
      yPos += descLines * (FONT_SIZE_SMALL * 1.3) + 8;
    }

    drawSeparator(yPos);
    yPos += 12;

    if (recipe.prep_time || recipe.cook_time || recipe.servings || recipe.difficulty) {
      const metaItems: string[] = [];
      if (recipe.prep_time) metaItems.push(`⏱️ التحضير: ${recipe.prep_time} دقيقة`);
      if (recipe.cook_time) metaItems.push(`🔥 الطبخ: ${recipe.cook_time} دقيقة`);
      if (recipe.servings) metaItems.push(`👥 الحصص: ${recipe.servings}`);
      if (recipe.difficulty) {
        const difficultyIcon = recipe.difficulty === 'سهل' ? '🟢' : recipe.difficulty === 'متوسط' ? '🟡' : '🔴';
        metaItems.push(`${difficultyIcon} الصعوبة: ${recipe.difficulty}`);
      }

      metaItems.forEach((item) => {
        const lines = drawText(item, CANVAS_WIDTH - PADDING, yPos, FONT_SIZE_TINY, 'right', false);
        yPos += lines * (FONT_SIZE_TINY * 1.3) + 3;
      });

      yPos += 5;
      drawSeparator(yPos);
      yPos += 12;
    }

    drawText('📋 المكونات', CANVAS_WIDTH - PADDING, yPos, FONT_SIZE, 'right', true);
    yPos += LINE_HEIGHT * 1.5;

    recipe.ingredients.forEach((ingredient) => {
      const ingredientText = `• ${ingredient.name}${ingredient.amount ? ` - ${ingredient.amount}${ingredient.unit ? ' ' + ingredient.unit : ''}` : ''}`;
      const lines = drawText(ingredientText, CANVAS_WIDTH - PADDING, yPos, FONT_SIZE_SMALL, 'right', false);
      yPos += lines * (FONT_SIZE_SMALL * 1.3) + 4;
    });

    yPos += 5;
    drawSeparator(yPos);
    yPos += 12;

    drawText('👨‍🍳 طريقة التحضير', CANVAS_WIDTH - PADDING, yPos, FONT_SIZE, 'right', true);
    yPos += LINE_HEIGHT * 1.5;

    recipe.instructions.forEach((instruction, index) => {
      const stepText = `${instruction.step || index + 1}. ${instruction.text}`;
      const lines = drawText(stepText, CANVAS_WIDTH - PADDING, yPos, FONT_SIZE_SMALL, 'right', false);
      yPos += lines * (FONT_SIZE_SMALL * 1.3) + 6;
    });

    yPos += 5;
    drawSeparator(yPos);
    yPos += 12;

    if (recipe.notes) {
      drawText('💡 ملاحظات', CANVAS_WIDTH - PADDING, yPos, FONT_SIZE_SMALL, 'right', true);
      yPos += LINE_HEIGHT * 1.2;
      const notesLines = drawText(recipe.notes, CANVAS_WIDTH - PADDING, yPos, FONT_SIZE_TINY, 'right', false);
      yPos += notesLines * (FONT_SIZE_TINY * 1.3) + 8;
      drawSeparator(yPos);
      yPos += 12;
    }

    yPos += 5;
    if (recipe.thankYouLine) {
      const tLines = drawText(recipe.thankYouLine, CANVAS_WIDTH / 2, yPos, FONT_SIZE_TINY, 'center', false);
      yPos += tLines * (FONT_SIZE_TINY * 1.3) + 6;
    }
    if (recipe.mobileNumber) {
      const phoneLabel = `📞 ${recipe.mobileNumber}`;
      const mLines = drawText(phoneLabel, CANVAS_WIDTH / 2, yPos, FONT_SIZE_TINY, 'center', false);
      yPos += mLines * (FONT_SIZE_TINY * 1.3) + 6;
    }

    const dateStr = new Date().toLocaleDateString('ar-IQ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    drawText(`تم الطباعة: ${dateStr}`, CANVAS_WIDTH / 2, yPos, FONT_SIZE_TINY, 'center', false);

    console.log('[RECIPE] Converting canvas to PNG...');
    const pngBuffer = canvas.toBuffer('image/png');

    console.log(`[RECIPE] ✓ PNG generated: ${pngBuffer.length} bytes (${(pngBuffer.length / 1024).toFixed(2)} KB)`);

    if (pngBuffer.length < 1000) {
      console.error(`[RECIPE] ✕ PNG too small: ${pngBuffer.length} bytes`);
      throw new Error(`PNG generation failed: output too small (${pngBuffer.length} bytes)`);
    }

    return pngBuffer;
  } catch (error: any) {
    console.error('[RECIPE] ✕ Error generating PNG:', error);
    console.error('[RECIPE] Error stack:', error.stack);
    return await generateFallbackPng();
  }
}
