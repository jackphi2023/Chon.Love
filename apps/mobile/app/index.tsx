import {
  getPublicHomepageSettings,
  publicHomepageQueryKeys,
  type HomepageSettings,
} from '@myfan/supabase';
import { luxyColors, luxyRadii, luxyTypography } from '@myfan/ui';
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
import { HomepageYoutubeHero } from '@/components/homepage-youtube-hero';
import { luxyPublicArtwork } from '@/components/luxy-public-artwork';
import { getAuthenticatedDestination } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

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

  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} testID="chon-love-public-homepage">
      <View style={[styles.hero, isPhone && styles.heroPhone]}>
        <HomepageYoutubeHero
          desktopUrl={settings?.hero_desktop_youtube_url}
          fallbackSource={luxyPublicArtwork.hero}
          isPhone={isPhone}
          mobileUrl={settings?.hero_mobile_youtube_url}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroShade} />
        <PublicHeader isPhone={isPhone} onJoin={openJoin} onLogin={openLogin} />
        <View style={[styles.heroContent, isPhone && styles.heroContentPhone]}>
          <ChonLoveLogo height={isPhone ? 104 : 150} width={isPhone ? 236 : 340} />
          <Text accessibilityRole="header" style={[styles.heroSlogan, isPhone && styles.heroSloganPhone]}>
            Chọn đúng Người, Yêu đúng Gu
          </Text>
          <View style={styles.goldRule} />
          <Pressable accessibilityLabel="Tham gia Chọn.love ngay" accessibilityRole="button" onPress={openJoin} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>Tham gia ngay</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.positioningSection, isPhone && styles.positioningSectionPhone]}>
        <View style={[styles.sideArtwork, styles.sideArtworkLeft, isPhone && styles.sideArtworkPhone]}>
          <Image accessibilityLabel="Minh họa kết nối Chọn.love" resizeMode="cover" source={remoteOrFallback(settings?.section2_left_image_url, luxyPublicArtwork.values)} style={styles.fillImage} />
        </View>
        <View style={[styles.positioningCopy, isPhone && styles.positioningCopyPhone]}>
          <SectionEyebrow>CHỌN.LOVE</SectionEyebrow>
          <Text accessibilityRole="header" style={[styles.sectionHeading, isPhone && styles.sectionHeadingPhone]}>NỀN TẢNG HẸN HỌ THỰC CHẤT VÀ THÚ VỊ</Text>
          <Text style={styles.centerBody}>Chọn.love là nền tảng hẹn hò, kết nối người dùng thật gần bạn với một cộng đồng kết nối văn minh và thú vị.</Text>
          <Text style={styles.centerBody}>Chọn.love được thiết kế nhằm thúc đẩy sự kết nối chân thực giữa các thành viên, hướng tới những mối quan hệ bền vững và tình yêu được xây dựng trên nền tảng mong muốn chung: một cuộc sống đầy khát vọng và trọn vẹn.</Text>
          <Pressable accessibilityRole="button" onPress={openJoin} style={({ pressed }) => [styles.textCta, pressed && styles.pressed]}>
            <Text style={styles.textCtaText}>Bắt đầu kết nối</Text><Text style={styles.textCtaArrow}>→</Text>
          </Pressable>
        </View>
        <View style={[styles.sideArtwork, styles.sideArtworkRight, isPhone && styles.sideArtworkPhone]}>
          <Image accessibilityLabel="Minh họa hẹn hò Chọn.love" resizeMode="cover" source={remoteOrFallback(settings?.section2_right_image_url, luxyPublicArtwork.benefits)} style={styles.fillImage} />
        </View>
      </View>

      <ImageBackground source={remoteOrFallback(settings?.section3_background_image_url, luxyPublicArtwork.testimonial)} resizeMode="cover" style={[styles.testimonialSection, isPhone && styles.testimonialSectionPhone]}>
        <View style={styles.testimonialShade} />
        <View style={styles.testimonialInner}>
          <SectionEyebrow light>THÀNH VIÊN NÓI GÌ</SectionEyebrow>
          <Text accessibilityRole="header" style={[styles.testimonialHeading, isPhone && styles.sectionHeadingPhone]}>CHIA SẼ TỪ THÀNH VIÊN:</Text>
          {isDesktop ? (
            <View style={styles.testimonialGrid}>{testimonials.map((item) => <TestimonialCard item={item} key={item.name} />)}</View>
          ) : (
            <View style={styles.testimonialMobileWrap}>
              <TestimonialCard item={testimonials[testimonialIndex] ?? testimonials[0]} />
              <View style={styles.carouselControls}>
                <Pressable accessibilityLabel="Chia sẻ trước" accessibilityRole="button" onPress={() => setTestimonialIndex((value) => (value + testimonials.length - 1) % testimonials.length)} style={({ pressed }) => [styles.carouselButton, pressed && styles.pressed]}><Text style={styles.carouselArrow}>‹</Text></Pressable>
                <Text style={styles.carouselCount}>{testimonialIndex + 1} / {testimonials.length}</Text>
                <Pressable accessibilityLabel="Chia sẻ tiếp theo" accessibilityRole="button" onPress={() => setTestimonialIndex((value) => (value + 1) % testimonials.length)} style={({ pressed }) => [styles.carouselButton, pressed && styles.pressed]}><Text style={styles.carouselArrow}>›</Text></Pressable>
              </View>
            </View>
          )}
        </View>
      </ImageBackground>

      <View style={[styles.benefitsSection, isPhone && styles.benefitsSectionPhone]}>
        <View style={[styles.benefitsInner, isDesktop && styles.benefitsInnerDesktop]}>
          <View style={styles.benefitsCopy}>
            <SectionEyebrow>TRẢI NGHIỆM KHÁC BIỆT</SectionEyebrow>
            <Text accessibilityRole="header" style={[styles.sectionHeading, styles.alignLeft, isPhone && styles.sectionHeadingPhone]}>QUYỀN LỢI THÀNH VIÊN:</Text>
            {benefits.map((item, index) => (
              <View key={item.title} style={styles.benefitItem}>
                <View style={styles.benefitNumber}><Text style={styles.benefitNumberText}>{String(index + 1).padStart(2, '0')}</Text></View>
                <View style={styles.benefitContent}><Text style={styles.benefitTitle}>{item.title}</Text><Text style={styles.benefitCopyText}>{item.copy}</Text></View>
              </View>
            ))}
          </View>
          <View style={[styles.benefitsArtwork, isPhone && styles.benefitsArtworkPhone]}>
            <Image accessibilityLabel="Minh họa quyền lợi thành viên Chọn.love" resizeMode="cover" source={remoteOrFallback(settings?.section4_image_url, luxyPublicArtwork.benefits)} style={styles.fillImage} />
            <View style={styles.artworkGoldFrame} />
          </View>
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
          <Pressable accessibilityRole="button" onPress={openJoin} style={({ pressed }) => [styles.missionButton, pressed && styles.pressed]}><Text style={styles.missionButtonText}>Tham gia Chọn.love</Text></Pressable>
        </View>
      </View>

      <View style={[styles.cultureSection, isPhone && styles.cultureSectionPhone]}>
        <View style={styles.cultureInner}>
          <SectionEyebrow>VĂN HOÁ</SectionEyebrow>
          <Text accessibilityRole="header" style={[styles.sectionHeading, isPhone && styles.sectionHeadingPhone]}>VĂN HOÁ KẾT NỐI CỦA CHỌN.LOVE</Text>
          <View style={[styles.cultureGrid, isDesktop && styles.cultureGridDesktop]}>
            {cultureItems.map((item, index) => (
              <View key={item} style={[styles.cultureItem, isDesktop && styles.cultureItemDesktop]}>
                <View style={styles.cultureIcon}><Text style={styles.cultureIconText}>♥</Text></View>
                <View style={styles.cultureCopyWrap}><Text style={styles.cultureIndex}>0{index + 1}</Text><Text style={styles.cultureCopy}>{item}</Text></View>
              </View>
            ))}
          </View>
        </View>
      </View>

      <PublicFooter isPhone={isPhone} onCommunity={() => router.push('/legal/community-standards')} onTerms={() => router.push('/legal/terms')} />
    </ScrollView>
  );
}

function PublicHeader({ isPhone, onJoin, onLogin }: { isPhone: boolean; onJoin: () => void; onLogin: () => void }) {
  return (
    <View style={[styles.header, isPhone && styles.headerPhone]}>
      <ChonLoveLogo height={isPhone ? 42 : 54} width={isPhone ? 96 : 126} />
      <View style={styles.headerActions}>
        <Pressable accessibilityRole="button" onPress={onLogin} style={({ pressed }) => [styles.loginButton, pressed && styles.pressed]}><Text style={styles.loginText}>Đăng nhập</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={onJoin} style={({ pressed }) => [styles.registerButton, pressed && styles.pressed]}><Text style={styles.registerText}>Đăng ký</Text></Pressable>
      </View>
    </View>
  );
}

function SectionEyebrow({ children, light = false }: { children: string; light?: boolean }) {
  return <View style={styles.eyebrowRow}><View style={[styles.eyebrowRule, light && styles.eyebrowRuleLight]} /><Text style={[styles.eyebrowText, light && styles.eyebrowTextLight]}>{children}</Text><View style={[styles.eyebrowRule, light && styles.eyebrowRuleLight]} /></View>;
}

function TestimonialCard({ item }: { item: (typeof testimonials)[number] }) {
  return (
    <View style={styles.testimonialCard}>
      <Text style={styles.quoteMark}>“</Text><Text style={styles.testimonialQuote}>{item.quote}</Text><View style={styles.testimonialAuthorRule} /><Text style={styles.testimonialAuthor}>{item.name}</Text><Text style={styles.testimonialPlace}>{item.place}</Text>
    </View>
  );
}

export function PublicFooter({ isPhone, onCommunity, onTerms }: { isPhone: boolean; onCommunity: () => void; onTerms: () => void }) {
  return (
    <View style={[styles.footer, isPhone && styles.footerPhone]}>
      <View style={styles.footerBrandBlock}><ChonLoveLogo height={54} width={132} /><Text style={styles.footerTagline}>Chọn đúng người, Yêu đúng Gu © 2026 Chon.Love</Text></View>
      <View style={styles.footerLinks}>
        <Pressable accessibilityRole="link" onPress={onTerms} style={({ pressed }) => [styles.footerLinkButton, pressed && styles.pressed]}><Text style={styles.footerLinkText}>Điều khoản</Text></Pressable>
        <View style={styles.footerDot} />
        <Pressable accessibilityRole="link" onPress={onCommunity} style={({ pressed }) => [styles.footerLinkButton, pressed && styles.pressed]}><Text style={styles.footerLinkText}>Tiêu chuẩn cộng đồng</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#FFF8F5', flexGrow: 1 },
  loadingContainer: { alignItems: 'center', backgroundColor: '#FFF8F5', flex: 1, gap: 18, justifyContent: 'center', padding: 32 },
  loadingCopy: { color: '#5A4C48', fontSize: 14 },
  hero: { backgroundColor: '#090909', minHeight: 740, overflow: 'hidden', position: 'relative', width: '100%' },
  heroPhone: { minHeight: 660 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.34)' },
  header: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', height: 78, justifyContent: 'space-between', maxWidth: 1440, paddingHorizontal: 42, position: 'relative', width: '100%', zIndex: 10 },
  headerPhone: { height: 62, paddingHorizontal: 14 },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  loginButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  loginText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  registerButton: { alignItems: 'center', backgroundColor: '#D92D2A', borderColor: 'rgba(255,255,255,0.35)', borderRadius: luxyRadii.pill, borderWidth: 1, justifyContent: 'center', minHeight: 42, paddingHorizontal: 20 },
  registerText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  heroContent: { alignItems: 'center', alignSelf: 'center', justifyContent: 'center', minHeight: 650, paddingBottom: 70, paddingHorizontal: 24, position: 'relative', width: '100%', zIndex: 2 },
  heroContentPhone: { minHeight: 580, paddingBottom: 44 },
  heroSlogan: { color: '#FFFFFF', fontFamily: luxyTypography.families.display, fontSize: 34, lineHeight: 44, marginTop: -12, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  heroSloganPhone: { fontSize: 25, lineHeight: 34, marginTop: -5 },
  goldRule: { backgroundColor: '#F2B51D', height: 2, marginBottom: 22, marginTop: 16, width: 74 },
  primaryButton: { alignItems: 'center', backgroundColor: '#D92D2A', borderRadius: luxyRadii.pill, justifyContent: 'center', minHeight: 48, minWidth: 150, paddingHorizontal: 24 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  positioningSection: { alignItems: 'center', backgroundColor: '#FFF8F5', justifyContent: 'center', minHeight: 560, overflow: 'hidden', paddingHorizontal: 24, paddingVertical: 88, position: 'relative' },
  positioningSectionPhone: { gap: 16, minHeight: 0, paddingHorizontal: 18, paddingVertical: 58 },
  positioningCopy: { alignItems: 'center', maxWidth: 720, width: '58%', zIndex: 2 },
  positioningCopyPhone: { width: '100%' },
  sideArtwork: { borderColor: '#F2B51D', borderRadius: 140, borderWidth: 2, height: 250, overflow: 'hidden', position: 'absolute', top: 155, width: 190 },
  sideArtworkLeft: { left: -38, transform: [{ rotate: '-5deg' }] },
  sideArtworkRight: { right: -38, transform: [{ rotate: '5deg' }] },
  sideArtworkPhone: { borderRadius: 52, height: 92, left: undefined, marginBottom: 2, position: 'relative', right: undefined, top: undefined, transform: [], width: 132 },
  fillImage: { height: '100%', width: '100%' },
  eyebrowRow: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 14 },
  eyebrowRule: { backgroundColor: '#F2B51D', height: 1, width: 30 },
  eyebrowRuleLight: { backgroundColor: '#F6C843' },
  eyebrowText: { color: '#A66A00', fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  eyebrowTextLight: { color: '#F6C843' },
  sectionHeading: { color: '#171312', fontFamily: luxyTypography.families.display, fontSize: 34, fontWeight: '500', letterSpacing: -0.5, lineHeight: 43, marginBottom: 22, textAlign: 'center' },
  sectionHeadingPhone: { fontSize: 26, lineHeight: 34 },
  centerBody: { color: '#514844', fontSize: 15, lineHeight: 25, marginBottom: 13, maxWidth: 680, textAlign: 'center' },
  textCta: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 14, minHeight: 44 },
  textCtaText: { color: '#C81C1D', fontSize: 14, fontWeight: '800' },
  textCtaArrow: { color: '#F2B51D', fontSize: 20, fontWeight: '700' },
  testimonialSection: { minHeight: 720, paddingHorizontal: 24, paddingVertical: 78, position: 'relative' },
  testimonialSectionPhone: { minHeight: 650, paddingHorizontal: 16, paddingVertical: 58 },
  testimonialShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,7,8,0.56)' },
  testimonialInner: { alignSelf: 'center', maxWidth: 1280, position: 'relative', width: '100%', zIndex: 2 },
  testimonialHeading: { color: '#FFFFFF', fontFamily: luxyTypography.families.display, fontSize: 36, fontWeight: '500', lineHeight: 46, marginBottom: 34, textAlign: 'center' },
  testimonialGrid: { flexDirection: 'row', gap: 18 },
  testimonialMobileWrap: { alignItems: 'center', gap: 18 },
  testimonialCard: { backgroundColor: 'rgba(8,10,12,0.84)', borderColor: 'rgba(242,181,29,0.45)', borderRadius: 8, borderWidth: 1, flex: 1, minHeight: 370, paddingHorizontal: 25, paddingVertical: 28 },
  quoteMark: { color: '#F2B51D', fontFamily: luxyTypography.families.display, fontSize: 48, lineHeight: 48 },
  testimonialQuote: { color: '#F6F0EC', fontSize: 13.5, lineHeight: 22, marginTop: 4 },
  testimonialAuthorRule: { backgroundColor: '#D92D2A', height: 2, marginTop: 22, width: 38 },
  testimonialAuthor: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', marginTop: 12 },
  testimonialPlace: { color: '#D7CEC9', fontSize: 12, marginTop: 3 },
  carouselControls: { alignItems: 'center', flexDirection: 'row', gap: 18, justifyContent: 'center' },
  carouselButton: { alignItems: 'center', borderColor: '#F2B51D', borderRadius: 999, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  carouselArrow: { color: '#FFFFFF', fontSize: 28, lineHeight: 30 },
  carouselCount: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  benefitsSection: { backgroundColor: '#FFF8F5', paddingHorizontal: 32, paddingVertical: 88 },
  benefitsSectionPhone: { paddingHorizontal: 18, paddingVertical: 58 },
  benefitsInner: { alignSelf: 'center', gap: 36, maxWidth: 1220, width: '100%' },
  benefitsInnerDesktop: { alignItems: 'flex-start', flexDirection: 'row', gap: 70 },
  benefitsCopy: { flex: 1, minWidth: 0 },
  alignLeft: { textAlign: 'left' },
  benefitItem: { borderTopColor: '#E7DCD5', borderTopWidth: 1, flexDirection: 'row', gap: 16, paddingVertical: 18 },
  benefitNumber: { alignItems: 'center', borderColor: '#F2B51D', borderRadius: 999, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
  benefitNumberText: { color: '#A66A00', fontSize: 10, fontWeight: '800' },
  benefitContent: { flex: 1 },
  benefitTitle: { color: '#191514', fontFamily: luxyTypography.families.display, fontSize: 20, fontStyle: 'italic', lineHeight: 26 },
  benefitCopyText: { color: '#584E49', fontSize: 13.5, lineHeight: 21, marginTop: 6 },
  benefitsArtwork: { borderBottomLeftRadius: 180, borderBottomRightRadius: 180, borderTopLeftRadius: 180, borderTopRightRadius: 180, height: 720, marginTop: 58, maxWidth: 430, overflow: 'hidden', position: 'relative', width: '38%' },
  benefitsArtworkPhone: { alignSelf: 'center', borderBottomLeftRadius: 110, borderBottomRightRadius: 110, borderTopLeftRadius: 110, borderTopRightRadius: 110, height: 470, marginTop: 0, maxWidth: 360, width: '100%' },
  artworkGoldFrame: { ...StyleSheet.absoluteFillObject, borderColor: 'rgba(242,181,29,0.72)', borderRadius: 180, borderWidth: 2 },
  missionSection: { alignItems: 'center', backgroundColor: '#080B0D', minHeight: 660, overflow: 'hidden', paddingHorizontal: 24, paddingVertical: 92, position: 'relative' },
  missionSectionPhone: { minHeight: 0, paddingHorizontal: 18, paddingVertical: 64 },
  missionGlow: { backgroundColor: 'rgba(200,28,29,0.16)', borderRadius: 999, height: 520, position: 'absolute', right: -180, top: -160, width: 520 },
  missionInner: { alignItems: 'center', maxWidth: 780, zIndex: 2 },
  missionHeading: { color: '#FFFFFF', fontFamily: luxyTypography.families.display, fontSize: 36, fontWeight: '500', lineHeight: 46, marginBottom: 22, textAlign: 'center' },
  missionBody: { color: '#D8D1CD', fontSize: 14, lineHeight: 23, marginBottom: 14, textAlign: 'center' },
  missionButton: { alignItems: 'center', borderColor: '#F2B51D', borderRadius: luxyRadii.pill, borderWidth: 1, justifyContent: 'center', marginTop: 16, minHeight: 48, paddingHorizontal: 24 },
  missionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  cultureSection: { backgroundColor: '#FCEFEB', paddingHorizontal: 24, paddingVertical: 84 },
  cultureSectionPhone: { paddingHorizontal: 18, paddingVertical: 58 },
  cultureInner: { alignSelf: 'center', maxWidth: 1120, width: '100%' },
  cultureGrid: { gap: 12, marginTop: 10 },
  cultureGridDesktop: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  cultureItem: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.64)', borderColor: '#E6D7D0', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 14, minHeight: 94, padding: 16, width: '100%' },
  cultureItemDesktop: { width: '31.5%' },
  cultureIcon: { alignItems: 'center', backgroundColor: '#111111', borderRadius: 999, height: 44, justifyContent: 'center', width: 44 },
  cultureIconText: { color: '#F2B51D', fontSize: 19 },
  cultureCopyWrap: { flex: 1 },
  cultureIndex: { color: '#C81C1D', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  cultureCopy: { color: '#201B19', fontFamily: luxyTypography.families.display, fontSize: 17, lineHeight: 23, marginTop: 3 },
  footer: { alignItems: 'center', backgroundColor: '#070707', flexDirection: 'row', flexWrap: 'wrap', gap: 22, justifyContent: 'space-between', minHeight: 150, paddingHorizontal: 42, paddingVertical: 28 },
  footerPhone: { alignItems: 'flex-start', flexDirection: 'column', gap: 14, paddingHorizontal: 18 },
  footerBrandBlock: { alignItems: 'flex-start', flexGrow: 1, maxWidth: 430, minWidth: 230 },
  footerTagline: { color: '#CFC6C1', fontSize: 12, lineHeight: 18 },
  footerLinks: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  footerLinkButton: { justifyContent: 'center', minHeight: 44 },
  footerLinkText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  footerDot: { backgroundColor: '#F2B51D', borderRadius: 999, height: 4, width: 4 },
  pressed: { opacity: 0.78 },
});
