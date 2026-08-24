import {
  CHON_PUBLIC_PROFILE_DESCRIPTION,
  getPublicChonProfile,
  publicProfileAvatarUrl,
  publicProfileCodeFromRouteId,
  type PublicChonProfile,
} from '@myfan/supabase';
import { chonColors, chonShadows, chonTypography } from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
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

function useMemberSeo(profile: PublicChonProfile | null, avatarUrl: string | null) {
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

  const profileQuery = useQuery({
    queryKey: ['public-chon-profile', code],
    enabled: Boolean(client && code),
    staleTime: 60_000,
    queryFn: async () => {
      if (!client || !code) return null;
      return getPublicChonProfile(client, code);
    },
  });

  const profile = profileQuery.data ?? null;
  const avatarUrl = useMemo(
    () => (client && code && profile?.avatar_available ? publicProfileAvatarUrl(client, code) : null),
    [client, code, profile?.avatar_available],
  );
  useMemberSeo(profile, avatarUrl);

  if (!code) return <Redirect href="/" />;
  if (profileQuery.isLoading) return <MemberLoading />;
  if (profileQuery.isError || !profile) return <Redirect href="/" />;

  if (auth.userId) return <ChonMemberProfileScreen />;

  return (
    <ScrollView contentContainerStyle={styles.pageContent} style={styles.page} testID="public-member-profile-page">
      <View style={[styles.topbar, isCompact && styles.topbarCompact]}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/')}>
          <Text style={[styles.brand, isCompact && styles.brandCompact]}>Chọn.love</Text>
        </Pressable>
        <View style={styles.topActions}>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/auth', params: { mode: 'login' } })} style={[styles.linkButton, isCompact && styles.linkButtonCompact]}>
            <Text style={styles.linkButtonText}>Đăng nhập</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/auth')} style={[styles.primarySmall, isCompact && styles.primarySmallCompact]}>
            <Text style={styles.primarySmallText}>Đăng ký</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.profileCard, isCompact && styles.profileCardCompact]}>
        <View style={[styles.photoColumn, isCompact && styles.photoColumnCompact]}>
          <View style={[styles.photoFrame, isCompact && styles.photoFrameCompact]}>
            {avatarUrl ? (
              <Image accessibilityLabel={`Ảnh đại diện của ${profile.display_name}`} resizeMode="cover" source={{ uri: avatarUrl }} style={styles.photo} />
            ) : (
              <View style={styles.photoFallback}><Text style={styles.photoFallbackText}>{profile.display_name.slice(0, 1).toUpperCase()}</Text></View>
            )}
            {profile.membership_badge_visible ? (
              <ChonMembershipBadge desktop={!isCompact} inset={10} tier={profile.membership_tier} variant="icon" />
            ) : null}
          </View>
        </View>

        <View style={styles.profileCopy}>
          <Text accessibilityRole="header" style={[styles.name, isCompact && styles.nameCompact]}>{profile.display_name}, {profile.age}</Text>
          <Text style={styles.location}>{profile.province_name ?? 'Việt Nam'}</Text>
          {profile.headline ? <Text style={styles.headline}>{profile.headline}</Text> : null}
          {profile.bio ? <ProfileSection title="Giới thiệu"><Text style={styles.body}>{profile.bio}</Text></ProfileSection> : null}
          {profile.looking_for ? <ProfileSection title="Đang tìm kiếm"><Text style={styles.body}>{profile.looking_for}</Text></ProfileSection> : null}
          {profile.interests.length > 0 ? (
            <ProfileSection title="Sở thích">
              <View style={styles.tags}>{profile.interests.map((interest) => <View key={interest} style={styles.tag}><Text style={styles.tagText}>{interest}</Text></View>)}</View>
            </ProfileSection>
          ) : null}
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
  );
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
  brand: { color: chonColors.primaryRed, fontFamily: chonTypography.families.display, fontSize: chonTypography.sizes.h2, fontWeight: '700' },
  brandCompact: { fontSize: 22 },
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
});