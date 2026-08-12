import {
  getNextLuxyInterestsOffset,
  listLuxyInterests,
  LUXY_INTERESTS_DEFAULT_PAGE_SIZE,
  LUXY_INTERESTS_MAX_RESULTS,
  type LuxyInterestMember,
  type LuxyInterestScope,
} from '@myfan/supabase';
import { luxyColors, luxyRadii, luxySpacing, luxyTypography } from '@myfan/ui';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LuxySeekingFavoriteButton } from '@/components/luxy-seeking-favorite-button';
import { LuxySeekingMemberPhoto } from '@/components/luxy-seeking-member-photo';
import { LuxySeekingMessageButton } from '@/components/luxy-seeking-message-button';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const TABS: Array<{ key: LuxyInterestScope; label: string; empty: string }> = [
  { key: 'viewed_me', label: 'Đã xem tôi', empty: 'Chưa có lượt xem hồ sơ nào trong 180 ngày gần đây.' },
  { key: 'favorites', label: 'Yêu thích', empty: 'Bạn chưa thêm ai vào danh sách Yêu thích.' },
  { key: 'favorited_me', label: 'Yêu thích tôi', empty: 'Chưa có thành viên nào yêu thích hồ sơ của bạn.' },
];

type InterestSort = 'newest' | 'oldest';

function relativeInteraction(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return '';
  const delta = Math.max(0, Date.now() - time);
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  const months = Math.floor(days / 30);
  return `${months} tháng trước`;
}

export default function FavoritesPage() {
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const { width } = useWindowDimensions();
  const desktop = width >= 860;
  const [scope, setScope] = useState<LuxyInterestScope>('viewed_me');
  const [sort, setSort] = useState<InterestSort>('newest');

  const query = useInfiniteQuery({
    queryKey: ['luxy-interests', auth.userId, scope],
    enabled: Boolean(client && auth.userId),
    staleTime: 0,
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

  const favoritedMeBadgeQuery = useQuery({
    queryKey: ['luxy-nav-interests', auth.userId, 'favorited_me'],
    enabled: Boolean(client && auth.userId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!client) return 0;
      const rows = await listLuxyInterests(client, 'favorited_me', { limit: 40, offset: 0 });
      return rows.length;
    },
  });

  const members = useMemo(() => {
    const seen = new Set<string>();
    const rows = (query.data?.pages.flat() ?? []).filter((member) => {
      if (seen.has(member.id)) return false;
      seen.add(member.id);
      return true;
    });
    return rows.sort((a, b) => sort === 'newest'
      ? b.interaction_at.localeCompare(a.interaction_at)
      : a.interaction_at.localeCompare(b.interaction_at));
  }, [query.data?.pages, sort]);

  const activeTab = TABS.find((tab) => tab.key === scope) ?? TABS[0]!;

  return (
    <ScrollView contentContainerStyle={styles.page} testID="luxy-interests-page">
      <View style={styles.frame}>
        <View style={[styles.toolbar, !desktop && styles.toolbarMobile]}>
          <View accessibilityRole="tablist" style={styles.tabs} testID="luxy-interests-tabs">
            {TABS.map((tab) => {
              const active = tab.key === scope;
              const badge = tab.key === 'favorited_me' ? (favoritedMeBadgeQuery.data ?? 0) : 0;
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
                  {badge > 0 ? (
                    <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{badge > 99 ? '99+' : badge}</Text></View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <Pressable
            accessibilityLabel="Đổi thứ tự danh sách quan tâm"
            accessibilityRole="button"
            onPress={() => setSort((value) => value === 'newest' ? 'oldest' : 'newest')}
            style={({ pressed }) => [styles.sortButton, pressed && styles.pressed]}
            testID="luxy-interests-sort"
          >
            <Text style={styles.sortText}>{sort === 'newest' ? 'Sắp xếp: mới nhất' : 'Sắp xếp: cũ nhất'}</Text>
            <Text style={styles.chevron}>⌄</Text>
          </Pressable>
        </View>

        {query.isLoading && members.length === 0 ? (
          <StatePanel><ActivityIndicator color={luxyColors.ink} size="large" /><Text style={styles.stateText}>Đang tải danh sách…</Text></StatePanel>
        ) : query.error ? (
          <StatePanel>
            <Text accessibilityRole="alert" style={styles.errorText}>Không thể tải danh sách quan tâm.</Text>
            <Pressable accessibilityRole="button" onPress={() => void query.refetch()} style={styles.retryButton}>
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </StatePanel>
        ) : members.length === 0 ? (
          <StatePanel>
            <Text style={styles.emptyTitle}>{activeTab.empty}</Text>
            <Text style={styles.stateText}>Yêu thích là tín hiệu miễn phí và không mở khóa Tin nhắn hoặc Ảnh riêng tư.</Text>
          </StatePanel>
        ) : (
          <View testID="luxy-interests-list">
            {members.map((member) => (
              <InterestRow desktop={desktop} key={member.id} member={member} scope={scope} />
            ))}
          </View>
        )}

        {query.isFetchingNextPage ? (
          <View style={styles.loadMoreState}><ActivityIndicator color={luxyColors.ink} /><Text style={styles.stateText}>Đang tải thêm…</Text></View>
        ) : query.hasNextPage ? (
          <Pressable accessibilityRole="button" onPress={() => void query.fetchNextPage()} style={styles.loadMoreButton}>
            <Text style={styles.loadMoreText}>Xem thêm</Text>
          </Pressable>
        ) : null}

        {scope === 'viewed_me' ? (
          <View style={styles.noteBar}><Text style={styles.noteText}><Text style={styles.noteStrong}>Lưu ý:</Text> Lượt xem hồ sơ chỉ hiển thị trong 180 ngày gần nhất.</Text></View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function StatePanel({ children }: { children: React.ReactNode }) {
  return <View style={styles.state}>{children}</View>;
}

function InterestRow({ member, scope, desktop }: { member: LuxyInterestMember; scope: LuxyInterestScope; desktop: boolean }) {
  const router = useRouter();
  const name = member.display_name || member.username || 'Thành viên Luxy';
  const interactionLabel = scope === 'viewed_me'
    ? `Đã xem bạn ${relativeInteraction(member.interaction_at)}`
    : scope === 'favorited_me'
      ? `Đã yêu thích bạn ${relativeInteraction(member.interaction_at)}`
      : `Đã lưu ${relativeInteraction(member.interaction_at)}`;

  return (
    <View style={[styles.memberRow, !desktop && styles.memberRowMobile]} testID="luxy-interests-row">
      <Pressable
        accessibilityLabel={`Xem hồ sơ ${name}, ${member.age} tuổi`}
        accessibilityRole="button"
        disabled={!member.username}
        onPress={() => member.username && router.push({ pathname: '/profile/[username]', params: { username: member.username } })}
        style={({ pressed }) => [styles.identityArea, !desktop && styles.identityAreaMobile, pressed && styles.pressed]}
      >
        <LuxySeekingMemberPhoto
          height={desktop ? 112 : 106}
          mediaId={member.avatar_media_id}
          name={name}
          photoCount={member.photo_count}
          storageBucket={member.avatar_storage_bucket}
          storagePath={member.avatar_storage_path}
          width={desktop ? 84 : 80}
        />
        <View style={styles.primaryFacts}>
          <View style={styles.nameRow}>
            {member.is_online ? <View accessibilityLabel="Đang online" style={styles.onlineDot} /> : null}
            <Text numberOfLines={1} style={styles.name}>{name}</Text>
            {member.is_match ? <Text style={styles.matchBadge}>♥</Text> : null}
          </View>
          {member.headline ? <Text numberOfLines={1} style={styles.headline}>{member.headline}</Text> : null}
          <Text style={styles.location}>{member.age}, {member.province_name || 'Việt Nam'}</Text>
          <View style={styles.signalRow}>
            {member.is_favorited_by ? <Text style={styles.signal}>♥ Đã thích bạn</Text> : null}
            {member.is_match ? <Text style={styles.signal}>Tương hợp</Text> : null}
          </View>
        </View>
      </Pressable>

      {desktop ? (
        <View style={styles.detailFacts}>
          {member.height_cm ? <Fact label="Chiều cao" value={`${member.height_cm} cm`} /> : null}
          {member.weight_kg ? <Fact label="Cân nặng" value={`${member.weight_kg} kg`} /> : null}
        </View>
      ) : null}

      <View style={[styles.rowActions, !desktop && styles.rowActionsMobile]}>
        <Text style={styles.interactionTime}>{interactionLabel}</Text>
        <View style={styles.actionButtons}>
          <LuxySeekingMessageButton name={name} profileId={member.id} />
          <LuxySeekingFavoriteButton initialFavorited={member.is_favorited} name={name} profileId={member.id} />
        </View>
      </View>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#FBFAF9', minHeight: '100%', paddingBottom: 92, paddingHorizontal: 12, paddingTop: 20 },
  frame: { alignSelf: 'center', backgroundColor: '#FFFFFF', borderColor: '#E5E2DF', borderRadius: 3, borderWidth: 1, maxWidth: 1168, overflow: 'hidden', width: '100%' },
  toolbar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 64, paddingHorizontal: 16 },
  toolbarMobile: { alignItems: 'stretch', flexDirection: 'column', gap: 10, paddingBottom: 12, paddingHorizontal: 10, paddingTop: 4 },
  tabs: { alignItems: 'stretch', flexDirection: 'row', minHeight: 64 },
  tab: { alignItems: 'center', borderBottomColor: 'transparent', borderBottomWidth: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', minWidth: 130, paddingHorizontal: 14 },
  tabActive: { borderBottomColor: luxyColors.brandCoral },
  tabText: { color: '#979CA4', fontSize: 15 },
  tabTextActive: { color: luxyColors.brandCoral, fontWeight: '500' },
  tabBadge: { alignItems: 'center', backgroundColor: luxyColors.brandCoral, borderRadius: 4, justifyContent: 'center', minHeight: 17, minWidth: 17, paddingHorizontal: 3 },
  tabBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  sortButton: { alignItems: 'center', borderColor: luxyColors.ink, borderRadius: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 34, minWidth: 240, paddingHorizontal: 14 },
  sortText: { color: luxyColors.ink, fontSize: 14 },
  chevron: { color: luxyColors.ink, fontSize: 15 },
  memberRow: { alignItems: 'center', borderTopColor: '#E1DFDD', borderTopWidth: 1, flexDirection: 'row', minHeight: 172, paddingHorizontal: 16, paddingVertical: 16 },
  memberRowMobile: { alignItems: 'stretch', flexDirection: 'column', gap: 13, minHeight: 0, paddingHorizontal: 12 },
  identityArea: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, minWidth: 400, width: '38%' },
  identityAreaMobile: { minWidth: 0, width: '100%' },
  primaryFacts: { flex: 1, minWidth: 0, paddingTop: 3 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  onlineDot: { backgroundColor: '#65C778', borderRadius: 6, height: 11, width: 11 },
  name: { color: luxyColors.ink, flexShrink: 1, fontSize: 15, fontWeight: '700' },
  matchBadge: { color: luxyColors.brandCoral, fontSize: 15 },
  headline: { color: '#2E3742', fontSize: 13, marginTop: 5 },
  location: { color: '#65707D', fontSize: 12, marginTop: 5 },
  signalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 },
  signal: { color: luxyColors.brandCoral, fontSize: 11, fontWeight: '600' },
  detailFacts: { minWidth: 240, width: '24%' },
  factRow: { flexDirection: 'row', gap: 10, minHeight: 21 },
  factLabel: { color: luxyColors.ink, fontSize: 12, fontWeight: '700', width: 72 },
  factValue: { color: '#34404D', fontSize: 12 },
  rowActions: { alignItems: 'flex-end', flex: 1, gap: 56, justifyContent: 'space-between', minHeight: 112 },
  rowActionsMobile: { alignItems: 'stretch', gap: 10, minHeight: 0 },
  interactionTime: { color: '#697480', fontSize: 11, textAlign: 'right' },
  actionButtons: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  state: { alignItems: 'center', gap: 12, justifyContent: 'center', minHeight: 330, paddingHorizontal: 24 },
  stateText: { color: luxyColors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  emptyTitle: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 20, textAlign: 'center' },
  errorText: { color: luxyColors.danger, fontSize: 13 },
  retryButton: { backgroundColor: luxyColors.ink, borderRadius: luxyRadii.pill, justifyContent: 'center', minHeight: 42, paddingHorizontal: 24 },
  retryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  loadMoreButton: { alignSelf: 'center', borderColor: luxyColors.ink, borderRadius: luxyRadii.pill, borderWidth: 1, justifyContent: 'center', marginVertical: luxySpacing.lg, minHeight: 42, paddingHorizontal: 24 },
  loadMoreText: { color: luxyColors.ink, fontSize: 13, fontWeight: '600' },
  loadMoreState: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  noteBar: { alignItems: 'center', borderTopColor: '#D9D7D5', borderTopWidth: 1, justifyContent: 'center', minHeight: 34, paddingHorizontal: 12 },
  noteText: { color: luxyColors.ink, fontSize: 11, textAlign: 'center' },
  noteStrong: { fontWeight: '700' },
  pressed: { opacity: 0.74 },
});
