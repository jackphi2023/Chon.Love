import {
  CHON_PUBLIC_PROFILE_DESCRIPTION,
  getPublicChonProfile,
  publicProfileAvatarUrl,
  publicProfileCodeFromRouteId,
  type PublicChonProfile,
} from '@myfan/supabase';
import { luxyColors, luxyRadii, luxyTypography } from '@myfan/ui';
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
  View,
} from 'react-native';
import LuxyMemberProfileScreen from '@/screens/luxy-member-profile-screen';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const TITLE_SUFFIX = 'Chọn.love - Chọn đúng Người, Yêu đúng Gu';

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
    if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof window === 'undefined' || !profile) return;
    const title = `Thành viên ${profile.display_name} | ${TITLE_SUFFIX}`;
    const canonicalUrl = `${window.location.origin}/thanh-vien/id-${profile.public_profile_code}`;
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

  // Signed-in members keep the complete existing profile experience (favorite,
  // messaging, private photos, safety actions and membership gates) while the
  // browser URL remains the canonical opaque public member ID.
  if (auth.userId) return <LuxyMemberProfileScreen />;

  return (
    <ScrollView contentContainerStyle={styles.pageContent} style={styles.page} testID="public-member-profile-page">
      <View style={styles.topbar}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/')}>
          <Text style={styles.brand}>Chọn.love</Text>
        </Pressable>
        <View style={styles.topActions}>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/auth', params: { mode: 'login' } })} style={styles.linkButton}>
            <Text style={styles.linkButtonText}>Đăng nhập</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/auth')} style={styles.primarySmall}>
            <Text style={styles.primarySmallText}>Đăng ký</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.photoColumn}>
          <View style={styles.photoFrame}>
            {avatarUrl ? (
              <Image accessibilityLabel={`Ảnh đại diện của ${profile.display_name}`} resizeMode="cover" source={{ uri: avatarUrl }} style={styles.photo} />
            ) : (
              <View style={styles.photoFallback}><Text style={styles.photoFallbackText}>{profile.display_name.slice(0, 1).toUpperCase()}</Text></View>
            )}
          </View>
          {profile.membership_badge_visible ? (
            <View style={styles.membershipBadge}><Text style={styles.membershipBadgeText}>{membershipLabel(profile.membership_tier)}</Text></View>
          ) : null}
        </View>

        <View style={styles.profileCopy}>
          <Text accessibilityRole="header" style={styles.name}>{profile.display_name}, {profile.age}</Text>
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
              <Pressable accessibilityRole="button" onPress={() => router.push('/auth')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Đăng ký miễn phí</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/auth', params: { mode: 'login' } })} style={styles.outlineButton}><Text style={styles.outlineButtonText}>Đăng nhập</Text></Pressable>
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
  return <View style={styles.centered}><ActivityIndicator color={luxyColors.ink} size="large" /><Text style={styles.muted}>Đang tải hồ sơ thành viên…</Text></View>;
}

function membershipLabel(value: string): string {
  if (value === 'diamond') return 'Kim cương';
  if (value === 'premium') return 'Cao cấp';
  return 'Thành viên';
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#FFF9F8', flex: 1 },
  pageContent: { alignItems: 'center', minHeight: '100%', paddingBottom: 64 },
  topbar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', maxWidth: 1180, paddingHorizontal: 20, paddingVertical: 18, width: '100%' },
  brand: { color: luxyColors.actionRed, fontFamily: luxyTypography.families.display, fontSize: 28, fontWeight: '700' },
  topActions: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  linkButton: { justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  linkButtonText: { color: luxyColors.text, fontSize: 13, fontWeight: '600' },
  primarySmall: { alignItems: 'center', backgroundColor: luxyColors.actionRed, borderRadius: luxyRadii.pill, justifyContent: 'center', minHeight: 44, paddingHorizontal: 18 },
  primarySmallText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  profileCard: { alignItems: 'flex-start', backgroundColor: '#FFFFFF', borderColor: '#F2DEDA', borderRadius: 22, borderWidth: 1, flexDirection: 'row', gap: 30, maxWidth: 1040, padding: 24, width: '94%' },
  photoColumn: { maxWidth: 340, width: '38%' },
  photoFrame: { aspectRatio: 0.8, backgroundColor: '#F4E8E5', borderRadius: 18, overflow: 'hidden', width: '100%' },
  photo: { height: '100%', width: '100%' },
  photoFallback: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  photoFallbackText: { color: luxyColors.muted, fontFamily: luxyTypography.families.display, fontSize: 72 },
  membershipBadge: { alignSelf: 'flex-start', backgroundColor: '#FFF4D6', borderColor: '#F2B51D', borderRadius: luxyRadii.pill, borderWidth: 1, marginTop: 12, paddingHorizontal: 13, paddingVertical: 7 },
  membershipBadgeText: { color: '#8A5A00', fontSize: 12, fontWeight: '700' },
  profileCopy: { flex: 1, minWidth: 0, paddingVertical: 6 },
  name: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 34, lineHeight: 41 },
  location: { color: luxyColors.text, fontSize: 16, marginTop: 3 },
  headline: { color: luxyColors.muted, fontSize: 14, lineHeight: 21, marginTop: 7 },
  section: { borderTopColor: '#F1E8E6', borderTopWidth: 1, gap: 9, marginTop: 22, paddingTop: 18 },
  sectionTitle: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 20, fontWeight: '600' },
  body: { color: luxyColors.text, fontSize: 14, lineHeight: 22 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#FFF1F3', borderRadius: luxyRadii.pill, paddingHorizontal: 12, paddingVertical: 8 },
  tagText: { color: '#9F1239', fontSize: 12, fontWeight: '600' },
  joinCard: { backgroundColor: '#FFF6F5', borderColor: '#F5D4CF', borderRadius: 16, borderWidth: 1, gap: 9, marginTop: 26, padding: 18 },
  joinTitle: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 19, fontWeight: '700' },
  joinCopy: { color: luxyColors.muted, fontSize: 12, lineHeight: 19 },
  joinActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 3 },
  primaryButton: { alignItems: 'center', backgroundColor: luxyColors.actionRed, borderRadius: luxyRadii.pill, justifyContent: 'center', minHeight: 46, paddingHorizontal: 22 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  outlineButton: { alignItems: 'center', borderColor: luxyColors.ink, borderRadius: luxyRadii.pill, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 22 },
  outlineButtonText: { color: luxyColors.text, fontSize: 12, fontWeight: '700' },
  centered: { alignItems: 'center', backgroundColor: '#FFF9F8', flex: 1, gap: 12, justifyContent: 'center', padding: 24 },
  muted: { color: luxyColors.muted, fontSize: 13 },
});