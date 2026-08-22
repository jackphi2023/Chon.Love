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
  slides?: HomepageHeroSlide[] | null;
  desktopUrl?: string | null;
  mobileUrl?: string | null;
  isPhone?: boolean;
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

  // Do not mount the YouTube component at all while an image slider is active.
  // This prevents poster/player/network work from competing with first paint.
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
    void Image.prefetch(nextUrl).catch(() => undefined);
  }, [activeIndex, isPhone, slides]);

  return (
    <View pointerEvents="none" style={[styles.frame, style]} testID="chon-homepage-hero-slider">
      <Image accessibilityElementsHidden resizeMode="cover" source={fallbackSource} style={StyleSheet.absoluteFill} />
      {activeUrl ? (
        <Image
          accessibilityLabel={`Ảnh giới thiệu Chọn.love ${activeIndex + 1}`}
          resizeMode="cover"
          source={{ uri: activeUrl }}
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
    backgroundColor: '#090909',
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
