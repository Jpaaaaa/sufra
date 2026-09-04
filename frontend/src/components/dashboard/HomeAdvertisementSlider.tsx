'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react';
import type { HomeAd } from '../../types/homeAds';
import { useHomeAds } from '../../hooks/useHomeAds';
import { homeUi } from './home-ui';

const AUTOPLAY_MS = 6000;
const AMAAN_LOGO = './logo/amaan.png';

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

function BrandPanel() {
  const { t } = useTranslation();

  return (
    <aside className="flex w-full shrink-0 flex-col justify-center gap-3 px-4 py-3 sm:w-[200px] sm:px-3 md:w-[230px] lg:w-[260px] lg:pe-2 lg:ps-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <img
          src={AMAAN_LOGO}
          alt={t('home.adsBrandName')}
          className="h-16 w-auto flex-shrink-0 object-contain sm:h-[4.5rem] md:h-20"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <p className="text-[14px] font-semibold tracking-tight text-obsidian sm:text-[15px]">
          {t('home.adsBrandName')}
        </p>
        <p className="max-w-[15rem] text-[12px] font-medium leading-relaxed text-obsidian/55 sm:text-[13px]">
          {t('home.adsBrandTagline')}
        </p>
      </div>

      <div className="min-w-0 border-t border-obsidian/10 pt-3 text-center">
        <h2 className={`${homeUi.sectionTitle} inline-flex items-center justify-center gap-2`}>
          <Megaphone className="h-4 w-4 flex-shrink-0 text-[#0066FF]" aria-hidden />
          <span>{t('home.adsSectionTitle')}</span>
        </h2>
        <p className="mt-0.5 text-[12px] font-medium text-obsidian/60">{t('home.adsSectionLede')}</p>
      </div>
    </aside>
  );
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
        className="w-full bg-gradient-to-br from-[#0066FF]/18 via-[#0066FF]/10 to-[#0066FF]/06 py-5 md:py-6"
        aria-label={t('home.adsCarouselLabel')}
        aria-busy="true"
      >
        <div className="flex w-full flex-col items-stretch gap-3 px-3 md:px-4 lg:px-5">
          <BrandPanel />
          <div className="h-[210px] min-w-0 flex-1 rounded-2xl border-2 border-[#0066FF]/35 bg-white/40 sm:h-[230px] md:h-[260px]" />
        </div>
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
      className="w-full bg-gradient-to-br from-[#0066FF]/20 via-[#0066FF]/12 to-[#0066FF]/07 py-5 md:py-6"
      aria-label={t('home.adsCarouselLabel')}
    >
      {/* Wide band: brand near sidebar → slider with matching rounded corners */}
      <div className="flex w-full flex-col items-stretch gap-3 px-3 sm:flex-row sm:gap-3 md:px-4 lg:px-5">
        <BrandPanel />

        <div
          className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border-2 border-[#0066FF]/40 bg-white shadow-[0_8px_28px_rgba(0,102,255,0.16)]"
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
                    className="inline-flex items-center rounded-lg bg-[#0066FF] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#0066FF]/90"
                  >
                    {current.ctaLabel || t('home.adsCtaDefault')}
                  </button>
                </div>
              </div>
            ) : null}

            {/* Prev / dots / next — one control cluster */}
            <div className="absolute bottom-3 start-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/35 px-1.5 py-1 backdrop-blur-sm">
              <button
                type="button"
                onClick={goPrev}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white hover:bg-white/15"
                aria-label={t('home.adsPrev')}
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              </button>

              <div className="flex items-center gap-1.5 px-0.5">
                {Array.from({ length: slideCount }, (_, i) => {
                  const ad = ads[i];
                  const key = ad?.id ?? `dot-${i}`;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setIndex(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === index ? 'w-5 bg-[#0066FF]' : 'w-1.5 bg-white/50 hover:bg-white/80'
                      }`}
                      aria-label={t('home.adsGoTo', { n: i + 1 })}
                      aria-current={i === index}
                    />
                  );
                })}
              </div>

              <button
                type="button"
                onClick={goNext}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white hover:bg-white/15"
                aria-label={t('home.adsNext')}
              >
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(HomeAdvertisementSlider);
