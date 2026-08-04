'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { HomeAd } from '../../types/homeAds';
import { useHomeAds } from '../../hooks/useHomeAds';
import { APP_BRAND_NAME } from '../../lib/brand';
import { homeUi } from './home-ui';

const AUTOPLAY_MS = 6000;
const SUFRA_LOGO = './logo/logo.png';

async function openAdLink(ad: HomeAd, navigate: ReturnType<typeof useNavigate>) {
  if (ad.linkTarget === 'internal') {
    navigate(ad.linkUrl);
    return;
  }
  const url = ad.linkUrl?.trim();
  if (!url) return;

  const openExternal = window.sufra?.support?.openExternalUrl;
  if (typeof openExternal === 'function') {
    try {
      const res = await openExternal(url);
      if (!res.ok) {
        console.error('[HomeAd] openExternalUrl failed:', res.error);
      }
      return;
    } catch (e) {
      console.error('[HomeAd] openExternalUrl error:', e);
    }
  }

  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    // ignore
  }
}

function HomeAdvertisementSlider() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ads, isLoading } = useHomeAds();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = ads.length;

  useEffect(() => {
    setIndex(0);
  }, [count]);

  useEffect(() => {
    if (count <= 1 || paused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [count, paused]);

  const goPrev = useCallback(() => {
    if (count === 0) return;
    setIndex((i) => (i - 1 + count) % count);
  }, [count]);

  const goNext = useCallback(() => {
    if (count === 0) return;
    setIndex((i) => (i + 1) % count);
  }, [count]);

  if (isLoading && count === 0) {
    return (
      <section
        className="w-full bg-gradient-to-br from-cyber-aqua/45 via-cyber-aqua/25 to-cyber-aqua/15 py-6 md:py-8"
        aria-label={t('home.adsCarouselLabel')}
        aria-busy="true"
      >
        <div className="mx-auto h-[210px] w-full max-w-7xl rounded-2xl border-2 border-cyber-aqua/50 bg-white/40 px-4 md:px-5 lg:px-6 sm:h-[230px] md:h-[260px]" />
      </section>
    );
  }

  if (count === 0) {
    return null;
  }

  const current = ads[index] ?? ads[0];
  const imageOnly = !!current.imageOnly;
  const slideCount = Math.max(count, 1);

  return (
    <section
      className="w-full bg-gradient-to-br from-cyber-aqua/50 via-cyber-aqua/28 to-cyber-aqua/16 py-6 md:py-8"
      aria-label={t('home.adsCarouselLabel')}
    >
      {/* Aligned with dashboard content width (max-w-7xl) */}
      <div className="mx-auto w-full max-w-7xl px-4 md:px-5 lg:px-6">
        <div className="mb-3 flex items-center justify-center gap-2.5 text-center sm:justify-start sm:text-start">
          <img
            src={SUFRA_LOGO}
            alt={APP_BRAND_NAME}
            className="h-8 w-8 flex-shrink-0 rounded-md bg-white/90 object-contain p-0.5 shadow-sm"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h2 className="text-[15px] font-semibold tracking-tight text-obsidian">
                {t('home.adsSectionTitle')}
              </h2>
              <span className={`${homeUi.chip} border-cyber-aqua/50 bg-white/90 text-charcoal-graphite`}>
                {t('home.adsSponsoredBadge')}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] font-medium text-obsidian/60">
              {t('home.adsSectionLede')}
            </p>
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-2xl border-2 border-cyber-aqua/55 bg-white shadow-[0_8px_28px_rgba(46,231,201,0.22)]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          aria-roledescription="carousel"
        >
          <div className="relative h-[210px] w-full bg-[#f3f6f8] sm:h-[230px] md:h-[260px]">
            {ads.map((ad, i) => (
              <div
                key={ad.id}
                className={`home-ad-slide absolute inset-0 ${i === index ? 'is-active' : ''}`}
                aria-hidden={i !== index}
              >
                {ad.imageOnly ? (
                  <button
                    type="button"
                    onClick={() => void openAdLink(ad, navigate)}
                    className="absolute inset-0 block h-full w-full cursor-pointer border-0 bg-transparent p-0"
                    aria-label={t('home.adsCtaDefault')}
                  >
                    <img
                      src={ad.imageUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover object-center"
                    />
                  </button>
                ) : (
                  <>
                    <img
                      src={ad.imageUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />
                  </>
                )}
              </div>
            ))}

            {!imageOnly ? (
              <div className="absolute inset-0 z-10 flex flex-col justify-center px-7 py-5 sm:px-10">
                <h3 className="max-w-lg text-[24px] font-semibold leading-tight tracking-tight text-white sm:text-[28px]">
                  {current.title}
                </h3>
                {current.subtitle ? (
                  <p className="mt-1.5 max-w-md text-[13px] font-medium leading-relaxed text-white/75">
                    {current.subtitle}
                  </p>
                ) : null}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => void openAdLink(current, navigate)}
                    className="inline-flex items-center rounded-lg bg-cyber-aqua px-4 py-2 text-[13px] font-semibold text-charcoal-graphite hover:bg-cyber-aqua/90"
                  >
                    {current.ctaLabel || t('home.adsCtaDefault')}
                  </button>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={goPrev}
              className="absolute start-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-md backdrop-blur-sm hover:bg-black/60"
              aria-label={t('home.adsPrev')}
            >
              <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="absolute end-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-md backdrop-blur-sm hover:bg-black/60"
              aria-label={t('home.adsNext')}
            >
              <ChevronRight className="h-5 w-5 rtl:rotate-180" />
            </button>

            <div className="absolute bottom-3 start-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1.5 backdrop-blur-sm">
              {Array.from({ length: slideCount }, (_, i) => {
                const ad = ads[i];
                const key = ad?.id ?? `dot-${i}`;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === index ? 'w-5 bg-cyber-aqua' : 'w-1.5 bg-white/50 hover:bg-white/80'
                    }`}
                    aria-label={t('home.adsGoTo', { n: i + 1 })}
                    aria-current={i === index}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(HomeAdvertisementSlider);
