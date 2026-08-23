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
import { HomepageYoutubeHero } from './homepage-youtube-hero';

type HomepageHeroMediaProps = {
  slides?: HomepageHeroSlide[] | null | undefined;
  desktopUrl?: string | null | undefined;
  mobileUrl?: string | null | undefined;
  isPhone?: boolean | undefined;
  fallbackSource: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
};

const SLIDE_INTERVAL_MS = 6_500;

export function HomepageHeroMedia({
  slides,
  desktopUrl,
  mobileUrl,
  isPhone = false,
  fallbackSource,
  style,
}: HomepageHeroMediaProps) {
  const heroSlides = slides ?? [];

  // Do not mount the YouTube component or its poster while an image slider is active.
  // The slider prefetches its own responsive assets so an old fallback image never
  // flashes underneath a newly configured Supabase slide.
  if (heroSlides.length > 0) {
    return <HomepageHeroSlider isPhone={isPhone} slides={heroSlides} style={style} />;
  }

  return (
    <HomepageYoutubeHero
      desktopUrl={desktopUrl}
      fallbackSource={fallbackSource}
      isPhone={isPhone}
      mobileUrl={mobileUrl}
      style={style}
    />
  );
}

function HomepageHeroSlider({
  slides,
  isPhone,
  style,
}: {
  slides: HomepageHeroSlide[];
  isPhone: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const slidesKey = useMemo(() => slides.map((slide) => slide.id).join(':'), [slides]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [slidesKey]);

  useEffect(() => {
    const responsiveUrls = slides
      .map((slide) => (isPhone ? slide.mobile_url : slide.desktop_url))
      .filter((url): url is string => Boolean(url));

    for (const url of responsiveUrls) {
      void Image.prefetch(url).catch(() => undefined);
    }
  }, [isPhone, slides]);

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
    void Image.prefetch(nextUrl).catch(() => undefined);
  }, [activeIndex, isPhone, slides]);

  return (
    <View pointerEvents="none" style={[styles.frame, style]} testID="chon-homepage-hero-slider">
      {activeUrl ? (
        <Image
          accessibilityLabel={`Ảnh giới thiệu Chọn.love ${activeIndex + 1}`}
          fadeDuration={0}
          resizeMode="cover"
          source={{ uri: activeUrl, cache: 'force-cache' }}
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
