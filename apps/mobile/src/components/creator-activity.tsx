import { phaseCFeatureFlags } from '@myfan/config';
import {
  activityQueryKeys,
  archiveCreatorActivityPost,
  createActivityStorageUrl,
  deleteCreatorActivityPost,
  getReadableActivityError,
  getYouTubeThumbnail,
  listCreatorActivity,
  reportCreatorActivity,
  sendGiftAndUnlockCreatorPost,
  type CreatorActivityPost,
} from '@myfan/supabase';
import { colors, spacing } from '@myfan/ui';
import { type InfiniteData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const PAGE_SIZE = 20;
type Cursor = { beforeAt: string | null; beforeId: string | null };
type FeedKey = ReturnType<typeof activityQueryKeys.feed>;
type ActivityListProps = { username: string; compact?: boolean };

export function CreatorActivityList({ username, compact = false }: ActivityListProps) {
  const client = getMobileSupabaseClient();
  const query = useInfiniteQuery<CreatorActivityPost[], Error, InfiniteData<CreatorActivityPost[]>, FeedKey, Cursor>({
    queryKey: activityQueryKeys.feed(username),
    enabled: Boolean(client && username),
    initialPageParam: { beforeAt: null, beforeId: null },
    staleTime: 30_000,
    queryFn: async ({ pageParam }) => {
      if (!client) throw new Error('supabase_not_configured');
      return listCreatorActivity(client, username, {
        limit: PAGE_SIZE,
        beforeAt: pageParam.beforeAt,
        beforeId: pageParam.beforeId,
      });
    },
    getNextPageParam: (page): Cursor | undefined => {
      if (page.length < PAGE_SIZE) return undefined;
      const last = page.at(-1);
      return last ? { beforeAt: last.published_at ?? last.created_at, beforeId: last.post_id } : undefined;
    },
  });

  const posts = useMemo<CreatorActivityPost[]>(() => query.data?.pages.flat() ?? [], [query.data]);
  if (query.isLoading) return <ActivitySkeleton />;
  if (query.error) return <ActivityState action="Thử lại" description={getReadableActivityError(query.error)} onAction={() => void query.refetch()} title="Không thể tải Hoạt động" />;
  if (!posts.length) return <ActivityState description="Creator chưa có bài Hoạt động nào được hiển thị." title="Chưa có Hoạt động" />;

  return (
    <View style={styles.list}>
      {posts.map((post) => <CreatorActivityCard compact={compact} key={post.post_id} post={post} />)}
      {query.hasNextPage ? (
        <Pressable accessibilityRole="button" disabled={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()} style={styles.loadMoreButton}>
          <Text style={styles.loadMoreText}>{query.isFetchingNextPage ? 'Đang tải…' : 'Xem hoạt động cũ hơn'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function CreatorActivityCard({ post, compact = false }: { post: CreatorActivityPost; compact?: boolean }) {
  const client = getMobileSupabaseClient();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const mediaSource = post.original_bucket && post.original_path
    ? { bucket: post.original_bucket, path: post.original_path, kind: 'original' as const }
    : post.preview_bucket && post.preview_path
      ? { bucket: post.preview_bucket, path: post.preview_path, kind: 'preview' as const }
      : null;

  const mediaQuery = useQuery({
    queryKey: ['creator-activity', 'media-url', post.post_id, mediaSource?.kind, mediaSource?.path],
    enabled: Boolean(client && mediaSource),
    staleTime: 20_000,
    gcTime: 40_000,
    queryFn: async () => {
      if (!client || !mediaSource) return null;
      return createActivityStorageUrl(client, mediaSource.bucket, mediaSource.path, 30);
    },
  });
  const avatarQuery = useQuery({
    queryKey: ['creator-activity', 'avatar', post.avatar_media_id, post.avatar_path],
    enabled: Boolean(client && post.avatar_bucket && post.avatar_path),
    staleTime: 45_000,
    queryFn: async () => {
      if (!client || !post.avatar_bucket || !post.avatar_path) return null;
      return createActivityStorageUrl(client, post.avatar_bucket, post.avatar_path, 45);
    },
  });
  const isLocked = post.content_type === 'image' && post.image_access_mode === 'gift_locked' && !post.is_unlocked;

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setNotice(null);
    try { await action(); } catch (error) { setNotice(getReadableActivityError(error)); } finally { setBusy(false); }
  }
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: activityQueryKeys.feed(post.username) });
  }
  function confirmUnlock() {
    if (!phaseCFeatureFlags.send_gift) {
      setNotice('Backend mở khóa đã sẵn sàng, nhưng giao dịch thật đang tắt cho tới khi Google Play Billing được bật.');
      return;
    }
    if (!client || !auth.userId) return;
    Alert.alert(`Tặng ${post.required_gift_name_vi ?? 'quà'}?`, `Mở bài bằng ${post.required_gift_hearts ?? 0} ❤️. Quà không mua quyền gặp mặt hay liên hệ riêng.`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xác nhận tặng quà', onPress: () => void runAction(async () => {
        await sendGiftAndUnlockCreatorPost(client, post.post_id, createRequestId());
        await refresh();
        setNotice('Đã mở khóa ảnh của bài Hoạt động này.');
      }) },
    ]);
  }
  function confirmReport(target: 'post' | 'image' | 'external_link') {
    if (!client || !auth.userId) return;
    Alert.alert('Báo cáo nội dung', 'Gửi nội dung này tới đội ngũ an toàn MyFan?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Gửi báo cáo', style: 'destructive', onPress: () => void runAction(async () => {
        await reportCreatorActivity(client, { postId: post.post_id, mediaId: target === 'image' ? post.media_id : null, target, reasonCode: 'other' });
        setNotice('Báo cáo đã được gửi.');
      }) },
    ]);
  }
  function confirmOwnerAction(action: 'archive' | 'delete') {
    if (!client) return;
    Alert.alert(action === 'archive' ? 'Lưu trữ bài?' : 'Xóa bài?', action === 'archive' ? 'Bài sẽ không còn hiển thị công khai.' : 'Bài sẽ bị xóa mềm khỏi MyFan.', [
      { text: 'Hủy', style: 'cancel' },
      { text: action === 'archive' ? 'Lưu trữ' : 'Xóa', style: 'destructive', onPress: () => void runAction(async () => {
        if (action === 'archive') await archiveCreatorActivityPost(client, post.post_id);
        else await deleteCreatorActivityPost(client, post.post_id);
        await refresh();
      }) },
    ]);
  }
  async function openExternalLink() {
    if (!post.external_url) return;
    if (post.external_provider === 'of_tv') {
      Alert.alert('Nội dung bên ngoài MyFan', 'Bạn sắp mở OF.TV. MyFan không gửi email, token, vị trí hoặc dữ liệu cá nhân trong liên kết.', [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Mở liên kết', onPress: () => void Linking.openURL(post.external_url!) },
      ]);
      return;
    }
    await Linking.openURL(post.external_url);
  }

  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <View style={styles.cardHeader}>
        {avatarQuery.data ? <Image accessibilityLabel={`Ảnh đại diện của ${post.display_name}`} source={{ uri: avatarQuery.data }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarFallbackText}>{post.display_name.slice(0, 1).toUpperCase()}</Text></View>}
        <View style={styles.identity}><View style={styles.nameRow}><Text style={styles.creatorName}>{post.display_name}</Text>{post.is_verified ? <Text accessibilityLabel="Creator đã được duyệt" style={styles.verified}>✓</Text> : null}</View><Text style={styles.meta}>@{post.username} · {formatActivityDate(post.published_at ?? post.created_at)}</Text></View>
        <Pressable accessibilityLabel="Báo cáo bài Hoạt động" accessibilityRole="button" onPress={() => confirmReport('post')} style={styles.menuButton}><Text style={styles.menuText}>•••</Text></Pressable>
      </View>
      {post.is_owner ? <ActivityStatus status={post.moderation_status} /> : null}
      <Text selectable style={styles.body}>{post.body}</Text>

      {post.content_type === 'video' ? (
        <Pressable accessibilityRole="link" onPress={() => void openExternalLink()} style={styles.videoCard}>
          {post.external_provider === 'youtube' && post.external_video_id ? <Image source={{ uri: getYouTubeThumbnail(post.external_video_id) }} style={styles.videoThumbnail} /> : <View style={styles.externalFallback}><Text style={styles.externalProvider}>OF.TV</Text></View>}
          <View style={styles.videoCopy}><Text style={styles.videoProvider}>{post.external_provider === 'youtube' ? 'YouTube' : 'OF.TV · Liên kết ngoài'}</Text><Text numberOfLines={2} style={styles.videoUrl}>{post.external_url}</Text><Text style={styles.openLink}>Mở liên kết ›</Text></View>
        </Pressable>
      ) : null}

      {post.content_type === 'image' ? (
        <View style={styles.mediaFrame}>
          {mediaQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
          {mediaQuery.data ? <Image resizeMode="cover" source={{ uri: mediaQuery.data }} style={styles.postImage} /> : null}
          {isLocked ? <View style={styles.lockedOverlay}><Text style={styles.lockIcon}>🔒</Text><Text style={styles.lockTitle}>1 ảnh đang được khóa</Text><Text style={styles.lockGift}>{post.required_gift_icon_emoji} {post.required_gift_name_vi} · {post.required_gift_hearts} ❤️</Text><Pressable accessibilityRole="button" disabled={busy || !post.required_gift_active} onPress={confirmUnlock} style={styles.unlockButton}><Text style={styles.unlockButtonText}>{auth.userId ? `Tặng ${post.required_gift_name_vi ?? 'quà'} để xem ảnh` : `Đăng nhập để tặng ${post.required_gift_name_vi ?? 'quà'}`}</Text></Pressable></View> : null}
        </View>
      ) : null}

      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
      <View style={styles.footerActions}>
        <Pressable accessibilityRole="button" onPress={() => void Share.share({ message: `${post.body}\n${post.external_url ?? ''}`.trim() })}><Text style={styles.actionText}>Chia sẻ</Text></Pressable>
        {post.content_type === 'video' ? <Pressable accessibilityRole="button" onPress={() => confirmReport('external_link')}><Text style={styles.actionText}>Báo cáo link</Text></Pressable> : null}
        {post.content_type === 'image' && post.media_id ? <Pressable accessibilityRole="button" onPress={() => confirmReport('image')}><Text style={styles.actionText}>Báo cáo ảnh</Text></Pressable> : null}
        {post.is_owner ? <><Pressable accessibilityRole="button" onPress={() => confirmOwnerAction('archive')}><Text style={styles.actionText}>Lưu trữ</Text></Pressable><Pressable accessibilityRole="button" onPress={() => confirmOwnerAction('delete')}><Text style={styles.dangerText}>Xóa</Text></Pressable></> : null}
      </View>
      {post.is_owner && post.image_access_mode === 'gift_locked' ? <Text style={styles.ownerStats}>{post.unlock_count} lượt mở khóa đang hoạt động</Text> : null}
    </View>
  );
}

function createRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

function ActivityStatus({ status }: { status: CreatorActivityPost['moderation_status'] }) {
  const labels: Record<CreatorActivityPost['moderation_status'], string> = { draft: 'Bản nháp', pending_review: 'Đang kiểm duyệt', approved: 'Đã đăng', rejected: 'Bị từ chối', archived: 'Đã lưu trữ', deleted: 'Đã xóa' };
  return <Text style={styles.status}>{labels[status]}</Text>;
}
function ActivitySkeleton() { return <View style={styles.skeleton}><ActivityIndicator color={colors.primary} /><Text style={styles.stateDescription}>Đang tải Hoạt động…</Text></View>; }
function ActivityState({ title, description, action, onAction }: { title: string; description: string; action?: string; onAction?: () => void }) {
  return <View style={styles.stateCard}><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateDescription}>{description}</Text>{action && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={styles.loadMoreButton}><Text style={styles.loadMoreText}>{action}</Text></Pressable> : null}</View>;
}
function formatActivityDate(value: string): string {
  const date = new Date(value); if (Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime(); if (diff < 60_000) return 'Vừa xong'; if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))} phút`; if (diff < 86_400_000) return `${Math.max(1, Math.floor(diff / 3_600_000))} giờ`; return date.toLocaleDateString('vi-VN');
}

const styles = StyleSheet.create({
  list: { gap: spacing.md }, card: { overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface }, compactCard: { borderRadius: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md }, avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.border }, avatarFallback: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FCE7F3' }, avatarFallbackText: { color: colors.primary, fontWeight: '900', fontSize: 18 }, identity: { flex: 1, gap: 2 }, nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, creatorName: { color: colors.text, fontSize: 16, fontWeight: '900' }, verified: { width: 18, height: 18, borderRadius: 9, overflow: 'hidden', textAlign: 'center', color: '#FFFFFF', backgroundColor: '#0EA5E9', fontWeight: '900' }, meta: { color: colors.muted, fontSize: 12 }, menuButton: { minWidth: 38, minHeight: 38, alignItems: 'center', justifyContent: 'center' }, menuText: { color: colors.muted, fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  status: { alignSelf: 'flex-start', marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: 999, backgroundColor: '#F3F4F6', color: colors.muted, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: '800' }, body: { color: colors.text, fontSize: 16, lineHeight: 23, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  videoCard: { marginHorizontal: spacing.md, marginBottom: spacing.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: '#F9FAFB' }, videoThumbnail: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.border }, externalFallback: { width: '100%', aspectRatio: 16 / 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E0F2FE' }, externalProvider: { color: '#0369A1', fontSize: 24, fontWeight: '900' }, videoCopy: { padding: spacing.md, gap: 4 }, videoProvider: { color: colors.text, fontSize: 14, fontWeight: '900' }, videoUrl: { color: colors.muted, fontSize: 12, lineHeight: 17 }, openLink: { color: colors.primary, fontSize: 13, fontWeight: '800', marginTop: 4 },
  mediaFrame: { minHeight: 260, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' }, postImage: { width: '100%', aspectRatio: 1, backgroundColor: colors.border }, lockedOverlay: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md, alignItems: 'center', borderRadius: 16, backgroundColor: 'rgba(17,24,39,0.88)', padding: spacing.md, gap: spacing.xs }, lockIcon: { fontSize: 23 }, lockTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' }, lockGift: { color: '#FCE7F3', fontSize: 13, fontWeight: '800' }, unlockButton: { alignSelf: 'stretch', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: colors.primary, marginTop: spacing.sm, paddingHorizontal: spacing.md }, unlockButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', textAlign: 'center' },
  notice: { margin: spacing.md, borderRadius: 12, backgroundColor: '#FFF7ED', color: '#9A3412', padding: spacing.sm, fontSize: 12, lineHeight: 18 }, footerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md }, actionText: { color: colors.muted, fontSize: 12, fontWeight: '800' }, dangerText: { color: colors.danger, fontSize: 12, fontWeight: '800' }, ownerStats: { color: colors.muted, fontSize: 11, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  loadMoreButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, paddingHorizontal: spacing.md }, loadMoreText: { color: colors.text, fontSize: 13, fontWeight: '800' }, skeleton: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface }, stateCard: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: spacing.lg }, stateTitle: { color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' }, stateDescription: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
