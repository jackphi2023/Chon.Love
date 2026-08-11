import {
  luxyBrand,
  luxyColors,
  luxyLayout,
  luxyRadii,
  luxySpacing,
  luxyTypography,
} from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { getAuthenticatedDestination } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { useAuth } from '@/providers/auth-provider';
import { luxyPublicArtwork } from '@/components/luxy-public-artwork';

const testimonials = [
  {
    quote:
      'Luxy giúp tôi bỏ qua cảm giác lướt vô tận. Tôi gặp những người có mục tiêu rõ ràng, biết mình muốn gì và thực sự dành thời gian cho một cuộc trò chuyện chất lượng.',
    name: 'Minh Anh',
    place: 'TP. Hồ Chí Minh',
  },
  {
    quote:
      'Điều tôi đánh giá cao là chất lượng kết nối. Khi cả hai cùng nghiêm túc với cuộc sống của mình, cuộc hẹn trở nên tự nhiên và có nhiều điều để chia sẻ hơn.',
    name: 'Quang',
    place: 'Hà Nội',
  },
  {
    quote:
      'Tôi muốn một nơi tôn trọng tiêu chuẩn cá nhân, sự riêng tư và thời gian. Luxy cho tôi cảm giác đó ngay từ cách hồ sơ và trải nghiệm được thiết kế.',
    name: 'Linh',
    place: 'Đà Nẵng',
  },
] as const;

const values = [
  {
    key: 'worth',
    title: 'Giá trị',
    copy: 'Một mối quan hệ tốt bắt đầu từ việc hai người nhìn thấy giá trị thật của nhau, không chỉ ấn tượng bề ngoài.',
  },
  {
    key: 'connection',
    title: 'Kết nối',
    copy: 'Luxy hướng tới những cuộc trò chuyện và mối quan hệ có chiều sâu, thay vì tối đa hóa số lần lướt.',
  },
  {
    key: 'authenticity',
    title: 'Chân thật',
    copy: 'Thời gian là tài sản quý. Chúng tôi ưu tiên hồ sơ rõ ràng, xác thực phù hợp và hành vi minh bạch.',
  },
  {
    key: 'luxury',
    title: 'Chất lượng sống',
    copy: 'Sự sang trọng không chỉ là tài sản; đó là quyền lựa chọn trải nghiệm, thời gian và những người phù hợp để đồng hành.',
  },
  {
    key: 'safety',
    title: 'An toàn',
    copy: 'Quyền riêng tư, báo cáo, chặn và các lớp xác thực được đặt ở trung tâm của trải nghiệm Luxy.',
  },
] as const;

type ValueKey = (typeof values)[number]['key'];

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { userId, isRestoring } = useAuth();
  const [testimonialIndex, setTestimonialIndex] = useState(2);
  const [selectedValue, setSelectedValue] = useState<ValueKey>('worth');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isPhone = width < 768;
  const isWide = width >= 900;
  const isCompactPhone = width < 430;

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
        <Text style={styles.loadingBrand}>{luxyBrand.productName}</Text>
        <ActivityIndicator color={luxyColors.actionRed} size="large" />
        <Text style={styles.loadingCopy}>Đang kiểm tra phiên đăng nhập…</Text>
      </View>
    );
  }

  const openAuth = () => {
    setMobileMenuOpen(false);
    router.push('/(auth)');
  };

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const currentTestimonial = testimonials[testimonialIndex] ?? testimonials[0];
  const currentValue = values.find((item) => item.key === selectedValue) ?? values[0];

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
      testID="luxy-public-homepage"
    >
      <ImageBackground source={luxyPublicArtwork.hero} resizeMode="cover" style={[styles.hero, isPhone && styles.heroPhone]}>
        <View style={styles.heroOverlay} />
        <PublicHeader
          compact={isPhone}
          compactPhone={isCompactPhone}
          menuOpen={mobileMenuOpen}
          onJoin={openAuth}
          onLogin={openAuth}
          onMenu={() => setMobileMenuOpen((value) => !value)}
          onNavigate={scrollTo}
        />
        {isPhone && mobileMenuOpen ? (
          <View style={styles.mobileMenu}>
            <MenuLink label="Giới thiệu" onPress={() => scrollTo('luxy-mindset')} />
            <MenuLink label="Cách hoạt động" onPress={() => scrollTo('luxy-benefits')} />
            <MenuLink label="An toàn" onPress={() => scrollTo('luxy-safety')} />
            <MenuLink label="Giá trị Luxy" onPress={() => scrollTo('luxy-values')} />
            <Pressable
              accessibilityLabel="Tham gia Luxy.Love"
              accessibilityRole="button"
              onPress={openAuth}
              style={({ pressed }) => [styles.menuJoinButton, pressed && styles.pressed]}
            >
              <Text style={styles.menuJoinText}>Tham gia ngay</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.heroContent, isPhone && styles.heroContentPhone]}>
          <Text style={[styles.heroBrand, isPhone && styles.heroBrandPhone]}>{luxyBrand.productName}</Text>
          <Text accessibilityRole="header" style={[styles.heroTitle, isPhone && styles.heroTitlePhone]}>
            Hẹn hò với người làm cuộc sống tốt đẹp hơn.
          </Text>
          <Text style={[styles.heroSubtitle, isPhone && styles.heroSubtitlePhone]}>
            Dành cho người trưởng thành có định hướng, biết mình muốn gì và trân trọng những kết nối chất lượng.
          </Text>
          <Pressable
            accessibilityLabel="Tham gia Luxy.Love ngay"
            accessibilityRole="button"
            onPress={openAuth}
            style={({ pressed }) => [styles.primaryCta, pressed && styles.pressed]}
          >
            <Text style={styles.primaryCtaText}>Tham gia ngay</Text>
          </Pressable>
        </View>
      </ImageBackground>

      <View nativeID="luxy-mindset" style={[styles.mindsetSection, isPhone && styles.sectionPhone]}>
        <View style={styles.mindsetAccentLeft} />
        <View style={styles.mindsetAccentRight} />
        <Text accessibilityRole="header" style={[styles.displayHeading, isPhone && styles.displayHeadingPhone]}>
          Tư duy Luxy
        </Text>
        <Text style={styles.centeredBody}>
          Luxy.Love là không gian hẹn hò dành cho những người nghiêm túc với sự nghiệp, cuộc sống và các mối quan hệ của mình. Khi bạn có tiêu chuẩn rõ ràng trong công việc và cuộc sống, bạn cũng xứng đáng có một nơi giúp tìm người đồng điệu với những tiêu chuẩn đó.
        </Text>
        <Text style={styles.centeredBody}>
          Chúng tôi thiết kế trải nghiệm để khuyến khích những kết nối chân thật, tôn trọng và có chủ đích — nơi hai người đến với nhau vì sự phù hợp, chứ không vì một giao dịch.
        </Text>
        <Text style={styles.mindsetSignature}>Bạn biết mình muốn gì. Hãy tìm điều đó trên Luxy.</Text>
        <Pressable
          accessibilityLabel="Bắt đầu với Luxy.Love"
          accessibilityRole="button"
          onPress={openAuth}
          style={({ pressed }) => [styles.primaryCta, styles.sectionCta, pressed && styles.pressed]}
        >
          <Text style={styles.primaryCtaText}>Bắt đầu ngay</Text>
        </Pressable>

        <View nativeID="luxy-safety" style={styles.responsibleBlock}>
          <Text style={styles.responsibleStrong}>Hẹn hò có trách nhiệm · Chỉ dành cho người từ 18 tuổi</Text>
          <Text style={styles.responsibleText}>
            Luxy.Love nghiêm cấm mua bán hoặc trao đổi tình cảm, cuộc hẹn, nhắn tin hay quyền truy cập riêng tư. Quà tặng luôn là tự nguyện và không tạo nghĩa vụ cho người nhận.
          </Text>
        </View>
      </View>

      <ImageBackground source={luxyPublicArtwork.testimonial} resizeMode="cover" style={[styles.testimonialSection, isPhone && styles.testimonialSectionPhone]}>
        <View style={styles.testimonialOverlay} />
        <Text accessibilityRole="header" style={[styles.testimonialHeading, isPhone && styles.testimonialHeadingPhone]}>Câu chuyện thành viên</Text>
        <View style={[styles.testimonialRail, isPhone && styles.testimonialRailPhone]}>
          <Pressable
            accessibilityLabel="Câu chuyện trước"
            accessibilityRole="button"
            onPress={() => setTestimonialIndex((value) => (value + testimonials.length - 1) % testimonials.length)}
            style={({ pressed }) => [styles.arrowButton, isPhone && styles.arrowButtonPhone, pressed && styles.pressed]}
          >
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <View style={[styles.quoteCard, isPhone && styles.quoteCardPhone]}>
            <Text style={[styles.quoteText, isPhone && styles.quoteTextPhone]}>“{currentTestimonial.quote}”</Text>
            <Text style={styles.quoteAuthor}>— {currentTestimonial.name}, <Text style={styles.quotePlace}>{currentTestimonial.place}</Text></Text>
          </View>
          <Pressable
            accessibilityLabel="Câu chuyện tiếp theo"
            accessibilityRole="button"
            onPress={() => setTestimonialIndex((value) => (value + 1) % testimonials.length)}
            style={({ pressed }) => [styles.arrowButton, isPhone && styles.arrowButtonPhone, pressed && styles.pressed]}
          >
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        </View>
      </ImageBackground>

      <View nativeID="luxy-benefits" style={[styles.benefitsSection, isPhone && styles.sectionPhone]}>
        <View style={[styles.benefitsInner, isWide && styles.benefitsInnerWide]}>
          <View style={styles.benefitsCopy}>
            <Text accessibilityRole="header" style={[styles.displayHeading, styles.alignLeft, isPhone && styles.displayHeadingPhone]}>
              Vì sao hẹn hò trên Luxy
            </Text>
            <Benefit title="Hẹn hò có chủ đích">
              Bạn đã có một hình dung rõ ràng về cuộc sống mình muốn xây dựng. Luxy giúp bạn tìm người có tham vọng, sự tự tin và mức độ nghiêm túc tương xứng.
            </Benefit>
            <Benefit title="Gặp người hiểu tiêu chuẩn của bạn">
              Mục tiêu không phải là thật nhiều lượt ghép đôi. Mục tiêu là những người phù hợp với tư duy, nhịp sống và giá trị mà bạn theo đuổi.
            </Benefit>
            <Benefit title="Tạo kết nối chất lượng">
              Bỏ qua cảm giác lướt vô tận. Tập trung vào hồ sơ đáng để bạn dành thời gian, sự chú ý và một cuộc trò chuyện thực sự.
            </Benefit>
            <Benefit title="Làm cuộc sống bạn đã xây tốt hơn">
              Một mối quan hệ phù hợp nên làm cuộc sống phong phú hơn — thêm niềm vui, góc nhìn và những trải nghiệm mà cả hai cùng trân trọng.
            </Benefit>
          </View>
          <View style={[styles.benefitsArtFrame, isPhone && styles.benefitsArtFramePhone]}>
            <Image source={luxyPublicArtwork.benefits} resizeMode="cover" style={styles.fillImage} />
          </View>
        </View>

        <View style={styles.benefitsCtaBlock}>
          <Text style={styles.benefitsPrompt}>Sẵn sàng cho kiểu hẹn hò phản ánh đúng tiêu chuẩn của bạn?</Text>
          <Text style={[styles.ctaDisplay, isPhone && styles.ctaDisplayPhone]}>Bạn biết mình muốn gì.{`\n`}Hãy tìm điều đó trên Luxy.</Text>
          <Pressable
            accessibilityLabel="Tham gia Luxy.Love"
            accessibilityRole="button"
            onPress={openAuth}
            style={({ pressed }) => [styles.primaryCta, styles.sectionCta, pressed && styles.pressed]}
          >
            <Text style={styles.primaryCtaText}>Tham gia ngay</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.missionSection, isPhone && styles.missionSectionPhone]}>
        <Text accessibilityRole="header" style={[styles.missionHeading, isPhone && styles.displayHeadingPhone]}>Sứ mệnh của Luxy</Text>
        <Text style={styles.missionBody}>
          Tạo một không gian nơi tình yêu, sự thành đạt và chất lượng sống có thể gặp nhau một cách tự nhiên. Luxy đặt mục tiêu nâng tiêu chuẩn của trải nghiệm hẹn hò — không chỉ ở hình thức, mà ở cách mọi người đối xử với thời gian và giá trị của nhau.
        </Text>
        <Text style={styles.missionBody}>
          Từ an toàn, quyền riêng tư, cộng đồng đến chất lượng kết nối, mỗi phần của sản phẩm được xây để phù hợp với những người có tiêu chuẩn cao cho chính mình.
        </Text>
        <Pressable
          accessibilityLabel="Tham gia Luxy.Love từ phần sứ mệnh"
          accessibilityRole="button"
          onPress={openAuth}
          style={({ pressed }) => [styles.primaryCta, styles.missionCta, pressed && styles.pressed]}
        >
          <Text style={styles.primaryCtaText}>Tham gia ngay</Text>
        </Pressable>
      </View>

      <View nativeID="luxy-values" style={[styles.valuesSection, isPhone && styles.sectionPhone]}>
        <Text accessibilityRole="header" style={[styles.displayHeading, isPhone && styles.displayHeadingPhone]}>Giá trị của Luxy</Text>
        <View style={[styles.valuesInner, isWide && styles.valuesInnerWide]}>
          <View style={[styles.valuesArtFrame, isPhone && styles.valuesArtFramePhone]}>
            <Image source={luxyPublicArtwork.values} resizeMode="cover" style={styles.fillImage} />
          </View>
          <View style={styles.valuesList}>
            {values.map((item) => {
              const selected = item.key === selectedValue;
              return (
                <Pressable
                  accessibilityLabel={`${item.title}. ${item.copy}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={item.key}
                  onPress={() => setSelectedValue(item.key)}
                  style={({ pressed }) => [styles.valueRow, selected && styles.valueRowSelected, pressed && styles.pressed]}
                >
                  <Text style={[styles.valueTitle, selected && styles.valueTitleSelected]}>{item.title}</Text>
                  <Text style={styles.valueArrow}>›</Text>
                </Pressable>
              );
            })}
            <View style={styles.valueCopyBox}>
              <Text style={styles.valueCopyTitle}>{currentValue.title}</Text>
              <Text style={styles.valueCopy}>{currentValue.copy}</Text>
            </View>
          </View>
        </View>
      </View>

      <ImageBackground source={luxyPublicArtwork.final} resizeMode="cover" style={[styles.finalSection, isPhone && styles.finalSectionPhone]}>
        <View style={styles.finalOverlay} />
        <View style={[styles.finalCard, isPhone && styles.finalCardPhone]}>
          <Text style={[styles.finalTitle, isPhone && styles.finalTitlePhone]}>Bạn biết mình muốn gì.{`\n`}Hãy tìm điều đó trên Luxy.</Text>
          <Text style={styles.finalFree}>Miễn phí tạo tài khoản</Text>
          <Pressable
            accessibilityLabel="Tham gia Luxy.Love miễn phí"
            accessibilityRole="button"
            onPress={openAuth}
            style={({ pressed }) => [styles.primaryCta, styles.finalButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryCtaText}>Tham gia Luxy</Text>
          </Pressable>
        </View>
      </ImageBackground>

      <View style={[styles.footer, isPhone && styles.footerPhone]}>
        <Text style={styles.footerBrand}>{luxyBrand.productName}</Text>
        <Text style={styles.footerLanguage}>Tiếng Việt</Text>
        <View style={[styles.footerColumns, isWide && styles.footerColumnsWide]}>
          <View style={styles.footerLinks}>
            <FooterLink label="Giới thiệu" onPress={() => scrollTo('luxy-mindset')} />
            <FooterLink label="Cách hoạt động" onPress={() => scrollTo('luxy-benefits')} />
            <FooterLink label="An toàn" onPress={() => scrollTo('luxy-safety')} />
            <FooterLink label="Giá trị Luxy" onPress={() => scrollTo('luxy-values')} />
          </View>
          <View style={styles.footerLinks}>
            <FooterLink label="Điều khoản" onPress={() => router.push('/legal/terms')} />
            <FooterLink label="Tiêu chuẩn cộng đồng" onPress={() => router.push('/legal/community-standards')} />
            <FooterLink label="Đăng nhập" onPress={openAuth} />
            <FooterLink label="Tham gia miễn phí" onPress={openAuth} />
          </View>
          <View style={styles.footerAbout}>
            <Text style={styles.footerDescription}>
              Luxy.Love là nền tảng hẹn hò dành cho người trưởng thành có định hướng, ưu tiên kết nối chất lượng, quyền riêng tư và trải nghiệm an toàn.
            </Text>
            <Text style={styles.footerSafety}>
              Thành viên không mặc nhiên được coi là đã qua kiểm tra lý lịch. Các dấu xác thực chỉ phản ánh đúng loại xác thực đã hoàn tất trên hệ thống.
            </Text>
            <Text style={styles.footerCopyright}>© 2026 Luxy.Love. Bảo lưu mọi quyền.</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function PublicHeader({
  compact,
  compactPhone,
  menuOpen,
  onJoin,
  onLogin,
  onMenu,
  onNavigate,
}: {
  compact: boolean;
  compactPhone: boolean;
  menuOpen: boolean;
  onJoin: () => void;
  onLogin: () => void;
  onMenu: () => void;
  onNavigate: (id: string) => void;
}) {
  if (compact) {
    return (
      <View style={styles.mobileHeader}>
        <Text style={[styles.headerBrand, compactPhone && styles.headerBrandCompact]}>{compactPhone ? luxyBrand.shortName : luxyBrand.productName}</Text>
        <View style={styles.mobileHeaderActions}>
          <Pressable accessibilityRole="button" onPress={onLogin} style={({ pressed }) => [styles.mobileLogin, pressed && styles.pressed]}>
            <Text style={styles.headerLink}>Đăng nhập</Text>
          </Pressable>
          <Pressable accessibilityLabel={menuOpen ? 'Đóng menu' : 'Mở menu'} accessibilityRole="button" onPress={onMenu} style={({ pressed }) => [styles.mobileMenuButton, pressed && styles.pressed]}>
            <Text style={styles.mobileMenuButtonText}>{menuOpen ? 'Đóng' : 'Menu'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.desktopHeader}>
      <Text style={styles.headerBrand}>{luxyBrand.productName}</Text>
      <View style={styles.desktopNav}>
        <HeaderLink label="Giới thiệu" onPress={() => onNavigate('luxy-mindset')} />
        <HeaderLink label="Cách hoạt động" onPress={() => onNavigate('luxy-benefits')} />
        <HeaderLink label="An toàn" onPress={() => onNavigate('luxy-safety')} />
        <HeaderLink label="Giá trị Luxy" onPress={() => onNavigate('luxy-values')} />
      </View>
      <View style={styles.desktopActions}>
        <Pressable accessibilityRole="button" onPress={onLogin} style={({ pressed }) => [styles.loginButton, pressed && styles.pressed]}>
          <Text style={styles.headerLink}>Đăng nhập</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onJoin} style={({ pressed }) => [styles.headerJoin, pressed && styles.pressed]}>
          <Text style={styles.headerJoinText}>Tham gia ngay</Text>
        </Pressable>
      </View>
    </View>
  );
}

function HeaderLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.headerNavButton, pressed && styles.pressed]}>
      <Text style={styles.headerLink}>{label}</Text>
    </Pressable>
  );
}

function MenuLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.menuLink, pressed && styles.pressed]}>
      <Text style={styles.menuLinkText}>{label}</Text>
    </Pressable>
  );
}

function Benefit({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.benefitItem}>
      <Text style={styles.benefitTitle}>{title}</Text>
      <Text style={styles.benefitCopy}>{children}</Text>
    </View>
  );
}

function FooterLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.footerLinkButton, pressed && styles.pressed]}>
      <Text style={styles.footerLinkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#FBF8F6', flexGrow: 1 },
  loadingContainer: { alignItems: 'center', backgroundColor: luxyColors.surface, flex: 1, gap: luxySpacing.lg, justifyContent: 'center', padding: luxySpacing.xl },
  loadingBrand: { color: luxyColors.brandCoral, fontFamily: luxyTypography.families.brand, fontSize: 36, letterSpacing: -1.4 },
  loadingCopy: { color: luxyColors.muted, fontSize: 14 },
  hero: { minHeight: 720, position: 'relative', width: '100%' },
  heroPhone: { minHeight: 690 },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 17, 29, 0.24)' },
  desktopHeader: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', height: 72, maxWidth: 1440, paddingHorizontal: 40, position: 'relative', width: '100%', zIndex: 20 },
  mobileHeader: { alignItems: 'center', flexDirection: 'row', height: 64, justifyContent: 'space-between', paddingHorizontal: luxySpacing.lg, position: 'relative', width: '100%', zIndex: 30 },
  headerBrand: { color: luxyColors.surface, fontFamily: luxyTypography.families.brand, fontSize: 28, letterSpacing: -1.2 },
  headerBrandCompact: { fontSize: 26 },
  desktopNav: { alignItems: 'stretch', flex: 1, flexDirection: 'row', gap: 8, marginLeft: 30 },
  desktopActions: { alignItems: 'center', flexDirection: 'row', gap: 16 },
  mobileHeaderActions: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  headerNavButton: { alignItems: 'center', justifyContent: 'center', minHeight: luxyLayout.minimumTouchTarget, paddingHorizontal: 12 },
  headerLink: { color: luxyColors.surface, fontSize: 15, fontWeight: '500' },
  loginButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  mobileLogin: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  mobileMenuButton: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.68)', borderRadius: luxyRadii.pill, borderWidth: 1, justifyContent: 'center', minHeight: 44, minWidth: 58, paddingHorizontal: 12 },
  mobileMenuButtonText: { color: luxyColors.surface, fontSize: 13, fontWeight: '600' },
  headerJoin: { alignItems: 'center', backgroundColor: luxyColors.actionRed, borderRadius: luxyRadii.pill, justifyContent: 'center', minHeight: 44, minWidth: 124, paddingHorizontal: 20 },
  headerJoinText: { color: luxyColors.surface, fontSize: 14, fontWeight: '700' },
  mobileMenu: { backgroundColor: 'rgba(8,23,38,0.97)', borderColor: 'rgba(255,255,255,0.18)', borderRadius: 12, borderWidth: 1, gap: 2, padding: 10, position: 'absolute', right: 16, top: 62, width: 228, zIndex: 40 },
  menuLink: { justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  menuLinkText: { color: luxyColors.surface, fontSize: 15 },
  menuJoinButton: { alignItems: 'center', backgroundColor: luxyColors.actionRed, borderRadius: luxyRadii.pill, justifyContent: 'center', marginTop: 8, minHeight: 44 },
  menuJoinText: { color: luxyColors.surface, fontWeight: '700' },
  heroContent: { alignItems: 'center', alignSelf: 'center', justifyContent: 'center', maxWidth: 690, minHeight: 620, paddingBottom: 34, paddingHorizontal: 24, width: '100%' },
  heroContentPhone: { minHeight: 600, paddingBottom: 38, paddingTop: 40 },
  heroBrand: { color: luxyColors.surface, fontFamily: luxyTypography.families.display, fontSize: 88, letterSpacing: -4, lineHeight: 94, textAlign: 'center' },
  heroBrandPhone: { fontSize: 52, letterSpacing: -2.5, lineHeight: 60 },
  heroTitle: { color: luxyColors.surface, fontFamily: luxyTypography.families.display, fontSize: 29, fontWeight: '400', lineHeight: 38, marginTop: 10, textAlign: 'center' },
  heroTitlePhone: { fontSize: 25, lineHeight: 32, maxWidth: 340 },
  heroSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 16, lineHeight: 24, marginTop: 14, maxWidth: 590, textAlign: 'center' },
  heroSubtitlePhone: { fontSize: 15, lineHeight: 22, maxWidth: 350 },
  primaryCta: { alignItems: 'center', backgroundColor: luxyColors.actionRed, borderRadius: luxyRadii.pill, justifyContent: 'center', marginTop: 24, minHeight: 48, minWidth: 168, paddingHorizontal: 26 },
  primaryCtaText: { color: luxyColors.surface, fontSize: 15, fontWeight: '700' },
  mindsetSection: { alignItems: 'center', backgroundColor: '#FFFCFA', overflow: 'hidden', paddingHorizontal: 24, paddingTop: 92, position: 'relative' },
  sectionPhone: { paddingHorizontal: 18, paddingTop: 64 },
  mindsetAccentLeft: { borderColor: '#F2D8D2', borderRadius: 999, borderWidth: 18, height: 180, left: -126, opacity: 0.6, position: 'absolute', top: 130, width: 180 },
  mindsetAccentRight: { borderColor: '#F2D8D2', borderRadius: 999, borderWidth: 18, height: 180, opacity: 0.6, position: 'absolute', right: -126, top: 130, width: 180 },
  displayHeading: { color: luxyColors.ink, fontFamily: luxyTypography.families.display, fontSize: 42, fontWeight: '400', letterSpacing: -1.5, lineHeight: 48, textAlign: 'center' },
  displayHeadingPhone: { fontSize: 34, letterSpacing: -1, lineHeight: 40 },
  alignLeft: { textAlign: 'left' },
  centeredBody: { color: luxyColors.ink, fontSize: 16, lineHeight: 25, marginTop: 24, maxWidth: 600, textAlign: 'center' },
  mindsetSignature: { color: luxyColors.ink, fontFamily: luxyTypography.families.display, fontSize: 18, fontStyle: 'italic', marginTop: 26, textAlign: 'center' },
  sectionCta: { marginBottom: 42 },
  responsibleBlock: { alignItems: 'center', borderTopColor: '#E5E1DE', borderTopWidth: 1, maxWidth: 760, paddingBottom: 66, paddingHorizontal: 16, paddingTop: 36, width: '100%' },
  responsibleStrong: { color: luxyColors.ink, fontSize: 14, fontWeight: '700', lineHeight: 21, textAlign: 'center' },
  responsibleText: { color: luxyColors.ink, fontSize: 14, fontWeight: '600', lineHeight: 21, marginTop: 16, maxWidth: 650, textAlign: 'center' },
  testimonialSection: { alignItems: 'center', justifyContent: 'center', minHeight: 620, paddingHorizontal: 30, paddingVertical: 70, position: 'relative' },
  testimonialSectionPhone: { minHeight: 590, paddingHorizontal: 16, paddingVertical: 58 },
  testimonialOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,20,31,0.16)' },
  testimonialHeading: { color: luxyColors.surface, fontFamily: luxyTypography.families.display, fontSize: 38, fontWeight: '400', marginBottom: 24, position: 'relative', textAlign: 'center' },
  testimonialHeadingPhone: { fontSize: 32 },
  testimonialRail: { alignItems: 'center', flexDirection: 'row', gap: 24, maxWidth: 980, position: 'relative', width: '100%' },
  testimonialRailPhone: { gap: 8 },
  arrowButton: { alignItems: 'center', justifyContent: 'center', minHeight: 52, minWidth: 52 },
  arrowButtonPhone: { minWidth: 36 },
  arrowText: { color: luxyColors.surface, fontFamily: luxyTypography.families.display, fontSize: 56, fontWeight: '300', lineHeight: 60 },
  quoteCard: { backgroundColor: 'rgba(8,23,38,0.96)', borderRadius: 10, flex: 1, maxWidth: 690, minHeight: 245, padding: 34 },
  quoteCardPhone: { minHeight: 300, padding: 24 },
  quoteText: { color: luxyColors.surface, fontSize: 16, lineHeight: 25 },
  quoteTextPhone: { fontSize: 14.5, lineHeight: 23 },
  quoteAuthor: { color: luxyColors.surface, fontSize: 14, fontWeight: '700', marginTop: 24, textAlign: 'right' },
  quotePlace: { color: 'rgba(255,255,255,0.78)', fontWeight: '400' },
  benefitsSection: { backgroundColor: '#FFFCFA', paddingHorizontal: 24, paddingTop: 80 },
  benefitsInner: { alignSelf: 'center', gap: 44, maxWidth: 1120, width: '100%' },
  benefitsInnerWide: { alignItems: 'flex-start', flexDirection: 'row', gap: 64 },
  benefitsCopy: { flex: 1 },
  benefitItem: { marginTop: 30 },
  benefitTitle: { color: luxyColors.ink, fontFamily: luxyTypography.families.display, fontSize: 28, fontStyle: 'italic', lineHeight: 34 },
  benefitCopy: { color: luxyColors.ink, fontSize: 15, lineHeight: 23, marginTop: 8, maxWidth: 550 },
  benefitsArtFrame: { borderTopLeftRadius: 220, borderTopRightRadius: 220, flex: 1, height: 650, maxWidth: 475, overflow: 'hidden', width: '100%' },
  benefitsArtFramePhone: { alignSelf: 'center', borderTopLeftRadius: 170, borderTopRightRadius: 170, height: 500, marginTop: 10, maxWidth: 390 },
  fillImage: { height: '100%', width: '100%' },
  benefitsCtaBlock: { alignItems: 'center', alignSelf: 'center', maxWidth: 780, paddingBottom: 68, paddingTop: 62, width: '100%' },
  benefitsPrompt: { color: luxyColors.ink, fontSize: 16, fontWeight: '700', lineHeight: 23, textAlign: 'center' },
  ctaDisplay: { color: luxyColors.ink, fontFamily: luxyTypography.families.display, fontSize: 33, lineHeight: 37, marginTop: 26, textAlign: 'center' },
  ctaDisplayPhone: { fontSize: 29, lineHeight: 34 },
  missionSection: { alignItems: 'center', backgroundColor: luxyColors.ink, paddingBottom: 68, paddingHorizontal: 24, paddingTop: 66 },
  missionSectionPhone: { paddingHorizontal: 18, paddingVertical: 58 },
  missionHeading: { color: luxyColors.surface, fontFamily: luxyTypography.families.display, fontSize: 42, fontWeight: '400', lineHeight: 48, textAlign: 'center' },
  missionBody: { color: 'rgba(255,255,255,0.9)', fontSize: 15.5, lineHeight: 24, marginTop: 22, maxWidth: 610, textAlign: 'center' },
  missionCta: { marginTop: 30 },
  valuesSection: { alignItems: 'center', backgroundColor: '#FFFCFA', paddingBottom: 92, paddingHorizontal: 24, paddingTop: 82 },
  valuesInner: { alignItems: 'stretch', gap: 36, marginTop: 54, maxWidth: 1020, width: '100%' },
  valuesInnerWide: { alignItems: 'center', flexDirection: 'row', gap: 80 },
  valuesArtFrame: { borderRadius: 230, height: 500, overflow: 'hidden', width: 430 },
  valuesArtFramePhone: { alignSelf: 'center', height: 350, maxWidth: 350, width: '100%' },
  valuesList: { flex: 1, minWidth: 0 },
  valueRow: { alignItems: 'center', borderBottomColor: '#E6DEDA', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 58, paddingHorizontal: 4 },
  valueRowSelected: { borderBottomColor: luxyColors.brandCoral },
  valueTitle: { color: luxyColors.ink, fontFamily: luxyTypography.families.display, fontSize: 26 },
  valueTitleSelected: { color: luxyColors.actionRed },
  valueArrow: { color: luxyColors.brandCoral, fontFamily: luxyTypography.families.display, fontSize: 34 },
  valueCopyBox: { minHeight: 126, paddingTop: 22 },
  valueCopyTitle: { color: luxyColors.ink, fontSize: 14, fontWeight: '700', textTransform: 'uppercase' },
  valueCopy: { color: luxyColors.muted, fontSize: 14.5, lineHeight: 22, marginTop: 8 },
  finalSection: { alignItems: 'center', justifyContent: 'center', minHeight: 560, padding: 30, position: 'relative' },
  finalSectionPhone: { minHeight: 520, paddingHorizontal: 18 },
  finalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,13,23,0.2)' },
  finalCard: { alignItems: 'center', backgroundColor: 'rgba(8,23,38,0.82)', maxWidth: 640, paddingHorizontal: 68, paddingVertical: 48, position: 'relative', width: '100%' },
  finalCardPhone: { paddingHorizontal: 26, paddingVertical: 38 },
  finalTitle: { color: luxyColors.surface, fontFamily: luxyTypography.families.display, fontSize: 38, lineHeight: 43, textAlign: 'center' },
  finalTitlePhone: { fontSize: 31, lineHeight: 36 },
  finalFree: { color: luxyColors.surface, fontFamily: luxyTypography.families.display, fontSize: 24, marginTop: 22, textAlign: 'center' },
  finalButton: { marginTop: 22 },
  footer: { alignSelf: 'center', backgroundColor: '#FFFCFA', maxWidth: 1200, paddingBottom: 52, paddingHorizontal: 24, paddingTop: 52, width: '100%' },
  footerPhone: { paddingHorizontal: 18, paddingVertical: 44 },
  footerBrand: { color: luxyColors.brandCoral, fontFamily: luxyTypography.families.brand, fontSize: 34, textAlign: 'center' },
  footerLanguage: { color: luxyColors.ink, fontSize: 13, marginTop: 18, textAlign: 'center', textDecorationLine: 'underline' },
  footerColumns: { borderTopColor: '#E6DEDA', borderTopWidth: 1, gap: 24, marginTop: 32, paddingTop: 32 },
  footerColumnsWide: { alignItems: 'flex-start', flexDirection: 'row' },
  footerLinks: { minWidth: 180 },
  footerLinkButton: { justifyContent: 'center', minHeight: 34 },
  footerLinkText: { color: luxyColors.ink, fontSize: 13, textDecorationLine: 'underline' },
  footerAbout: { flex: 1, maxWidth: 540 },
  footerDescription: { color: luxyColors.ink, fontSize: 13, lineHeight: 19 },
  footerSafety: { color: luxyColors.ink, fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 18, textTransform: 'uppercase' },
  footerCopyright: { color: luxyColors.muted, fontSize: 11, fontWeight: '600', marginTop: 24 },
  pressed: { opacity: 0.72 },
});
