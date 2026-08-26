import {
  getPublicHomepageSettings,
  publicHomepageQueryKeys,
  type HomepageSettings,
} from '@myfan/supabase';
import { chonColors, chonShadows, chonTypography, luxyColors, luxyRadii } from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { ChonLoveLogo } from '@/components/chon-love-logo';
import { HomepageHeroMedia } from '@/components/homepage-hero-media';
import { luxyPublicArtwork } from '@/components/luxy-public-artwork';
import { PublicFooter, PublicHeader } from '@/components/public-site-chrome';
import { getAuthenticatedDestination } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const CHON_RED = chonColors.primaryRed;
const CHON_GOLD = chonColors.gold;
const CHON_PINK = chonColors.warmSurface;
const CHON_BLACK = chonColors.text;

const testimonials = [
  {
    quote:
      'Chọn.love thực sự mang lại cho tôi một trải nghiệm hẹn hò khác biệt và thật hơn so với tất cả web, app hay mạng xã hội khác vốn rất nhiều tài khoản ảo. Tôi cũng không muốn lãng phí thời gian vào việc cứ mãi lướt màn hình cả ngày mà chẳng thể kết nối được với ai. Tôi đã gặp gỡ rất nhiều người phụ nữ tuyệt vời ở Chọn.love và thực sự chất lượng ở đây vượt trội hơn hẳn so với những nơi khác. Nếu bạn muốn gặp gỡ những người phụ nữ xinh đẹp, có mục tiêu sống rõ ràng và biết cách trò chuyện cuốn hút, hãy tạm biệt các ứng dụng thông thường và tham gia Chọn.love ngay.',
    name: 'Steven Nguyễn',
    place: 'Tp HCM',
  },
  {
    quote:
      'Chọn.love đã thay đổi cuộc đời tôi theo những cách mà tôi chưa từng nghĩ là có thể. Thông qua nền tảng này, tôi học được cách ưu tiên bản thân và những nhu cầu của mình, giúp tôi tiếp cận việc hẹn hò với một mục đích và định hướng rõ ràng hơn. Nhờ đó, tôi đã kết nối được với những người đàn ông đẳng cấp, những người không chỉ truyền cảm hứng mà còn tích cực ủng hộ các mục tiêu và hoài bão của tôi.',
    name: 'Thanh Hiền',
    place: 'Tp HCM',
  },
  {
    quote:
      'Nếu không có Chọn.love, tôi sẽ chẳng bao giờ được đặt chân đến một nửa số địa điểm tuyệt vời mà tôi đã cùng người ấy ghé thăm. Chúng tôi kết nối với nhau nhờ niềm đam mê khám phá các nền văn hóa mới và tình yêu dành cho những chuyến phiêu lưu; ngay trong buổi hẹn đầu tiên, cả hai đã cùng bay đến gặp nhau. Tôi cũng muốn nói thêm rằng, cuộc sống sẽ tuyệt vời hơn biết bao khi bạn được bay cùng người đàn ông trong mộng của mình.',
    name: 'Hải Yến',
    place: 'Tp HCM',
  },
] as const;

const benefits = [
  {
    title: 'Kết nối chất lượng',
    copy: 'Không cần phải lướt tìm vô định hay sợ gặp người “ảo”. Hãy kết nối với những thành viên thật và xứng đáng với thời gian của bạn—những người sẵn sàng gặp gỡ với cùng sự rõ ràng, nỗ lực và năng lượng mà bạn mang đến.',
  },
  {
    title: 'Hẹn hò có định hướng rõ ràng',
    copy: 'Bạn có tầm nhìn rõ ràng về cuộc sống mà mình đang xây dựng và đang tìm kiếm một người mang lại vẻ đẹp, sự hứng khởi cũng như chiều sâu cho hành trình đó. Bạn bị thu hút bởi sự tự tin, tham vọng và phong thái ấn tượng. Với những tiêu chuẩn cao như thế, chỉ có một nơi được thiết kế để đáp ứng chúng: Chọn.love.',
  },
  {
    title: 'Khẳng định Đẳng cấp',
    copy: 'Thành viên có thể nâng cấp các nhận diện Cao cấp, Kim cương để khẳng định khả năng tài chính và hình ảnh đẳng cấp của cá nhân. Thành viên cũng có thể tặng nhiều phần quà giá trị cho người bạn yêu thích để tạo thiện cảm với đối phương, giúp xây dựng nền tảng cảm xúc hẹn hò ban đầu.',
  },
  {
    title: 'Gặp gỡ người thực sự thấu hiểu',
    copy: 'Các thành viên của Chọn.love hội tụ đầy đủ các yếu tố: thông minh, cầu tiến và nghiêm túc trong các mối quan hệ. Tại đây, việc tìm thấy một người có cùng tư duy và sẵn sàng mở rộng thế giới của bạn không phải là điều xa vời; đó là tiêu chuẩn cơ bản.',
  },
  {
    title: 'Nâng tầm cuộc sống của bạn',
    copy: 'Một mối quan hệ đúng nghĩa sẽ nâng tầm mọi khía cạnh trong cuộc sống. Khi tìm được người mang lại giá trị, thấu hiểu tầm nhìn và cùng bạn xây dựng cuộc sống hằng mơ ước, mọi thứ sẽ trở nên sống động và trọn vẹn hơn.',
  },
] as const;

const cultureItems = [
  'Hẹn hò xác thực thành viên.',
  'Hướng tới những mối quan hệ thực sự.',
  'Tôn trọng lẫn nhau.',
  'Tận hưởng sự chú ý và nổi bật.',
  'Không giao dịch tài chính để đổi lấy sự đồng hành.',
] as const;

function remoteOrFallback(value: string | null | undefined, fallback: ImageSourcePropType): ImageSourcePropType {
  return value ? { uri: value } : fallback;
}

export default function HomeScreen() {
  const router = useRouter();
  const client = getMobileSupabaseClient();
  const { width } = useWindowDimensions();
  const { userId, isRestoring } = useAuth();
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const [hoveredControl, setHoveredControl] = useState<string | null>(null);
  const isPhone = width < 768;
  const isDesktop = width >= 1024;

  const settingsQuery = useQuery({
    queryKey: publicHomepageQueryKeys.settings,
    enabled: Boolean(client),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!client) throw new Error('supabase_unavailable');
      return getPublicHomepageSettings(client);
    },
  });

  useEffect(() => {
    if (isRestoring || !userId) return;
    let active = true;
    void getAuthenticatedDestination()
      .then((destination) => {
        if (active) router.replace(destination);
      })
      .catch((error) => {
        logger.error('Unable to resolve authenticated destination', error);
        if (active) router.replace('/(onboarding)');
      });
    return () => {
      active = false;
    };
  }, [isRestoring, router, userId]);

  if (isRestoring || userId) {
    return (
      <View style={styles.loadingContainer}>
        <ChonLoveLogo height={62} width={158} />
        <ActivityIndicator color={luxyColors.actionRed} size="large" />
        <Text style={styles.loadingCopy}>Đang kiểm tra phiên đăng nhập…</Text>
      </View>
    );
  }

  const settings: HomepageSettings | null = settingsQuery.data ?? null;
  const openJoin = () => router.push('/auth');
  const openLogin = () => router.push('/auth?mode=login');
  const section2Left = remoteOrFallback(settings?.section2_left_image_url, luxyPublicArtwork.values);
  const section2Right = remoteOrFallback(settings?.section2_right_image_url, luxyPublicArtwork.benefits);
  const benefitsImage = remoteOrFallback(settings?.section4_image_url, luxyPublicArtwork.benefits);

  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} testID="chon-love-public-homepage">
      <View style={[styles.hero, isPhone && styles.heroPhone]}>
        <HomepageHeroMedia
          desktopUrl={settings?.hero_desktop_youtube_url}
          fallbackSource={luxyPublicArtwork.hero}
          isPhone={isPhone}
          mobileUrl={settings?.hero_mobile_youtube_url}
          slides={settings?.hero_slider_images}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroShade} />
        <PublicHeader compact={isPhone} onJoin={openJoin} onLogin={openLogin} variant="overlay" />
        <View style={[styles.heroContent, isPhone && styles.heroContentPhone]}>
          <ChonLoveLogo height={isPhone ? 104 : 150} width={isPhone ? 236 : 340} />
          <Text accessibilityRole="header" style={[styles.heroSlogan, isPhone && styles.heroSloganPhone]}>
            Chọn đúng Người, Yêu đúng Gu
          </Text>
          <View style={styles.goldRule} />
          <Pressable
            accessibilityLabel="Tham gia Chọn.love ngay"
            accessibilityRole="button"
            onHoverIn={() => setHoveredControl('hero-join')}
            onHoverOut={() => setHoveredControl(null)}
            onPress={openJoin}
            style={({ pressed }) => [
              styles.primaryButton,
              hoveredControl === 'hero-join' && styles.primaryButtonHovered,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Tham gia ngay</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.positioningSection, isPhone && styles.positioningSectionPhone]}>
        {isDesktop ? (
          <>
            <View style={[styles.sideArtwork, styles.sideArtworkLeft]}>
              <Image accessibilityLabel="Minh họa kết nối Chọn.love" resizeMode="contain" source={section2Left} style={styles.fillImage} />
            </View>
            <View style={[styles.sideArtwork, styles.sideArtworkRight]}>
              <Image accessibilityLabel="Minh họa hẹn hò Chọn.love" resizeMode="contain" source={section2Right} style={styles.fillImage} />
            </View>
          </>
        ) : null}
        <View style={[styles.positioningCopy, !isDesktop && styles.positioningCopyCompact, isPhone && styles.positioningCopyPhone]}>
          <SectionEyebrow>CHỌN.LOVE</SectionEyebrow>
          <Text accessibilityRole="header" style={[styles.sectionHeading, styles.goldSectionHeading, isPhone && styles.sectionHeadingPhone]}>
            NỀN TẢNG HẸN HÒ THỰC CHẤT VÀ THÚ VỊ
          </Text>
          <Text style={styles.centerBody}>Chọn.love là nền tảng hẹn hò tiên phong tại Việt Nam, kết nối người dùng thật gần bạn với một cộng đồng kết nối văn minh và thú vị.</Text>
          <Text style={styles.centerBody}>Chọn.love được thiết kế nhằm thúc đẩy sự kết nối chân thực giữa các thành viên, hướng tới những mối quan hệ bền vững và tình yêu được xây dựng trên nền tảng mong muốn chung: một cuộc sống đầy khát vọng và trọn vẹn.</Text>
          <Pressable
            accessibilityRole="button"
            onHoverIn={() => setHoveredControl('connect-cta')}
            onHoverOut={() => setHoveredControl(null)}
            onPress={openJoin}
            style={({ pressed }) => [
              styles.textCta,
              hoveredControl === 'connect-cta' && styles.textCtaHovered,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.textCtaText}>Bắt đầu kết nối</Text>
            <Text style={styles.textCtaArrow}>→</Text>
          </Pressable>
        </View>
      </View>

      <ImageBackground
        source={remoteOrFallback(settings?.section3_background_image_url, luxyPublicArtwork.testimonial)}
        resizeMode="cover"
        style={[styles.testimonialSection, isPhone && styles.testimonialSectionPhone]}
      >
        <View style={styles.testimonialShade} />
        <View style={styles.testimonialInner}>
          <SectionEyebrow light>THÀNH VIÊN NÓI GÌ</SectionEyebrow>
          <Text accessibilityRole="header" style={[styles.testimonialHeading, isPhone && styles.sectionHeadingPhone]}>CHIA SẺ TỪ THÀNH VIÊN:</Text>
          {isDesktop ? (
            <View style={styles.testimonialGrid}>
              {testimonials.map((item) => <TestimonialCard item={item} key={item.name} />)}
            </View>
          ) : (
            <View style={styles.testimonialMobileWrap}>
              <TestimonialCard item={testimonials[testimonialIndex] ?? testimonials[0]} />
              <View style={styles.carouselControls}>
                <Pressable
                  accessibilityLabel="Chia sẻ trước"
                  accessibilityRole="button"
                  onHoverIn={() => setHoveredControl('testimonial-prev')}
                  onHoverOut={() => setHoveredControl(null)}
                  onPress={() => setTestimonialIndex((value) => (value + testimonials.length - 1) % testimonials.length)}
                  style={({ pressed }) => [
                    styles.carouselButton,
                    hoveredControl === 'testimonial-prev' && styles.carouselButtonHovered,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.carouselArrow}>‹</Text>
                </Pressable>
                <Text style={styles.carouselCount}>{testimonialIndex + 1} / {testimonials.length}</Text>
                <Pressable
                  accessibilityLabel="Chia sẻ tiếp theo"
                  accessibilityRole="button"
                  onHoverIn={() => setHoveredControl('testimonial-next')}
                  onHoverOut={() => setHoveredControl(null)}
                  onPress={() => setTestimonialIndex((value) => (value + 1) % testimonials.length)}
                  style={({ pressed }) => [
                    styles.carouselButton,
                    hoveredControl === 'testimonial-next' && styles.carouselButtonHovered,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.carouselArrow}>›</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ImageBackground>

      <View style={[styles.benefitsSection, isPhone && styles.benefitsSectionPhone]}>
        <View style={[styles.benefitsInner, isDesktop && styles.benefitsInnerDesktop]}>
          {isPhone ? <BenefitsArtwork isPhone source={benefitsImage} /> : null}
          <BenefitsCopy isPhone={isPhone} />
          {!isPhone ? <BenefitsArtwork isPhone={false} source={benefitsImage} /> : null}
        </View>
      </View>

      <View style={[styles.missionSection, isPhone && styles.missionSectionPhone]}>
        <View style={styles.missionGlow} />
        <View style={styles.missionInner}>
          <SectionEyebrow light>SỨ MỆNH</SectionEyebrow>
          <Text accessibilityRole="header" style={[styles.missionHeading, isPhone && styles.sectionHeadingPhone]}>SỨ MỆNH CỦA CHÚNG TÔI</Text>
          <Text style={styles.missionBody}>Sứ mệnh của chúng tôi là kiến tạo một không gian nơi tình yêu thật, thú vị và sự sang trọng hòa quyện. Chúng tôi đặt mục tiêu nâng tầm trải nghiệm — không chỉ cho các thành viên của mình mà còn cho cả cộng đồng hẹn hò nghiêm túc tại Việt Nam.</Text>
          <Text style={styles.missionBody}>Chọn.love không đi theo những quy chuẩn thông thường; chúng tôi thiết lập nên những chuẩn mực hoàn toàn mới. Từ vấn đề thành viên thật, tính cộng đồng cho đến các kết nối giá trị, mọi khía cạnh trải nghiệm đều được nâng cấp để xứng tầm với đẳng cấp của người sử dụng.</Text>
          <Text style={styles.missionBody}>Trải nghiệm hẹn hò sang trọng mà Chọn.love mang lại không chỉ bao hàm các yếu tố an toàn, tính cộng đồng và kết nối, mà còn đưa tất cả những giá trị đó lên một tầm cao mới.</Text>
          <Pressable
            accessibilityRole="button"
            onHoverIn={() => setHoveredControl('mission-join')}
            onHoverOut={() => setHoveredControl(null)}
            onPress={openJoin}
            style={({ pressed }) => [
              styles.missionButton,
              hoveredControl === 'mission-join' && styles.missionButtonHovered,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.missionButtonText}>Tham gia ngay</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.cultureSection, isPhone && styles.cultureSectionPhone]}>
        <View style={styles.cultureInner}>
          <SectionEyebrow>VĂN HOÁ</SectionEyebrow>
          <Text accessibilityRole="header" style={[styles.sectionHeading, styles.goldSectionHeading, isPhone && styles.sectionHeadingPhone]}>VĂN HOÁ KẾT NỐI CỦA CHỌN.LOVE</Text>
          <View style={[styles.cultureGrid, isDesktop && styles.cultureGridDesktop]}>
            {cultureItems.map((item) => (
              <View key={item} style={[styles.cultureItem, isDesktop && styles.cultureItemDesktop]}>
                <View style={styles.cultureIcon}><Text style={styles.cultureIconText}>♥</Text></View>
                <View style={styles.cultureCopyWrap}>
                  <Text style={styles.cultureCopy}>{item}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      <PublicFooter
        compact={isPhone}
        onCommunity={() => router.push('/legal/community-standards')}
        onTerms={() => router.push('/legal/terms')}
      />
    </ScrollView>
  );
}

function SectionEyebrow({ children, light = false }: { children: string; light?: boolean }) {
  return (
    <View style={styles.eyebrowRow}>
      <View style={[styles.eyebrowRule, light && styles.eyebrowRuleLight]} />
      <Text style={[styles.eyebrowText, light && styles.eyebrowTextLight]}>{children}</Text>
      <View style={[styles.eyebrowRule, light && styles.eyebrowRuleLight]} />
    </View>
  );
}

function TestimonialCard({ item }: { item: (typeof testimonials)[number] }) {
  return (
    <View style={styles.testimonialCard}>
      <Text style={styles.quoteMark}>“</Text>
      <Text style={styles.testimonialQuote}>{item.quote}</Text>
      <View style={styles.testimonialAuthorRule} />
      <Text style={styles.testimonialAuthor}>{item.name}</Text>
      <Text style={styles.testimonialPlace}>{item.place}</Text>
    </View>
  );
}

function BenefitsCopy({ isPhone }: { isPhone: boolean }) {
  return (
    <View style={styles.benefitsCopy}>
      <SectionEyebrow>TRẢI NGHIỆM KHÁC BIỆT</SectionEyebrow>
      <Text accessibilityRole="header" style={[styles.sectionHeading, styles.goldSectionHeading, styles.alignLeft, isPhone && styles.sectionHeadingPhone]}>QUYỀN LỢI THÀNH VIÊN</Text>
      {benefits.map((item, index) => (
        <View key={item.title} style={styles.benefitItem}>
          <View style={styles.benefitNumber}><Text style={styles.benefitNumberText}>{String(index + 1).padStart(2, '0')}</Text></View>
          <View style={styles.benefitContent}>
            <Text style={styles.benefitTitle}>{item.title}</Text>
            <Text style={styles.benefitCopyText}>{item.copy}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function BenefitsArtwork({ source, isPhone }: { source: ImageSourcePropType; isPhone: boolean }) {
  return (
    <View style={[styles.benefitsArtwork, isPhone && styles.benefitsArtworkPhone]}>
      <Image
        accessibilityLabel="Minh họa quyền lợi thành viên Chọn.love"
        resizeMode={isPhone ? 'contain' : 'cover'}
        source={source}
        style={styles.fillImage}
      />
      <View style={[styles.artworkGoldFrame, isPhone && styles.artworkGoldFramePhone]} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: CHON_PINK, flexGrow: 1 },
  loadingContainer: { alignItems: 'center', backgroundColor: CHON_PINK, flex: 1, gap: 18, justifyContent: 'center', padding: 32 },
  loadingCopy: { color: '#5A4C48', fontSize: chonTypography.sizes.body },
  hero: { backgroundColor: '#090909', minHeight: 740, overflow: 'hidden', position: 'relative', width: '100%' },
  heroPhone: { minHeight: 660 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.34)' },
  heroContent: { alignItems: 'center', alignSelf: 'center', justifyContent: 'center', minHeight: 650, paddingBottom: 70, paddingHorizontal: 24, position: 'relative', width: '100%', zIndex: 2 },
  heroContentPhone: { minHeight: 580, paddingBottom: 44 },
  heroSlogan: { color: '#FFFFFF', fontFamily: chonTypography.families.display, fontSize: chonTypography.sizes.h1Desktop, lineHeight: chonTypography.lineHeights.h1Desktop, marginTop: 8, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  heroSloganPhone: { fontSize: 30, lineHeight: 38, marginTop: 15 },
  goldRule: { backgroundColor: CHON_GOLD, height: 2, marginBottom: 22, marginTop: 16, width: 74 },
  primaryButton: { alignItems: 'center', backgroundColor: CHON_RED, borderRadius: luxyRadii.pill, justifyContent: 'center', minHeight: 48, minWidth: 150, paddingHorizontal: 24 },
  primaryButtonHovered: { backgroundColor: chonColors.primaryRedHover, ...chonShadows.primaryHover, transform: [{ scale: 1.03 }] },
  primaryButtonText: { color: '#FFFFFF', fontSize: chonTypography.sizes.body, fontWeight: '800' },
  positioningSection: { alignItems: 'center', backgroundColor: CHON_PINK, justifyContent: 'center', minHeight: 420, overflow: 'hidden', paddingHorizontal: 24, paddingVertical: 28, position: 'relative' },
  positioningSectionPhone: { minHeight: 0, paddingHorizontal: 18, paddingVertical: 50 },
  positioningCopy: { alignItems: 'center', maxWidth: 620, width: '45%', zIndex: 2 },
  positioningCopyCompact: { maxWidth: 720, width: '100%' },
  positioningCopyPhone: { width: '100%' },
  sideArtwork: { height: 360, position: 'absolute', top: 30, width: 216 },
  sideArtworkLeft: { left: 80 },
  sideArtworkRight: { right: 80 },
  fillImage: { height: '100%', width: '100%' },
  eyebrowRow: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 14 },
  eyebrowRule: { backgroundColor: CHON_GOLD, height: 1, width: 30 },
  eyebrowRuleLight: { backgroundColor: CHON_GOLD },
  eyebrowText: { color: CHON_RED, fontSize: chonTypography.sizes.help, fontWeight: '800', letterSpacing: 1.6 },
  eyebrowTextLight: { color: CHON_RED },
  sectionHeading: { color: '#171312', fontFamily: chonTypography.families.display, fontSize: chonTypography.sizes.h2, fontWeight: '500', letterSpacing: -0.35, lineHeight: chonTypography.lineHeights.h2, marginBottom: 20, textAlign: 'center' },
  goldSectionHeading: { color: CHON_GOLD },
  sectionHeadingPhone: { fontSize: chonTypography.sizes.h2, lineHeight: chonTypography.lineHeights.h2 },
  centerBody: { color: '#514844', fontSize: chonTypography.sizes.body, lineHeight: chonTypography.lineHeights.body, marginBottom: 12, maxWidth: 680, textAlign: 'center' },
  textCta: { alignItems: 'center', borderRadius: luxyRadii.pill, flexDirection: 'row', gap: 8, marginTop: 14, minHeight: 44, paddingHorizontal: 12 },
  textCtaHovered: { backgroundColor: 'rgba(255,187,0,0.16)', ...chonShadows.hover, transform: [{ scale: 1.02 }] },
  textCtaText: { color: CHON_RED, fontSize: chonTypography.sizes.body, fontWeight: '800' },
  textCtaArrow: { color: CHON_GOLD, fontSize: 20, fontWeight: '700' },
  testimonialSection: { minHeight: 720, paddingHorizontal: 24, paddingVertical: 78, position: 'relative' },
  testimonialSectionPhone: { minHeight: 650, paddingHorizontal: 16, paddingVertical: 58 },
  testimonialShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,7,8,0.46)' },
  testimonialInner: { alignSelf: 'center', maxWidth: 1280, position: 'relative', width: '100%', zIndex: 2 },
  testimonialHeading: { color: '#FFFFFF', fontFamily: chonTypography.families.display, fontSize: chonTypography.sizes.h2, fontWeight: '500', lineHeight: chonTypography.lineHeights.h2, marginBottom: 34, textAlign: 'center' },
  testimonialGrid: { flexDirection: 'row', gap: 18 },
  testimonialMobileWrap: { alignItems: 'center', gap: 18 },
  testimonialCard: { backgroundColor: 'rgba(255,241,200,0.88)', borderColor: 'rgba(255,187,0,0.72)', borderRadius: 8, borderWidth: 1, flex: 1, minHeight: 370, paddingHorizontal: 25, paddingVertical: 28 },
  quoteMark: { color: CHON_RED, fontFamily: chonTypography.families.display, fontSize: 48, lineHeight: 48 },
  testimonialQuote: { color: CHON_BLACK, fontSize: chonTypography.sizes.body, lineHeight: chonTypography.lineHeights.body, marginTop: 4 },
  testimonialAuthorRule: { backgroundColor: CHON_RED, height: 2, marginTop: 22, width: 38 },
  testimonialAuthor: { color: CHON_RED, fontSize: chonTypography.sizes.body, fontWeight: '800', marginTop: 12 },
  testimonialPlace: { color: '#5A514C', fontSize: chonTypography.sizes.help, marginTop: 3 },
  carouselControls: { alignItems: 'center', flexDirection: 'row', gap: 18, justifyContent: 'center' },
  carouselButton: { alignItems: 'center', borderColor: CHON_GOLD, borderRadius: 999, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  carouselButtonHovered: { backgroundColor: 'rgba(255,187,0,0.18)', ...chonShadows.hover, transform: [{ scale: 1.05 }] },
  carouselArrow: { color: '#FFFFFF', fontSize: 28, lineHeight: 30 },
  carouselCount: { color: '#FFFFFF', fontSize: chonTypography.sizes.body, fontWeight: '700' },
  benefitsSection: { backgroundColor: CHON_PINK, paddingHorizontal: 32, paddingVertical: 88 },
  benefitsSectionPhone: { paddingHorizontal: 18, paddingVertical: 58 },
  benefitsInner: { alignSelf: 'center', gap: 36, maxWidth: 1220, width: '100%' },
  benefitsInnerDesktop: { alignItems: 'flex-start', flexDirection: 'row', gap: 70 },
  benefitsCopy: { flex: 1, minWidth: 0 },
  alignLeft: { textAlign: 'left' },
  benefitItem: { borderTopColor: 'rgba(217,45,42,0.18)', borderTopWidth: 1, flexDirection: 'row', gap: 16, paddingVertical: 18 },
  benefitNumber: { alignItems: 'center', borderColor: CHON_GOLD, borderRadius: 999, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
  benefitNumberText: { color: CHON_GOLD, fontSize: chonTypography.sizes.help, fontWeight: '800' },
  benefitContent: { flex: 1 },
  benefitTitle: { color: '#191514', fontFamily: chonTypography.families.display, fontSize: chonTypography.sizes.h3, fontStyle: 'italic', lineHeight: chonTypography.lineHeights.h3 },
  benefitCopyText: { color: '#584E49', fontSize: chonTypography.sizes.body, lineHeight: 19, marginTop: 6 },
  benefitsArtwork: { borderBottomLeftRadius: 180, borderBottomRightRadius: 180, borderTopLeftRadius: 180, borderTopRightRadius: 180, height: 720, marginTop: 58, maxWidth: 430, overflow: 'hidden', position: 'relative', width: '38%' },
  benefitsArtworkPhone: { alignSelf: 'center', backgroundColor: '#FFFFFF', borderBottomLeftRadius: 18, borderBottomRightRadius: 18, borderTopLeftRadius: 18, borderTopRightRadius: 18, height: 430, marginBottom: 10, marginTop: 0, maxWidth: 360, width: '100%' },
  artworkGoldFrame: { ...StyleSheet.absoluteFillObject, borderColor: 'rgba(255,187,0,0.72)', borderRadius: 180, borderWidth: 2 },
  artworkGoldFramePhone: { borderRadius: 18 },
  missionSection: { alignItems: 'center', backgroundColor: '#080B0D', minHeight: 540, overflow: 'hidden', paddingBottom: 24, paddingHorizontal: 24, paddingTop: 72, position: 'relative' },
  missionSectionPhone: { minHeight: 0, paddingBottom: 24, paddingHorizontal: 18, paddingTop: 52 },
  missionGlow: { backgroundColor: 'rgba(217,45,42,0.16)', borderRadius: 999, height: 520, position: 'absolute', right: -180, top: -160, width: 520 },
  missionInner: { alignItems: 'center', maxWidth: 780, zIndex: 2 },
  missionHeading: { color: '#FFFFFF', fontFamily: chonTypography.families.display, fontSize: chonTypography.sizes.h2, fontWeight: '500', lineHeight: chonTypography.lineHeights.h2, marginBottom: 20, textAlign: 'center' },
  missionBody: { color: '#D8D1CD', fontSize: chonTypography.sizes.body, lineHeight: chonTypography.lineHeights.body, marginBottom: 12, textAlign: 'center' },
  missionButton: { alignItems: 'center', backgroundColor: CHON_RED, borderRadius: luxyRadii.pill, justifyContent: 'center', marginTop: 16, minHeight: 48, minWidth: 150, paddingHorizontal: 24 },
  missionButtonHovered: { backgroundColor: chonColors.primaryRedHover, ...chonShadows.primaryHover, transform: [{ scale: 1.03 }] },
  missionButtonText: { color: '#FFFFFF', fontSize: chonTypography.sizes.body, fontWeight: '800' },
  cultureSection: { backgroundColor: CHON_PINK, paddingHorizontal: 24, paddingVertical: 84 },
  cultureSectionPhone: { paddingHorizontal: 18, paddingVertical: 58 },
  cultureInner: { alignSelf: 'center', maxWidth: 1120, width: '100%' },
  cultureGrid: { gap: 12, marginTop: 10 },
  cultureGridDesktop: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  cultureItem: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.64)', borderColor: 'rgba(217,45,42,0.18)', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 14, minHeight: 94, padding: 16, width: '100%' },
  cultureItemDesktop: { width: '31.5%' },
  cultureIcon: { alignItems: 'center', backgroundColor: CHON_RED, borderRadius: 999, height: 44, justifyContent: 'center', width: 44 },
  cultureIconText: { color: CHON_GOLD, fontSize: 19 },
  cultureCopyWrap: { flex: 1 },
  cultureCopy: { color: '#201B19', fontFamily: chonTypography.families.display, fontSize: chonTypography.sizes.h3, lineHeight: chonTypography.lineHeights.h3 },
  pressed: { opacity: 0.78 },
});