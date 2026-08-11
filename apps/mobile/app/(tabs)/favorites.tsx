import {
  createPrivateMediaUrl,
  getNextLuxyInterestsOffset,
  listLuxyInterests,
  LUXY_INTERESTS_DEFAULT_PAGE_SIZE,
  LUXY_INTERESTS_MAX_RESULTS,
  type LuxyInterestMember,
  type LuxyInterestScope,
} from '@myfan/supabase';
import { luxyColors, luxyLayout, luxyRadii, luxySpacing, luxyTypography } from '@myfan/ui';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LuxyFavoriteButton } from '@/components/luxy-favorite-button';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const TABS: Array<{ key: LuxyInterestScope; label: string; empty: string }> = [
  { key: 'favorites', label: 'Yêu thích', empty: 'Bạn chưa thêm ai vào danh sách Yêu thích.' },
  { key: 'viewed_me', label: 'Đã xem tôi', empty: 'Chưa có lượt xem hồ sơ nào để hiển thị.' },
  { key: 'favorited_me', label: 'Yêu thích tôi', empty: 'Chưa có thành viên nào yêu thích hồ sơ của bạn.' },
];

export default function FavoritesPage() {
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const { width } = useWindowDimensions();
  const [scope, setScope] = useState<LuxyInterestScope>('favorites');

  const query = useInfiniteQuery({
    queryKey: ['luxy-interests', auth.userId, scope],
    enabled: Boolean(client && auth.userId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!client) throw new Error('supabase_not_configured');
      return listLuxyInterests(client, scope, {
        limit: LUXY_INTERESTS_DEFAULT_PAGE_SIZE,
        offset: pageParam,
      });
    },
    getNextPageParam: (_lastPage, pages) => getNextLuxyInterestsOffset(
      pages.map((page) => page.length),
      LUXY_INTERESTS_DEFAULT_PAGE_SIZE,
      LUXY_INTERESTS_MAX_RESULTS,
    ),
  });

  const members = useMemo(() => {
    const seen = new Set<string>();
    return (query.data?.pages.flat() ?? []).filter((member) => {
      if (seen.has(member.id)) return false;
      seen.add(member.id);
      return true;
    });
  }, [query.data?.pages]);

  const activeTab = TABS.find((tab) => tab.key === scope) ?? TABS[0]!;
  const columns = width >= luxyLayout.contentMaxWidth ? 5 : width >= 1024 ? 4 : width >= 768 ? 3 : 2;

  return (
    <ScrollView contentContainerStyle={styles.page} testID="luxy-interests-page">
      <View style={styles.frame}>
        <View style={styles.headingRow}>
          <View>
            <Text accessibilityRole="header" style={styles.title}>Yêu thích</Text>
            <Text style={styles.subtitle}>Những tín hiệu quan tâm giữa bạn và các thành viên Luxy.</Text>
          </View>
          <Text style={styles.count}>{members.length ? `${members.length} thành viên` : ''}</Text>
        </View>

        <View accessibilityRole="tablist" style={styles.tabs} testID="luxy-interests-tabs">
          {TABS.map((tab) => {
            const active = tab.key === scope;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                key={tab.key}
                onPress={() => setScope(tab.key)}
                style={[styles.tab, active && styles.tabActive]}
                testID={`luxy-interests-tab-${tab.key}`}
              >
                <Text numberOfLines={1} style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {query.isLoading && members.length === 0 ? (
          <View style={styles.state}>
            <ActivityIndicator color={luxyColors.ink} size="large" />
            <Text style={styles.stateText}>Đang tải danh sách…</Text>
          </View>
        ) : query.error ? (
          <View style={styles.state}>
            <Text accessibilityRole="alert" style={styles.errorText}>Không thể tải danh sách quan tâm.</Text>
            <Pressable accessibilityRole="button" onPress={() => void query.refetch()} style={styles.retryButton}>
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : members.length === 0 ? (
          <View style={styles.state}>
            <Text style={styles.emptyTitle}>{activeTab.empty}</Text>
            <Text style={styles.stateText}>Tín hiệu Yêu thích không liên quan đến quà tặng, Fan hay quyền truy cập riêng tư.</Text>
          </View>
        ) : (
          <View style={styles.grid} testID="luxy-interests-grid">
            {members.map((member) => (
              <InterestMemberCard columns={columns} key={member.id} member={member} />
            ))}
          </View>
        )}

        {query.isFetchingNextPage ? (
          <View style={styles.loadMoreState}>
            <ActivityIndicator color={luxyColors.ink} />
            <Text style={styles.stateText}>Đang tải thêm…</Text>
          </View>
        ) : query.hasNextPage ? (
          <Pressable accessibilityRole="button" onPress={() => void query.fetchNextPage()} style={styles.loadMoreButton}>
            <Text style={styles.loadMoreText}>Xem thêm thành viên</Text>
          </Pressable>
        ) : members.length > 0 ? (
          <Text style={styles.endText}>Bạn đã xem hết danh sách hiện có.</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

function InterestMemberCard({ member, columns }: { member: LuxyInterestMember; columns: number }) {
  const router = useRouter();
  const client = getMobileSupabaseClient();
  const name = member.display_name || member.username || 'Thành viên Luxy';
  const imageQuery = useQuery({
    queryKey: ['luxy-interests', 'member-photo', member.avatar_media_id],
    enabled: Boolean(client && member.avatar_media_id && member.avatar_storage_bucket && member.avatar_storage_path),
    staleTime: 45_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      if (!client || !member.avatar_storage_bucket || !member.avatar_storage_path) return null;
      return createPrivateMediaUrl(client, {
        storage_bucket: member.avatar_storage_bucket,
        storage_path: member.avatar_storage_path,
      });
    },
  });

  const basis = columns === 5 ? '19%' : columns === 4 ? '24%' : columns === 3 ? '32%' : '49%';

  return (
    <View style={[styles.card, { flexBasis: basis, maxWidth: basis }]} testID="luxy-interests-card">
      <Pressable
        accessibilityLabel={`Xem hồ sơ ${name}, ${member.age} tuổi`}
        accessibilityRole="button"
        disabled={!member.username}
        onPress={() => member.username && router.push({ pathname: '/profile/[username]', params: { username: member.username } })}
        style={({ pressed }) => [styles.cardPressable, pressed && styles.cardPressed]}
      >
        {imageQuery.data ? (
          <Image accessibilityLabel={`Ảnh hồ sơ của ${name}`} resizeMode="cover" source={{ uri: imageQuery.data }} style={styles.photo} />
        ) : (
          <View style={styles.photoFallback}><Text style={styles.initial}>{name.slice(0, 1).toUpperCase()}</Text></View>
        )}
        <View style={styles.photoCount}><Text style={styles.photoCountText}>▣ {member.photo_count}</Text></View>
        <View style={styles.overlay}>
          <View style={styles.nameRow}>
            {member.is_online ? <View accessibilityLabel="Đang online" style={styles.onlineDot} /> : null}
            <Text numberOfLines={1} style={styles.name}>{name}</Text>
            <Text style={styles.age}>{member.age}</Text>
          </View>
          <Text numberOfLines={1} style={styles.location}>{member.province_name || 'Việt Nam'}</Text>
          {member.is_match ? <Text style={styles.matchText}>Tương hợp</Text> : null}
        </View>
      </Pressable>
      <View style={styles.favoriteOverlay}>
        <LuxyFavoriteButton
          initialFavorited={member.is_favorited}
          initialFavoritedBy={member.is_favorited_by}
          name={name}
          profileId={member.id}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: luxyColors.background, minHeight: '100%', paddingBottom: luxySpacing.huge },
  frame: { alignSelf: 'center', maxWidth: luxyLayout.contentMaxWidth, paddingHorizontal: 12, paddingTop: 20, width: '100%' },
  headingRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  title: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 28, fontWeight: '400', lineHeight: 34 },
  subtitle: { color: luxyColors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  count: { color: luxyColors.softMuted, fontSize: 11, paddingBottom: 3 },
  tabs: { borderBottomColor: luxyColors.border, borderBottomWidth: 1, flexDirection: 'row', marginBottom: 14 },
  tab: { alignItems: 'center', borderBottomColor: 'transparent', borderBottomWidth: 3, flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 6 },
  tabActive: { borderBottomColor: luxyColors.ink },
  tabText: { color: luxyColors.muted, fontSize: 12 },
  tabTextActive: { color: luxyColors.text, fontWeight: '700' },
  grid: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { flexGrow: 1, minWidth: 0, position: 'relative' },
  cardPressable: { aspectRatio: luxyLayout.memberCardAspectRatio, backgroundColor: luxyColors.elevatedSubtle, borderRadius: luxyRadii.sm, overflow: 'hidden', position: 'relative', width: '100%' },
  cardPressed: { opacity: 0.84 },
  photo: { height: '100%', width: '100%' },
  photoFallback: { alignItems: 'center', backgroundColor: '#E7E5E4', height: '100%', justifyContent: 'center', width: '100%' },
  initial: { color: luxyColors.muted, fontFamily: luxyTypography.families.display, fontSize: 44 },
  photoCount: { backgroundColor: 'rgba(8,23,38,0.76)', borderRadius: 4, left: 7, minHeight: 22, paddingHorizontal: 6, position: 'absolute', top: 7, justifyContent: 'center' },
  photoCountText: { color: luxyColors.surface, fontSize: 9, fontWeight: '600' },
  overlay: { backgroundColor: 'rgba(8,23,38,0.62)', bottom: 0, left: 0, minHeight: 82, paddingBottom: 8, paddingHorizontal: 8, paddingTop: 24, position: 'absolute', right: 0 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 4, paddingRight: 44 },
  onlineDot: { backgroundColor: luxyColors.online, borderRadius: 4, height: 7, width: 7 },
  name: { color: luxyColors.surface, flexShrink: 1, fontSize: 12, fontWeight: '600' },
  age: { color: luxyColors.surface, fontSize: 11 },
  location: { color: '#F1F1F1', fontSize: 9, marginTop: 3, paddingRight: 44 },
  matchText: { color: luxyColors.surface, fontSize: 9, fontWeight: '700', marginTop: 3 },
  favoriteOverlay: { bottom: 7, position: 'absolute', right: 7, zIndex: 4 },
  state: { alignItems: 'center', gap: 12, justifyContent: 'center', minHeight: 360, paddingHorizontal: 24 },
  stateText: { color: luxyColors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  emptyTitle: { color: luxyColors.text, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  errorText: { color: luxyColors.danger, fontSize: 12, lineHeight: 18 },
  retryButton: { backgroundColor: luxyColors.ink, borderRadius: luxyRadii.pill, justifyContent: 'center', minHeight: 44, paddingHorizontal: 24 },
  retryText: { color: luxyColors.surface, fontSize: 12, fontWeight: '600' },
  loadMoreButton: { alignSelf: 'center', borderColor: luxyColors.ink, borderRadius: luxyRadii.pill, borderWidth: 1, justifyContent: 'center', marginTop: 24, minHeight: 44, paddingHorizontal: 24 },
  loadMoreText: { color: luxyColors.text, fontSize: 12, fontWeight: '600' },
  loadMoreState: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  endText: { color: luxyColors.softMuted, fontSize: 11, paddingVertical: 24, textAlign: 'center' },
});
