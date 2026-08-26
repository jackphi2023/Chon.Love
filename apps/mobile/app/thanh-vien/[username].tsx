import {
  CHON_PUBLIC_PROFILE_DESCRIPTION,
  getPublicChonProfileV2,
  publicProfileAvatarUrl,
  publicProfileCodeFromRouteId,
  publicProfileMediaUrl,
  type PublicChonProfileV2,
} from '@myfan/supabase';
import { chonColors, chonShadows, chonTypography } from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { ChonLoveLogo } from '@/components/chon-love-logo';
import { ChonMembershipBadge } from '@/components/chon-membership-badge';
import ChonMemberProfileScreen from '@/screens/chon-member-profile-screen';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const TITLE_SUFFIX = 'Chọn.love - Chọn đúng Người, Yêu đúng Gu';
const PRODUCTION_ORIGIN = 'https://www.chon.love';

function normalizeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function upsertMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  if (typeof document === 'undefined') return;
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function useMemberSeo(profile: PublicChonProfileV2 | null, avatarUrl: string | null) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !profile) return;
    const title = `Thành viên ${profile.display_name} | ${TITLE_SUFFIX}`;
    const canonicalUrl = `${PRODUCTION_ORIGIN}/thanh-vien/id-${profile.public_profile_code}`;
    document.title = title;
    upsertMeta('meta[name="description"]', 'name', 'description', CHON_PUBLIC_PROFILE_DESCRIPTION);
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', CHON_PUBLIC_PROFILE_DESCRIPTION);
    upsertMeta('meta[property="og:type"]', 'property', 'og:type', 'profile');
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', CHON_PUBLIC_PROFILE_DESCRIPTION);
    if (avatarUrl) {
      upsertMeta('meta[property="og:image"]', 'property', 'og:image', avatarUrl);
      upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', avatarUrl);
    }
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
  }, [avatarUrl, profile]);
}

export default function CanonicalMemberProfilePage() {
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  const routeId = normalizeParam(params.username).trim().toLowerCase();
  const code = publicProfileCodeFromRouteId(routeId);
  const client = getMobileSupabaseClient();
  const auth = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 720;
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ['public-chon-profile', code],
    enabled: Boolean(client && code),
    staleTime: 60_000,
    queryFn: async () => {
      if (!client || !code) return null;
      return getPublicChonProfileV2(client, code);
    },
  });

  const profile = profileQuery.data ?? null;
  const avatarUrl = useMemo(
    () => (client && code && profile?.avatar_available ? publicProfileAvatarUrl(client, code) : null),
    [client, code, profile?.avatar_available],
  );
  const publicMedia = useMemo(() => {
    if (!client || !code || !profile) return [];
    return profile.public_media_ids.map((mediaId) => ({
      mediaId,
      url: publicProfileMediaUrl(client, code, mediaId),
    }));
  }, [client, code, profile]);
  useMemberSeo(profile, avatarUrl);

  if (!code) return <Redirect href="/" />;
  if (profileQuery.isLoading) return <MemberLoading />;
  if (profileQuery.isError || !profile) return <Redirect href="/" />;

  if (auth.userId) return <ChonMemberProfileScreen />;

  return (
    <>
      <ScrollView contentContainerStyle={styles.pageContent} style={styles.page} testID="public-member-profile-page">
        <View style={[styles.topbar, isCompact && styles.topbarCompact]}>
          <Pressable
            accessibilityLabel="Chọn.love — về trang chủ"
            accessibilityRole="button"
            onPress={() => router.push('/')}
            style={styles.logoButton}
            testID="public-member-profile-logo"
          >
            <ChonLoveLogo height={isCompact ? 34 : 42} width={isCompact ? 112 : 140} />
          </Pressable>
          <View style={styles.topActions}>
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/auth', params: { mode: 'login' } })} style={[styles.linkButton, isCompact && styles.linkButtonCompact]}><Text style={styles.linkButtonText}>Đăng nhập</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/auth')} style={[styles.primarySmall, isCompact && styles.primarySmallCompact]}><Text style={styles.primarySmallText}>Đăng ký</Text></Pressable>
          </View>
        </View>

        <View style={[styles.profileCard, isCompact && styles.profileCardCompact]}>
          <View style={[styles.photoColumn, isCompact && styles.photoColumnCompact]}>
            <View style={[styles.photoFrame, isCompact && styles.photoFrameCompact]}>
              {avatarUrl ? <Image accessibilityLabel={`Ảnh đại diện của ${profile.display_name}`} resizeMode="cover" source={{ uri: avatarUrl }} style={styles.photo} /> : <View style={styles.photoFallback}><Text style={styles.photoFallbackText}>{profile.display_name.slice(0, 1).toUpperCase()}</Text></View>}
              {profile.membership_badge_visible ? <ChonMembershipBadge desktop={!isCompact} inset={10} placement="top-left" size="large" tier={profile.membership_tier} /> : null}
            </View>
          </View>

          <View style={styles.profileCopy}>
            <Text accessibilityRole="header" style={[styles.name, isCompact && styles.nameCompact]}>{profile.display_name}, {profile.age}</Text>
            <Text style={styles.location}>{profile.province_name ?? 'Việt Nam'}</Text>
            {profile.headline ? <Text style={styles.headline}>{profile.headline}</Text> : null}

            {publicMedia.length > 0 || profile.private_photo_count > 0 ? (
              <ScrollView
                contentContainerStyle={styles.publicGalleryContent}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.publicGallery}
                testID="public-member-profile-gallery"
              >
                {publicMedia.map(({ mediaId, url }) => (
                  <Pressable
                    accessibilityLabel={`Xem ảnh của ${profile.display_name}`}
                    accessibilityRole="button"
                    key={mediaId}
                    onPress={() => setSelectedPhotoUrl(url)}
                    style={({ pressed }) => [styles.publicGalleryTile, isCompact && styles.publicGalleryTileCompact, pressed && styles.pressed]}
                    testID="public-member-profile-photo-tile"
                  >
                    <Image accessibilityLabel={`Ảnh của ${profile.display_name}`} resizeMode="cover" source={{ uri: url }} style={styles.publicGalleryImage} />
                  </Pressable>
                ))}
                {profile.private_photo_count > 0 ? (
                  <View style={[styles.privateLockedTile, isCompact && styles.privateLockedTileCompact]} testID="public-member-private-photo-lock">
                    <View style={styles.privateLockMark}><Text style={styles.privateLockMarkText}>Ảnh riêng tư ({profile.private_photo_count})</Text></View>
                    <Text style={styles.privateLockText}>Thành viên Premium và Diamond được xem đầy đủ.</Text>
                  </View>
                ) : null}
              </ScrollView>
            ) : null}

            <ProfileSection title="Về tôi">
              <Text style={styles.body}>{profile.bio || 'Chưa có phần giới thiệu.'}</Text>
              {profile.interests.length ? <Text style={styles.metaText}>Sở thích: {profile.interests.join(' · ')}</Text> : null}
            </ProfileSection>

            <View style={styles.section}>
              <View style={styles.publicSeekingHeading}><Text style={styles.sectionTitle}>Tôi đang tìm kiếm</Text><Text style={styles.publicSeekingValue}>{publicInterestedInLabel(profile.interested_in)}</Text></View>
              <Text style={styles.body}>{profile.looking_for || 'Một kết nối chất lượng, tôn trọng và có chủ đích.'}</Text>
              {profile.lifestyle_tags.length ? <View style={styles.tags}>{profile.lifestyle_tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{publicLifestyleLabel(tag)}</Text></View>)}</View> : null}
            </View>

            <View style={styles.publicInfoList} testID="public-member-profile-info-list">
              {publicProfileFacts(profile).map(([label, value]) => <View key={label} style={styles.publicInfoRow}><Text style={styles.publicInfoLabel}>{label}</Text><Text style={styles.publicInfoValue}>{value}</Text></View>)}
            </View>

            <View style={styles.joinCard}>
              <Text style={styles.joinTitle}>Kết nối với những người thật trên Chọn.love</Text>
              <Text style={styles.joinCopy}>{CHON_PUBLIC_PROFILE_DESCRIPTION}</Text>
              <View style={styles.joinActions}>
                <Pressable accessibilityRole="button" onPress={() => router.push('/auth')} style={[styles.primaryButton, isCompact && styles.fullWidthButton]}><Text style={styles.primaryButtonText}>Đăng ký miễn phí</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/auth', params: { mode: 'login' } })} style={[styles.outlineButton, isCompact && styles.fullWidthButton]}><Text style={styles.outlineButtonText}>Đăng nhập</Text></Pressable>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      <PublicProfilePhotoLightbox
        displayName={profile.display_name}
        imageUrl={selectedPhotoUrl}
        onClose={() => setSelectedPhotoUrl(null)}
      />
    </>
  );
}

function PublicProfilePhotoLightbox({ displayName, imageUrl, onClose }: { displayName: string; imageUrl: string | null; onClose: () => void }) {
  const { height, width } = useWindowDimensions();
  const imageHeight = Math.max(320, Math.min(height - 56, 920));
  const cardWidth = Math.max(280, Math.min(width - 24, 1180));

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={Boolean(imageUrl)}>
      <View style={styles.lightboxBackdrop} testID="public-member-profile-photo-lightbox">
        <Pressable accessibilityLabel="Đóng ảnh" accessibilityRole="button" onPress={onClose} style={styles.lightboxDismiss} />
        <View accessibilityViewIsModal style={[styles.lightboxCard, { width: cardWidth }]}>
          <Pressable accessibilityLabel="Đóng" accessibilityRole="button" onPress={onClose} style={styles.lightboxClose}>
            <Text style={styles.lightboxCloseText}>×</Text>
          </Pressable>
          {imageUrl ? (
            <Image
              accessibilityLabel={`Ảnh lớn của ${displayName}`}
              resizeMode="contain"
              source={{ uri: imageUrl }}
              style={[styles.lightboxImage, { height: imageHeight }]}
              testID="public-member-profile-photo-lightbox-image"
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function publicInterestedInLabel(value: PublicChonProfileV2['interested_in']): string { return value === 'female' ? 'Nữ' : value === 'male' ? 'Nam' : 'Nam / Nữ'; }
function publicLifestyleLabel(value: string): string {
  const labels: Record<string, string> = { true_love: 'Tình yêu đích thực', luxury_lifestyle: 'Phong cách sống cao cấp', active_lifestyle: 'Năng động', flexible_schedule: 'Lịch trình linh hoạt', emotional_connection: 'Kết nối cảm xúc', refined: 'Tinh tế', fine_dining: 'Ẩm thực cao cấp', friendship: 'Bạn bè', long_term: 'Lâu dài', marriage_minded: 'Hướng đến hôn nhân', monogamous: 'Một vợ một chồng', romantic: 'Lãng mạn', ready_to_travel: 'Sẵn sàng du lịch', travel_companion: 'Bạn đồng hành du lịch', vacation: 'Kỳ nghỉ', entertainment_events: 'Giải trí & sự kiện', platonic: 'Thuần bạn bè' };
  return labels[value] ?? value;
}
function publicProfileFacts(profile: PublicChonProfileV2): Array<[string, string]> {
  const labels: Record<string, string> = {
    single: 'Độc thân', divorced: 'Đã ly hôn', widowed: 'Goá', open: 'Quan hệ mở', complicated: 'Phức tạp', prefer_not_to_say: 'Chưa chia sẻ',
    no_children: 'Chưa có con', has_children: 'Đã có con', never: 'Không', socially: 'Xã giao', regularly: 'Thường xuyên', trying_to_quit: 'Đang cố bỏ',
    high_school: 'THPT', vocational: 'Trung cấp / nghề', college: 'Cao đẳng', bachelors: 'Đại học', masters: 'Thạc sĩ', doctorate: 'Tiến sĩ', other: 'Khác',
    female: 'Nữ', male: 'Nam', non_binary: 'Phi nhị nguyên',
  };
  return [
    ['Chiều cao', profile.height_cm ? `${profile.height_cm} cm` : 'Chưa chia sẻ'],
    ['Cân nặng', profile.weight_kg ? `${profile.weight_kg} kg` : 'Chưa chia sẻ'],
    ['Tình trạng mối quan hệ', labels[profile.relationship_status ?? ''] ?? 'Chưa chia sẻ'],
    ['Giới tính', labels[profile.gender ?? ''] ?? 'Chưa chia sẻ'],
    ['Con cái', labels[profile.children_status] ?? 'Chưa chia sẻ'],
    ['Học vấn', labels[profile.education_level ?? ''] ?? 'Chưa chia sẻ'],
    ['Hút thuốc', labels[profile.smoking_status] ?? 'Chưa chia sẻ'],
    ['Uống rượu bia', labels[profile.drinking_status] ?? 'Chưa chia sẻ'],
    ['Nghề nghiệp', profile.occupation || 'Chưa chia sẻ'],
  ];
}

function ProfileSection({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function MemberLoading() {
  return <View style={styles.centered}><ActivityIndicator color={chonColors.primaryRed} size="large" /><Text style={styles.muted}>Đang tải hồ sơ thành viên…</Text></View>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: chonColors.warmSurface, flex: 1 },
  pageContent: { alignItems: 'center', minHeight: '100%', paddingBottom: 64 },
  topbar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', maxWidth: 1180, paddingHorizontal: 20, paddingVertical: 18, width: '100%' },
  topbarCompact: { paddingHorizontal: 14, paddingVertical: 13 },
  logoButton: { alignItems: 'flex-start', justifyContent: 'center', minHeight: 44, minWidth: 112 },
  topActions: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  linkButton: { justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  linkButtonCompact: { paddingHorizontal: 7 },
  linkButtonText: { color: chonColors.text, fontSize: chonTypography.sizes.body, fontWeight: '600' },
  primarySmall: { alignItems: 'center', backgroundColor: chonColors.primaryRed, borderRadius: 999, justifyContent: 'center', minHeight: 44, paddingHorizontal: 18 },
  primarySmallCompact: { paddingHorizontal: 13 },
  primarySmallText: { color: '#FFFFFF', fontSize: chonTypography.sizes.body, fontWeight: '700' },
  profileCard: { alignItems: 'flex-start', backgroundColor: chonColors.surface, borderColor: chonColors.border, borderRadius: 22, borderWidth: 1, flexDirection: 'row', gap: 30, maxWidth: 1040, padding: 24, width: '94%', ...chonShadows.card },
  profileCardCompact: { borderRadius: 16, flexDirection: 'column', gap: 20, padding: 14, width: '94%' },
  photoColumn: { maxWidth: 340, width: '38%' },
  photoColumnCompact: { maxWidth: '100%', width: '100%' },
  photoFrame: { aspectRatio: 0.8, backgroundColor: chonColors.warmSurface, borderRadius: 18, overflow: 'hidden', position: 'relative', width: '100%' },
  photoFrameCompact: { aspectRatio: 0.92, borderRadius: 14 },
  photo: { height: '100%', width: '100%' },
  photoFallback: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  photoFallbackText: { color: chonColors.muted, fontFamily: chonTypography.families.display, fontSize: 72 },
  profileCopy: { flex: 1, minWidth: 0, paddingVertical: 6, width: '100%' },
  name: { color: chonColors.text, fontFamily: chonTypography.families.display, fontSize: chonTypography.sizes.h1Desktop, lineHeight: chonTypography.lineHeights.h1Desktop },
  nameCompact: { fontSize: chonTypography.sizes.h2, lineHeight: chonTypography.lineHeights.h2 },
  location: { color: chonColors.text, fontSize: chonTypography.sizes.h3, marginTop: 3 },
  headline: { color: chonColors.muted, fontSize: chonTypography.sizes.body, lineHeight: chonTypography.lineHeights.body, marginTop: 7 },
  section: { borderTopColor: chonColors.border, borderTopWidth: 1, gap: 9, marginTop: 22, paddingTop: 18 },
  sectionTitle: { color: chonColors.text, fontFamily: chonTypography.families.display, fontSize: chonTypography.sizes.h2, fontWeight: '600' },
  body: { color: chonColors.text, fontSize: chonTypography.sizes.body, lineHeight: chonTypography.lineHeights.body },
  publicGallery: { marginHorizontal: -4, marginTop: 22 },
  publicGalleryContent: { gap: 10, paddingHorizontal: 4, paddingVertical: 2 },
  publicGalleryTile: { backgroundColor: chonColors.warmSurface, borderRadius: 12, height: 288, overflow: 'hidden', width: 230 },
  publicGalleryTileCompact: { height: 270, width: 216 },
  publicGalleryImage: { height: '100%', width: '100%' },
  privateLockedTile: { alignItems: 'center', backgroundColor: chonColors.warmSurface, borderColor: chonColors.gold, borderRadius: 12, borderWidth: 1, gap: 10, height: 288, justifyContent: 'center', padding: 12, width: 230 },
  privateLockedTileCompact: { height: 270, width: 216 },
  privateLockMark: { borderColor: chonColors.goldStrong, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  privateLockMarkText: { color: chonColors.goldStrong, fontSize: chonTypography.sizes.help, fontWeight: '800', textAlign: 'center' },
  privateLockText: { color: chonColors.muted, fontSize: chonTypography.sizes.help, lineHeight: chonTypography.lineHeights.help, textAlign: 'center' },
  metaText: { color: chonColors.muted, fontSize: chonTypography.sizes.help, lineHeight: chonTypography.lineHeights.help },
  publicSeekingHeading: { alignItems: 'baseline', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  publicSeekingValue: { color: chonColors.goldStrong, fontFamily: chonTypography.families.display, fontSize: chonTypography.sizes.h2, fontWeight: '600', lineHeight: chonTypography.lineHeights.h2, marginLeft: 'auto', textAlign: 'right' },
  publicInfoList: { gap: 2, marginTop: 22 },
  publicInfoRow: { alignItems: 'center', flexDirection: 'row', gap: 14, justifyContent: 'space-between', minHeight: 38, paddingVertical: 6 },
  publicInfoLabel: { color: chonColors.text, flex: 1, fontSize: chonTypography.sizes.body, fontWeight: '700' },
  publicInfoValue: { color: chonColors.text, flex: 1, fontSize: chonTypography.sizes.body, textAlign: 'right' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: chonColors.warmSurfaceStrong, borderColor: chonColors.gold, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  tagText: { color: chonColors.goldStrong, fontSize: chonTypography.sizes.body, fontWeight: '700' },
  joinCard: { backgroundColor: chonColors.warmSurface, borderColor: chonColors.gold, borderRadius: 16, borderWidth: 1, gap: 9, marginTop: 26, padding: 18 },
  joinTitle: { color: chonColors.text, fontFamily: chonTypography.families.display, fontSize: chonTypography.sizes.h3, fontWeight: '700' },
  joinCopy: { color: chonColors.muted, fontSize: chonTypography.sizes.body, lineHeight: chonTypography.lineHeights.body },
  joinActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 3 },
  primaryButton: { alignItems: 'center', backgroundColor: chonColors.primaryRed, borderRadius: 999, justifyContent: 'center', minHeight: 46, paddingHorizontal: 22 },
  primaryButtonText: { color: '#FFFFFF', fontSize: chonTypography.sizes.body, fontWeight: '700' },
  outlineButton: { alignItems: 'center', borderColor: chonColors.gold, borderRadius: 999, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 22 },
  outlineButtonText: { color: chonColors.text, fontSize: chonTypography.sizes.body, fontWeight: '700' },
  fullWidthButton: { width: '100%' },
  centered: { alignItems: 'center', backgroundColor: chonColors.warmSurface, flex: 1, gap: 12, justifyContent: 'center', padding: 24 },
  muted: { color: chonColors.muted, fontSize: chonTypography.sizes.body },
  lightboxBackdrop: { alignItems: 'center', backgroundColor: chonColors.overlay, flex: 1, justifyContent: 'center', padding: 12 },
  lightboxDismiss: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  lightboxCard: { backgroundColor: '#070707', borderRadius: 14, maxWidth: '100%', overflow: 'hidden', position: 'relative', ...chonShadows.card },
  lightboxClose: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 22, height: 44, justifyContent: 'center', position: 'absolute', right: 10, top: 10, width: 44, zIndex: 4 },
  lightboxCloseText: { color: chonColors.text, fontSize: 32, fontWeight: '300', lineHeight: 34 },
  lightboxImage: { backgroundColor: '#070707', width: '100%' },
  pressed: { opacity: 0.78 },
});
