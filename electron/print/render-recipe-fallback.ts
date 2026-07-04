export async function generateFallbackPng(): Promise<Buffer> {
  // @ts-ignore - canvas is a native module, loaded dynamically
  const { createCanvas } = await import('canvas');
  const canvas = createCanvas(576, 200);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 576, 200);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.fillText('وصفة تجريبية', 288, 80);
  ctx.font = '14px Arial';
  ctx.fillText('Recipe print working', 288, 120);
  return canvas.toBuffer('image/png');
}
