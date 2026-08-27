import type { HomepageHeroSlide } from '@myfan/supabase';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { HomepageHeroImage } from './homepage-hero-image';
import { HomepageYoutubeHero } from './homepage-youtube-hero';

type HomepageHeroMediaProps = {
  slides?: HomepageHeroSlide[] | null | undefined;
  desktopUrl?: string | null | undefined;
  mobileUrl?: string | null | undefined;
  isPhone?: boolean | undefined;
  fallbackSource: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
};

type CachedHomepageHero = {
  savedAt: number;
  slides: HomepageHeroSlide[];
  desktopUrl: string | null;
  mobileUrl: string | null;
};

const SLIDE_INTERVAL_MS = 6_500;
const HERO_CACHE_KEY = 'chon.homepage.hero.v1';
const HERO_CACHE_MAX_AGE_MS = 24 * 60 * 60_000;
const HERO_MAX_SLIDES = 8;

function getWebStorage(): Storage | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

function isHttpsUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('https://');
}

function normalizeCachedHero(value: unknown): CachedHomepageHero | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<CachedHomepageHero>;
  if (typeof row.savedAt !== 'number' || !Number.isFinite(row.savedAt)) return null;
  if (Date.now() - row.savedAt > HERO_CACHE_MAX_AGE_MS || row.savedAt > Date.now() + 60_000) return null;
  if (!Array.isArray(row.slides) || row.slides.length > HERO_MAX_SLIDES) return null;

  const slides = row.slides.filter((slide): slide is HomepageHeroSlide => (
    Boolean(slide) &&
    typeof slide.id === 'string' &&
    isHttpsUrl(slide.desktop_url) &&
    isHttpsUrl(slide.mobile_url)
  ));
  if (slides.length !== row.slides.length) return null;

  const desktopUrl = row.desktopUrl == null ? null : isHttpsUrl(row.desktopUrl) ? row.desktopUrl : null;
  const mobileUrl = row.mobileUrl == null ? null : isHttpsUrl(row.mobileUrl) ? row.mobileUrl : null;
  return { savedAt: row.savedAt, slides, desktopUrl, mobileUrl };
}

function readCachedHomepageHero(): CachedHomepageHero | null {
  const storage = getWebStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(HERO_CACHE_KEY);
    if (!raw) return null;
    const cached = normalizeCachedHero(JSON.parse(raw));
    if (!cached) storage.removeItem(HERO_CACHE_KEY);
    return cached;
  } catch {
    try {
      storage.removeItem(HERO_CACHE_KEY);
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
    return null;
  }
}

function writeCachedHomepageHero(input: Omit<CachedHomepageHero, 'savedAt'>): void {
  const storage = getWebStorage();
  if (!storage) return;
  try {
    storage.setItem(HERO_CACHE_KEY, JSON.stringify({ ...input, savedAt: Date.now() }));
  } catch {
    // Homepage remains fully functional when storage quota/privacy settings deny writes.
  }
}

export function HomepageHeroMedia({
  slides,
  desktopUrl,
  mobileUrl,
  isPhone = false,
  fallbackSource,
  style,
}: HomepageHeroMediaProps) {
  const [cachedHero, setCachedHero] = useState<CachedHomepageHero | null>(null);

  useEffect(() => {
    const cached = readCachedHomepageHero();
    if (!cached) return;
    const firstSlide = cached.slides[0];
    const firstUrl = firstSlide ? (isPhone ? firstSlide.mobile_url : firstSlide.desktop_url) : null;
    if (firstUrl) void Image.prefetch(firstUrl).catch(() => undefined);
    setCachedHero(cached);
  }, [isPhone]);

  const settingsResolved = slides !== undefined || desktopUrl !== undefined || mobileUrl !== undefined;
  useEffect(() => {
    if (!settingsResolved) return;
    writeCachedHomepageHero({
      slides: slides ?? [],
      desktopUrl: desktopUrl ?? null,
      mobileUrl: mobileUrl ?? null,
    });
  }, [desktopUrl, mobileUrl, settingsResolved, slides]);

  // `undefined` means the settings RPC has not resolved yet, so a fresh local cache
  // may bridge the network round trip. Once the RPC resolves, even an empty slider
  // or null YouTube URL must replace stale cached configuration immediately.
  const heroSlides = slides === undefined ? cachedHero?.slides ?? [] : slides ?? [];
  const resolvedDesktopUrl = desktopUrl === undefined ? cachedHero?.desktopUrl ?? null : desktopUrl;
  const resolvedMobileUrl = mobileUrl === undefined ? cachedHero?.mobileUrl ?? null : mobileUrl;

  // Do not mount YouTube while an image slider is active. The slider keeps the
  // bundled fallback underneath the network image so cold loads never show a blank
  // hero, while a warm cached slider can start before the settings RPC returns.
  if (heroSlides.length > 0) {
    return (
      <HomepageHeroSlider
        fallbackSource={fallbackSource}
        isPhone={isPhone}
        slides={heroSlides}
        style={style}
      />
    );
  }

  return (
    <HomepageYoutubeHero
      desktopUrl={resolvedDesktopUrl}
      fallbackSource={fallbackSource}
      isPhone={isPhone}
      mobileUrl={resolvedMobileUrl}
      style={style}
    />
  );
}

function HomepageHeroSlider({
  slides,
  isPhone,
  fallbackSource,
  style,
}: {
  slides: HomepageHeroSlide[];
  isPhone: boolean;
  fallbackSource: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
}) {
  const slidesKey = useMemo(() => slides.map((slide) => slide.id).join(':'), [slides]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [slidesKey]);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [slides.length, slidesKey]);

  const activeSlide = slides[activeIndex] ?? slides[0];
  const activeUrl = activeSlide
    ? (isPhone ? activeSlide.mobile_url : activeSlide.desktop_url)
    : null;

  useEffect(() => {
    if (slides.length < 2) return;
    const nextSlide = slides[(activeIndex + 1) % slides.length];
    if (!nextSlide) return;
    const nextUrl = isPhone ? nextSlide.mobile_url : nextSlide.desktop_url;
    if (!nextUrl) return;
    void Image.prefetch(nextUrl).catch(() => undefined);
  }, [activeIndex, isPhone, slides]);

  return (
    <View pointerEvents="none" style={[styles.frame, style]} testID="chon-homepage-hero-slider">
      <Image
        accessibilityIgnoresInvertColors
        fadeDuration={0}
        resizeMode="cover"
        source={fallbackSource}
        style={StyleSheet.absoluteFill}
        testID="chon-homepage-hero-fallback-image"
      />
      {activeUrl ? (
        <HomepageHeroImage
          accessibilityLabel={`Ảnh giới thiệu Chọn.love ${activeIndex + 1}`}
          uri={activeUrl}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {slides.length > 1 ? (
        <View accessibilityElementsHidden style={styles.dots}>
          {slides.map((slide, index) => (
            <View key={slide.id} style={[styles.dot, index === activeIndex && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  dots: {
    alignItems: 'center',
    bottom: 18,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  dot: {
    backgroundColor: 'rgba(255,255,255,0.52)',
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 20,
  },
});
