import {
  deduplicateDiscoveryProfiles,
  disableMyDiscoveryLocation,
  DISCOVERY_CACHE_MS,
  DISCOVERY_DEFAULT_PAGE_SIZE,
  DISCOVERY_MAX_RESULTS,
  formatApproximateDistance,
  getMyDiscoveryContext,
  getNextDiscoveryOffset,
  listActiveProvinces,
  listDiscoveryProfiles,
  setMyDiscoveryLocation,
  type DiscoveryMode,
  type DiscoveryProfile,
} from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SocialAvatar } from '@/components/social-avatar';
import { requestDiscoveryLocation } from '@/lib/location';
import { getReadableLocationError } from '@/lib/location-errors';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const contextQueryKey = (userId: string | null) => ['discovery', 'context', userId] as const;
const provincesQueryKey = ['discovery', 'provinces', 'VN'] as const;

export default function Page() {
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<DiscoveryMode>('nearby');
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const contextQuery = useQuery({
    queryKey: contextQueryKey(auth.userId),
    enabled: Boolean(client && auth.userId),
    staleTime: DISCOVERY_CACHE_MS,
    gcTime: DISCOVERY_CACHE_MS * 2,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getMyDiscoveryContext(client);
    },
  });

  const provincesQuery = useQuery({
    queryKey: provincesQueryKey,
    enabled: Boolean(client),
    staleTime: 24 * 60 * 60 * 1_000,
    gcTime: 24 * 60 * 60 * 1_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return listActiveProvinces(client);
    },
  });

  useEffect(() => {
    if (selectedProvinceId !== null) return;
    const initialProvinceId = contextQuery.data?.province_id ?? provincesQuery.data?.[0]?.id ?? null;
    if (initialProvinceId !== null) setSelectedProvinceId(initialProvinceId);
  }, [contextQuery.data?.province_id, provincesQuery.data, selectedProvinceId]);

  const pageSize = contextQuery.data?.page_size ?? DISCOVERY_DEFAULT_PAGE_SIZE;
  const maxResults = contextQuery.data?.max_results ?? DISCOVERY_MAX_RESULTS;
  const activeProvinceId = mode === 'province' ? selectedProvinceId : null;

  const profilesQuery = useInfiniteQuery({
    queryKey: ['discovery', 'profiles', auth.userId, mode, activeProvinceId, pageSize, maxResults],
    enabled: Boolean(client && auth.userId && contextQuery.data && (mode === 'nearby' || activeProvinceId !== null)),
    staleTime: DISCOVERY_CACHE_MS,
    gcTime: DISCOVERY_CACHE_MS * 2,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!client) throw new Error('supabase_not_configured');
      return listDiscoveryProfiles(client, {
        mode,
        provinceId: activeProvinceId,
        limit: pageSize,
        offset: pageParam,
      });
    },
    getNextPageParam: (_lastPage, pages) => getNextDiscoveryOffset(
      pages.map((page) => page.length),
      pageSize,
      maxResults,
    ),
  });

  const profiles = useMemo(
    () => deduplicateDiscoveryProfiles(profilesQuery.data?.pages.flat() ?? []),
    [profilesQuery.data?.pages],
  );

  async function clearNearbyCache() {
    await queryClient.cancelQueries({ queryKey: ['discovery', 'profiles', auth.userId, 'nearby'] });
    queryClient.removeQueries({ queryKey: ['discovery', 'profiles', auth.userId, 'nearby'] });
    await queryClient.invalidateQueries({ queryKey: contextQueryKey(auth.userId), refetchType: 'none' });
  }

  async function handleUpdateLocation() {
    if (!client) return;
    setLocationBusy(true);
    setLocationError(null);
    setLocationMessage(null);
    try {
      const location = await requestDiscoveryLocation();
      await setMyDiscoveryLocation(client, location);
      await clearNearbyCache();
      await contextQuery.refetch();
      setMode('nearby');
      setLocationMessage('Vị trí đã được cập nhật. Khoảng cách sẽ hiển thị trong 30 phút.');
    } catch (error) {
      setLocationError(getReadableLocationError(error));
    } finally {
      setLocationBusy(false);
    }
  }

  async function handleDisableLocation() {
    if (!client) return;
    setLocationBusy(true);
    setLocationError(null);
    setLocationMessage(null);
    try {
      await disableMyDiscoveryLocation(client);
      await clearNearbyCache();
      await contextQuery.refetch();
      setLocationMessage('Đã tắt định vị. Bạn vẫn có thể xem danh sách Gần đây.');
    } catch (error) {
      setLocationError(getReadableLocationError(error));
    } finally {
      setLocationBusy(false);
    }
  }

  function handleEndReached() {
    if (profilesQuery.hasNextPage && !profilesQuery.isFetchingNextPage && profiles.length < maxResults) {
      void profilesQuery.fetchNextPage();
    }
  }

  const loadingInitial = contextQuery.isLoading || provincesQuery.isLoading || (profilesQuery.isLoading && profiles.length === 0);
  const error = contextQuery.error || provincesQuery.error || profilesQuery.error;

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={profiles}
        initialNumToRender={8}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={loadingInitial ? (
          <LoadingState />
        ) : error ? (
          <Text accessibilityRole="alert" style={styles.error}>Không thể tải danh sách Khám phá. Hãy thử lại.</Text>
        ) : (
          <Text style={styles.empty}>Chưa có hồ sơ phù hợp. Hãy chọn tỉnh khác hoặc quay lại sau.</Text>
        )}
        ListFooterComponent={profilesQuery.isFetchingNextPage ? (
          <View style={styles.footerLoading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Đang tải…</Text>
          </View>
        ) : profiles.length >= maxResults ? (
          <Text style={styles.limitText}>Đã hiển thị tối đa {maxResults} người.</Text>
        ) : null}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>Khám phá</Text>
            <Text style={styles.description}>
              Người gần nhất được xếp trước. Chạm vào hồ sơ để xem ảnh, Album Fan và gửi lời mời kết bạn.
            </Text>

            <View accessibilityRole="tablist" style={styles.tabRow}>
              <ModeButton active={mode === 'nearby'} label="Gần đây" onPress={() => setMode('nearby')} />
              <ModeButton active={mode === 'province'} label="Theo tỉnh" onPress={() => setMode('province')} />
            </View>

            {mode === 'nearby' ? (
              <View style={styles.locationCard}>
                <Text style={styles.locationTitle}>
                  {contextQuery.data?.has_fresh_location ? 'Khoảng cách đang được hiển thị' : 'Khoảng cách đang được ẩn'}
                </Text>
                <Text style={styles.locationBody}>
                  {contextQuery.data?.has_fresh_location
                    ? 'Cùng tỉnh và có vị trí mới sẽ hiển thị < 1 km hoặc x,y km. Dữ liệu danh sách được cache 30 phút.'
                    : 'Bạn vẫn xem được Gần đây. Người không bật vị trí hoặc ở ngoài tỉnh được xếp cuối và không hiện khoảng cách.'}
                </Text>
                <View style={styles.locationActions}>
                  <Pressable accessibilityRole="button" disabled={locationBusy} onPress={handleUpdateLocation} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>{locationBusy ? 'Đang tải…' : 'Cập nhật vị trí'}</Text>
                  </Pressable>
                  {contextQuery.data?.nearby_enabled ? (
                    <Pressable accessibilityRole="button" disabled={locationBusy} onPress={handleDisableLocation} style={styles.secondaryButton}>
                      <Text style={styles.secondaryButtonText}>Tắt định vị</Text>
                    </Pressable>
                  ) : null}
                </View>
                {locationMessage ? <Text accessibilityRole="alert" style={styles.success}>{locationMessage}</Text> : null}
                {locationError ? <Text accessibilityRole="alert" style={styles.error}>{locationError}</Text> : null}
              </View>
            ) : (
              <View style={styles.provinceSection}>
                <Text style={styles.sectionLabel}>Chọn tỉnh/thành</Text>
                <ScrollView horizontal contentContainerStyle={styles.provinceRow} showsHorizontalScrollIndicator={false}>
                  {(provincesQuery.data ?? []).map((province) => (
                    <Pressable
                      accessibilityRole="button"
                      key={province.id}
                      onPress={() => setSelectedProvinceId(province.id)}
                      style={[styles.provinceChip, selectedProvinceId === province.id && styles.provinceChipActive]}
                    >
                      <Text style={[styles.provinceChipText, selectedProvinceId === province.id && styles.provinceChipTextActive]}>
                        {province.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.resultHeading}>
              <Text style={styles.resultTitle}>{mode === 'nearby' ? 'Gần đây' : 'Trong tỉnh/thành'}</Text>
              <Text style={styles.resultCount}>{profiles.length}/{maxResults}</Text>
            </View>
          </View>
        }
        maxToRenderPerBatch={8}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        onRefresh={() => void profilesQuery.refetch()}
        refreshing={profilesQuery.isRefetching && !profilesQuery.isFetchingNextPage}
        removeClippedSubviews={Platform.OS === 'android'}
        renderItem={({ item }) => <DiscoveryCard profile={item} />}
        windowSize={7}
      />
    </SafeAreaView>
  );
}

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}>
      <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function LoadingState() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.loadingText}>Đang tải…</Text>
    </View>
  );
}

function DiscoveryCard({ profile }: { profile: DiscoveryProfile }) {
  const router = useRouter();
  const distanceLabel = formatApproximateDistance(profile.distance_km);
  const name = profile.display_name || profile.username || 'Thành viên MyFan';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!profile.username}
      onPress={() => profile.username && router.push({ pathname: '/profile/[username]', params: { username: profile.username } })}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <SocialAvatar
        mediaId={profile.avatar_media_id}
        name={name}
        size={72}
        storageBucket={profile.avatar_storage_bucket}
        storagePath={profile.avatar_storage_path}
      />
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text numberOfLines={1} style={styles.displayName}>{name}</Text>
          {profile.is_creator ? <Text style={styles.creatorBadge}>Creator</Text> : null}
        </View>
        {profile.username ? <Text style={styles.username}>@{profile.username}</Text> : null}
        <View style={styles.metaRow}>
          {profile.province_name ? <Text style={styles.metaText}>{profile.province_name}</Text> : null}
          {distanceLabel ? <Text style={styles.distance}>{distanceLabel}</Text> : null}
        </View>
        {profile.bio ? <Text numberOfLines={2} style={styles.bio}>{profile.bio}</Text> : null}
        {profile.interests.length ? (
          <View style={styles.interestRow}>
            {profile.interests.slice(0, 3).map((interest) => (
              <View key={interest} style={styles.interestChip}><Text style={styles.interestText}>{interest}</Text></View>
            ))}
          </View>
        ) : null}
      </View>
      <Text accessibilityElementsHidden style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  description: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  tabRow: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 4, backgroundColor: colors.surface },
  modeButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  modeButtonActive: { backgroundColor: colors.primary },
  modeButtonText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  modeButtonTextActive: { color: '#FFFFFF' },
  locationCard: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
  locationTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  locationBody: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  locationActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  primaryButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: colors.primary, paddingHorizontal: spacing.md },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondaryButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  provinceSection: { gap: spacing.sm },
  sectionLabel: { color: colors.text, fontSize: 15, fontWeight: '800' },
  provinceRow: { gap: spacing.sm, paddingRight: spacing.lg },
  provinceChip: { minHeight: 40, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14 },
  provinceChipActive: { backgroundColor: '#FCE7F3', borderColor: colors.primary },
  provinceChipText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  provinceChipTextActive: { color: colors.primary },
  resultHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  resultTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  resultCount: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, marginBottom: spacing.md },
  cardPressed: { opacity: 0.75 },
  cardBody: { flex: 1, gap: 5 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  displayName: { flexShrink: 1, color: colors.text, fontSize: 17, fontWeight: '800' },
  username: { color: colors.muted, fontSize: 13 },
  creatorBadge: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  metaText: { color: colors.muted, fontSize: 13 },
  distance: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  bio: { color: colors.text, fontSize: 14, lineHeight: 20 },
  interestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  interestChip: { borderRadius: 999, backgroundColor: '#F3F4F6', paddingHorizontal: 9, paddingVertical: 4 },
  interestText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  chevron: { color: colors.muted, fontSize: 28, fontWeight: '400' },
  loading: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { color: colors.muted, fontSize: 14 },
  footerLoading: { paddingVertical: spacing.lg, alignItems: 'center', gap: spacing.sm },
  empty: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', paddingVertical: spacing.xl },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21 },
  success: { color: '#166534', fontSize: 13, lineHeight: 20 },
  limitText: { color: colors.muted, textAlign: 'center', fontSize: 13, paddingVertical: spacing.lg },
});
