import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const LOGO_SRC = `${import.meta.env.BASE_URL}logo/logo.png`;

function knockoutBlack(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(src);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = image.data;
      let minX = canvas.width;
      let minY = canvas.height;
      let maxX = 0;
      let maxY = 0;
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const i = (y * canvas.width + x) * 4;
          if (px[i] < 48 && px[i + 1] < 48 && px[i + 2] < 48) {
            px[i + 3] = 0;
          }
          if (px[i + 3] > 16) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      ctx.putImageData(image, 0, 0);
      const pad = 4;
      const cropX = Math.max(0, minX - pad);
      const cropY = Math.max(0, minY - pad);
      const cropW = Math.min(canvas.width - cropX, maxX - minX + 1 + pad * 2);
      const cropH = Math.min(canvas.height - cropY, maxY - minY + 1 + pad * 2);
      if (cropW > 0 && cropH > 0 && maxX > minX) {
        const trimmed = document.createElement('canvas');
        trimmed.width = cropW;
        trimmed.height = cropH;
        const tctx = trimmed.getContext('2d');
        if (tctx) {
          tctx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          resolve(trimmed.toDataURL('image/png'));
          return;
        }
      }
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('logo load failed'));
    img.src = src;
  });
}

function BrandMark({ className = 'h-11 w-11' }: { className?: string }) {
  const { t } = useTranslation();
  const [logoSrc, setLogoSrc] = useState(LOGO_SRC);

  useEffect(() => {
    let cancelled = false;
    knockoutBlack(LOGO_SRC)
      .then((url) => {
        if (!cancelled) setLogoSrc(url);
      })
      .catch(() => {
        if (!cancelled) setLogoSrc(LOGO_SRC);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-cyber-aqua/15 ring-1 ring-cyber-aqua/30 ${className}`}
    >
      <img src={logoSrc} alt={t('layout.logoAlt')} className="h-full w-full object-contain p-0.5" />
    </div>
  );
}

export default memo(BrandMark);
