import { colors, spacing } from '@myfan/ui';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
  ActivityIndicator,
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

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { userId, isRestoring } = useAuth();
  const isWide = width >= 820;

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
        <View style={styles.logoMark}><Text style={styles.logoMarkText}>M</Text></View>
        <Text style={styles.loadingTitle}>MyFan</Text>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingCopy}>Đang kiểm tra phiên đăng nhập…</Text>
      </View>
    );
  }

  const openLogin = () => router.push('/(auth)');

  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>M</Text></View>
          <View>
            <Text style={styles.brandName}>MyFan</Text>
            <Text style={styles.brandTagline}>Social Creator 18+</Text>
          </View>
        </View>
        <Pressable
          accessibilityLabel="Đăng nhập MyFan"
          accessibilityRole="button"
          onPress={openLogin}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Text style={styles.headerButtonText}>Đăng nhập</Text>
        </Pressable>
      </View>

      <View style={[styles.hero, isWide && styles.heroWide]}>
        <View style={[styles.heroCopy, isWide && styles.heroCopyWide]}>
          <View style={styles.agePill}>
            <Text style={styles.agePillText}>♥ CỘNG ĐỒNG CREATOR · CHỈ DÀNH CHO 18+</Text>
          </View>
          <Text accessibilityRole="header" style={[styles.heroTitle, isWide && styles.heroTitleWide]}>
            Kết nối Creator.{`\n`}
            <Text style={styles.heroTitleAccent}>Xây dựng cộng đồng.</Text>
          </Text>
          <Text style={styles.heroDescription}>
            Khám phá Creator, theo dõi Hoạt động, kết bạn và trò chuyện trong một không gian riêng tư, an toàn và có kiểm duyệt.
          </Text>
          <View style={[styles.heroActions, isWide && styles.heroActionsWide]}>
            <Pressable
              accessibilityLabel="Tham gia MyFan"
              accessibilityRole="button"
              onPress={openLogin}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>Tham gia MyFan</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Đăng nhập MyFan"
              accessibilityRole="button"
              onPress={openLogin}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>Đăng nhập</Text>
            </Pressable>
          </View>
          <Text style={styles.heroNote}>
            Quà tặng số không mua quyền gặp mặt, thông tin liên hệ riêng, quan hệ cá nhân hoặc nội dung người lớn.
          </Text>
        </View>

        <View style={[styles.phonePreview, isWide && styles.phonePreviewWide]}>
          <View style={styles.phoneTopRow}>
            <Text style={styles.phoneBrand}>MyFan</Text>
            <View style={styles.phoneAge}><Text style={styles.phoneAgeText}>18+</Text></View>
          </View>
          <View style={styles.creatorRow}>
            <View style={styles.creatorAvatar}><Text style={styles.creatorAvatarText}>C</Text></View>
            <View style={styles.creatorInfo}>
              <Text style={styles.creatorName}>Creator đã duyệt ✓</Text>
              <Text style={styles.creatorMeta}>@creator · vừa đăng</Text>
            </View>
          </View>
          <Text style={styles.postText}>Chia sẻ khoảnh khắc mới với cộng đồng MyFan.</Text>
          <View style={styles.mediaPreview}>
            <Text style={styles.mediaIcon}>✦</Text>
            <Text style={styles.mediaText}>Hoạt động có ảnh đã kiểm duyệt</Text>
          </View>
          <View style={styles.postActions}>
            <Text style={styles.postAction}>♡ Kết nối</Text>
            <Text style={styles.postAction}>↗ Chia sẻ</Text>
          </View>
          <View style={styles.giftRow}>
            <View style={styles.giftChip}><Text style={styles.giftText}>🌹 5 ❤️</Text></View>
            <View style={styles.giftChip}><Text style={styles.giftText}>🧸 7 ❤️</Text></View>
            <View style={styles.giftChip}><Text style={styles.giftText}>👑 20 ❤️</Text></View>
          </View>
        </View>
      </View>

      <View style={[styles.trustBar, isWide && styles.trustBarWide]}>
        <TrustItem value="18+" label="Chỉ dành cho người trưởng thành" />
        <TrustItem value="✓" label="Nội dung có quy trình kiểm duyệt" />
        <TrustItem value="🔒" label="Vị trí và dữ liệu riêng tư được bảo vệ" />
      </View>

      <View style={styles.section}>
        <Text style={styles.eyebrow}>MYFAN LÀ GÌ?</Text>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Một nơi để Creator xây dựng cộng đồng lâu dài</Text>
        <Text style={styles.sectionIntro}>
          MyFan kết hợp hồ sơ Creator, Hoạt động, kết bạn, chat sau khi kết bạn và quà tặng số trên cùng một nền tảng.
        </Text>
        <View style={[styles.featureGrid, isWide && styles.featureGridWide]}>
          <FeatureCard icon="✦" title="Khám phá phù hợp" copy="Tìm Creator theo tỉnh/thành và khoảng cách gần đúng, không công khai tọa độ chính xác." />
          <FeatureCard icon="◎" title="Kết nối có kiểm soát" copy="Chỉ trò chuyện sau khi hai bên trở thành bạn bè; chặn và báo cáo luôn dễ tiếp cận." />
          <FeatureCard icon="♥" title="Ủng hộ bằng quà số" copy="Danh mục quà hiển thị bằng ❤️, với giao dịch được xác minh tại máy chủ." />
        </View>
      </View>

      <View style={[styles.safetySection, isWide && styles.safetySectionWide]}>
        <View style={styles.safetyCopy}>
          <Text style={styles.safetyEyebrow}>RIÊNG TƯ VÀ AN TOÀN</Text>
          <Text accessibilityRole="header" style={styles.safetyTitle}>An toàn được xây vào từng luồng sử dụng</Text>
          <Text style={styles.safetyDescription}>
            MyFan tách dữ liệu hồ sơ công khai khỏi ngày sinh, tọa độ chính xác, KYC, ngân hàng và dữ liệu kiểm duyệt nội bộ.
          </Text>
        </View>
        <View style={styles.safetyList}>
          <SafetyItem number="01" title="Xác nhận đủ 18 tuổi" copy="Ngày sinh được kiểm tra trước khi hoàn tất onboarding." />
          <SafetyItem number="02" title="Kiểm duyệt nội dung" copy="Creator, Hoạt động và ảnh phải đạt điều kiện trước khi công khai." />
          <SafetyItem number="03" title="Quyền riêng tư theo quan hệ" copy="Nội dung có thể dành cho Công khai, Bạn bè hoặc Fan." />
        </View>
      </View>

      <View style={[styles.finalCta, isWide && styles.finalCtaWide]}>
        <View style={styles.finalCopy}>
          <Text style={styles.finalEyebrow}>BẮT ĐẦU VỚI MYFAN</Text>
          <Text accessibilityRole="header" style={styles.finalTitle}>Tham gia cộng đồng Social Creator 18+</Text>
          <Text style={styles.finalDescription}>Tạo hồ sơ, khám phá Creator và xây dựng kết nối có ý nghĩa.</Text>
        </View>
        <Pressable
          accessibilityLabel="Đăng nhập MyFan"
          accessibilityRole="button"
          onPress={openLogin}
          style={({ pressed }) => [styles.whiteButton, pressed && styles.pressed]}
        >
          <Text style={styles.whiteButtonText}>Đăng nhập / Tham gia</Text>
        </Pressable>
      </View>

      <Text style={styles.footer}>© 2026 MyFan · Social Creator 18+ · An toàn · Riêng tư · Có kiểm duyệt</Text>
    </ScrollView>
  );
}

function TrustItem({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.trustItem}>
      <Text style={styles.trustValue}>{value}</Text>
      <Text style={styles.trustLabel}>{label}</Text>
    </View>
  );
}

function FeatureCard({ icon, title, copy }: { icon: string; title: string; copy: string }) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureIcon}><Text style={styles.featureIconText}>{icon}</Text></View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureCopy}>{copy}</Text>
    </View>
  );
}

function SafetyItem({ number, title, copy }: { number: string; title: string; copy: string }) {
  return (
    <View style={styles.safetyItem}>
      <Text style={styles.safetyNumber}>{number}</Text>
      <View style={styles.safetyItemCopy}>
        <Text style={styles.safetyItemTitle}>{title}</Text>
        <Text style={styles.safetyItemDescription}>{copy}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: '#F7F8FC', paddingBottom: spacing.xl },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: '#F7F8FC' },
  logoMark: { width: 72, height: 72, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7557D9' },
  logoMarkText: { color: '#FFFFFF', fontSize: 36, fontWeight: '900' },
  loadingTitle: { color: colors.text, fontSize: 28, fontWeight: '900' },
  loadingCopy: { color: colors.muted, fontSize: 14 },
  header: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandMark: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7557D9' },
  brandMarkText: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
  brandName: { color: '#17132D', fontSize: 19, fontWeight: '900' },
  brandTagline: { color: '#7557D9', fontSize: 11, fontWeight: '800' },
  headerButton: { minHeight: 44, borderRadius: 14, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DED9EF' },
  headerButtonText: { color: '#5B42B5', fontSize: 14, fontWeight: '800' },
  hero: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: 52, gap: spacing.xl },
  heroWide: { flexDirection: 'row', alignItems: 'center', minHeight: 570, gap: 56 },
  heroCopy: { flex: 1 },
  heroCopyWide: { maxWidth: 620 },
  agePill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#EEE9FF' },
  agePillText: { color: '#684CC6', fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  heroTitle: { color: '#17132D', fontSize: 39, lineHeight: 47, fontWeight: '900', marginTop: spacing.lg },
  heroTitleWide: { fontSize: 58, lineHeight: 66 },
  heroTitleAccent: { color: '#7557D9' },
  heroDescription: { color: '#5D5870', fontSize: 17, lineHeight: 27, marginTop: spacing.md, maxWidth: 590 },
  heroActions: { marginTop: spacing.xl, gap: spacing.sm },
  heroActionsWide: { flexDirection: 'row' },
  primaryButton: { minHeight: 54, borderRadius: 16, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7557D9' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { minHeight: 54, borderRadius: 16, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8D1EC' },
  secondaryButtonText: { color: '#5B42B5', fontSize: 16, fontWeight: '900' },
  heroNote: { color: '#777188', fontSize: 12, lineHeight: 19, marginTop: spacing.md, maxWidth: 560 },
  phonePreview: { width: '100%', maxWidth: 390, alignSelf: 'center', borderRadius: 30, padding: spacing.lg, backgroundColor: '#17132D', shadowColor: '#2C1E5E', shadowOpacity: 0.2, shadowRadius: 28, shadowOffset: { width: 0, height: 16 }, elevation: 8 },
  phonePreviewWide: { flex: 1 },
  phoneTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  phoneBrand: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  phoneAge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#7557D9' },
  phoneAgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  creatorAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#A58BEF' },
  creatorAvatarText: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  creatorInfo: { flex: 1 },
  creatorName: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  creatorMeta: { color: '#AAA4BC', fontSize: 12, marginTop: 2 },
  postText: { color: '#EDEAF5', fontSize: 14, lineHeight: 21, marginTop: spacing.md },
  mediaPreview: { minHeight: 180, borderRadius: 20, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, marginTop: spacing.md, backgroundColor: '#2A2441' },
  mediaIcon: { color: '#B8A4F5', fontSize: 35 },
  mediaText: { color: '#CFC8E3', fontSize: 13, textAlign: 'center', marginTop: spacing.sm },
  postActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  postAction: { color: '#CFC8E3', fontSize: 12, fontWeight: '700' },
  giftRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.lg },
  giftChip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#3A315A' },
  giftText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  trustBar: { width: '100%', maxWidth: 1180, alignSelf: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: 52 },
  trustBarWide: { flexDirection: 'row' },
  trustItem: { flex: 1, minHeight: 112, borderRadius: 20, padding: spacing.lg, justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8E4F2' },
  trustValue: { color: '#7557D9', fontSize: 24, fontWeight: '900' },
  trustLabel: { color: '#5D5870', fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
  section: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingVertical: 58 },
  eyebrow: { color: '#7557D9', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { color: '#17132D', fontSize: 31, lineHeight: 39, fontWeight: '900', marginTop: spacing.sm, maxWidth: 720 },
  sectionIntro: { color: '#5D5870', fontSize: 16, lineHeight: 25, marginTop: spacing.md, maxWidth: 760 },
  featureGrid: { marginTop: spacing.xl, gap: spacing.md },
  featureGridWide: { flexDirection: 'row' },
  featureCard: { flex: 1, minHeight: 230, borderRadius: 22, padding: spacing.lg, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8E4F2' },
  featureIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEE9FF' },
  featureIconText: { color: '#7557D9', fontSize: 22, fontWeight: '900' },
  featureTitle: { color: '#17132D', fontSize: 18, fontWeight: '900', marginTop: spacing.lg },
  featureCopy: { color: '#686277', fontSize: 14, lineHeight: 22, marginTop: spacing.sm },
  safetySection: { width: '100%', maxWidth: 1180, alignSelf: 'center', borderRadius: 28, padding: spacing.xl, marginVertical: 42, backgroundColor: '#17132D', gap: spacing.xl },
  safetySectionWide: { flexDirection: 'row', marginHorizontal: spacing.lg, alignItems: 'center' },
  safetyCopy: { flex: 1 },
  safetyEyebrow: { color: '#B9A4F8', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  safetyTitle: { color: '#FFFFFF', fontSize: 30, lineHeight: 38, fontWeight: '900', marginTop: spacing.sm },
  safetyDescription: { color: '#C6C0D5', fontSize: 15, lineHeight: 24, marginTop: spacing.md },
  safetyList: { flex: 1, gap: spacing.md },
  safetyItem: { flexDirection: 'row', gap: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: '#342D4B' },
  safetyNumber: { color: '#A58BEF', fontSize: 14, fontWeight: '900' },
  safetyItemCopy: { flex: 1 },
  safetyItemTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  safetyItemDescription: { color: '#B9B3C8', fontSize: 13, lineHeight: 20, marginTop: 4 },
  finalCta: { width: '100%', maxWidth: 1180, alignSelf: 'center', marginTop: 40, marginBottom: 28, borderRadius: 28, padding: spacing.xl, backgroundColor: '#7557D9', gap: spacing.lg },
  finalCtaWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: spacing.lg },
  finalCopy: { flex: 1 },
  finalEyebrow: { color: '#DED4FF', fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  finalTitle: { color: '#FFFFFF', fontSize: 29, lineHeight: 37, fontWeight: '900', marginTop: spacing.sm },
  finalDescription: { color: '#EEE9FF', fontSize: 15, lineHeight: 23, marginTop: spacing.sm },
  whiteButton: { minHeight: 54, borderRadius: 16, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  whiteButtonText: { color: '#5B42B5', fontSize: 15, fontWeight: '900' },
  footer: { color: '#777188', fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
