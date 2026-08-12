import {
  createPrivateMediaUrl,
  getReadablePrivatePhotoError,
  isMediaVisibleToOwner,
  listMyMedia,
  listReceivedPrivatePhotoRequests,
  respondPrivatePhotoAccess,
  revokePrivatePhotoAccess,
  uploadProfileImage,
  type MyMediaItem,
  type ReceivedPrivatePhotoRequest,
} from '@myfan/supabase';
import { luxyColors, luxyRadii, luxySpacing } from '@myfan/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import {
  LuxySettingsPage,
  SettingsAction,
  SettingsNotice,
  SettingsSection,
} from '@/components/luxy-settings-layout';
import {
  getReadableProfileMediaError,
  pickAndPrepareProfileImages,
} from '@/lib/profile-media';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type PrivatePhoto = MyMediaItem & { url: string };
type RequestWithAvatar = ReceivedPrivatePhotoRequest & { avatarUrl: string | null };

export default function PrivatePhotosSettingsPage() {
  const auth = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const client = getMobileSupabaseClient();

  const photosQuery = useQuery({
    queryKey: ['settings', 'private-photos', auth.userId],
    enabled: Boolean(client && auth.userId),
    staleTime: 15_000,
    queryFn: async () => {
      if (!client) return [] as PrivatePhoto[];
      const rows = (await listMyMedia(client)).filter(
        (item) => item.visibility === 'private' && isMediaVisibleToOwner(item),
      );
      return Promise.all(rows.map(async (item) => ({
        ...item,
        url: await createPrivateMediaUrl(client, item),
      })));
    },
  });

  const requestsQuery = useQuery({
    queryKey: ['private-photo-requests', auth.userId],
    enabled: Boolean(client && auth.userId),
    staleTime: 10_000,
    queryFn: async () => {
      if (!client) return [] as RequestWithAvatar[];
      const rows = await listReceivedPrivatePhotoRequests(client);
      return Promise.all(rows.map(async (request) => {
        if (!request.avatar_storage_bucket || !request.avatar_storage_path) return { ...request, avatarUrl: null };
        try {
          const avatarUrl = await createPrivateMediaUrl(client, {
            storage_bucket: request.avatar_storage_bucket,
            storage_path: request.avatar_storage_path,
          });
          return { ...request, avatarUrl };
        } catch {
          return { ...request, avatarUrl: null };
        }
      }));
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      const prepared = await pickAndPrepareProfileImages('private');
      if (!prepared.length) return 0;
      for (const image of prepared) await uploadProfileImage(client, image);
      return prepared.length;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings', 'private-photos', auth.userId] });
      await queryClient.invalidateQueries({ queryKey: ['profile', 'media', auth.userId] });
    },
  });

  const accessMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: 'approved' | 'declined' | 'revoked' }) => {
      if (!client) throw new Error('supabase_not_configured');
      if (action === 'revoked') return revokePrivatePhotoAccess(client, requestId);
      return respondPrivatePhotoAccess(client, requestId, action);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['private-photo-requests', auth.userId] });
    },
  });

  if (!auth.isRestoring && !auth.userId) return <Redirect href="/(auth)" />;

  const error = uploadMutation.error ?? photosQuery.error ?? requestsQuery.error ?? accessMutation.error;
  const pending = requestsQuery.data?.filter((item) => item.status === 'pending') ?? [];
  const decided = requestsQuery.data?.filter((item) => item.status !== 'pending') ?? [];

  return (
    <LuxySettingsPage
      description="Ảnh riêng tư chỉ được mở cho thành viên Premium/Diamond sau khi bạn chấp thuận yêu cầu."
      testID="luxy-private-photo-settings"
      title="Ảnh riêng tư"
    >
      <SettingsNotice title="Bạn luôn kiểm soát quyền xem">
        Quà tặng, Fan và trạng thái kết nối không mở khóa ảnh riêng tư. Bạn có thể duyệt, từ chối hoặc thu hồi quyền đã cấp bất cứ lúc nào.
      </SettingsNotice>

      <SettingsSection
        description="Ảnh được tải với media visibility = private và vẫn đi qua pipeline moderation hiện tại."
        testID="private-photo-library"
        title="Thư viện ảnh riêng tư"
      >
        <View style={styles.content}>
          <View style={styles.actionRow}>
            <SettingsAction
              disabled={uploadMutation.isPending}
              label={uploadMutation.isPending ? 'Đang tải ảnh…' : 'Chọn ảnh riêng tư'}
              onPress={() => uploadMutation.mutate()}
              testID="private-photo-upload"
            />
            <Text style={styles.actionHelp}>Có thể chọn nhiều ảnh cùng lúc. Ảnh không được đưa vào album công khai.</Text>
          </View>

          {photosQuery.isLoading ? (
            <ActivityIndicator accessibilityLabel="Đang tải ảnh riêng tư" color={luxyColors.ink} />
          ) : photosQuery.data?.length ? (
            <View style={styles.gallery}>
              {photosQuery.data.map((photo) => (
                <View key={photo.id} style={styles.photoWrap}>
                  <Image accessibilityLabel="Ảnh riêng tư" source={{ uri: photo.url }} style={styles.photo} />
                  <Text style={styles.photoStatus}>{statusLabel(photo.moderation_status)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptySymbol}>▣</Text>
              <Text style={styles.emptyTitle}>Chưa có ảnh riêng tư</Text>
              <Text style={styles.emptyText}>Chọn ảnh ở trên để tạo thư viện riêng tư đầu tiên.</Text>
            </View>
          )}
        </View>
      </SettingsSection>

      <SettingsSection
        description="Thành viên Premium/Diamond có thể gửi yêu cầu; không ai được xem trước khi bạn chấp thuận."
        testID="private-photo-request-management"
        title={`Yêu cầu đang chờ${pending.length ? ` (${pending.length})` : ''}`}
      >
        <View style={styles.requestList}>
          {requestsQuery.isLoading ? (
            <ActivityIndicator accessibilityLabel="Đang tải yêu cầu ảnh riêng tư" color={luxyColors.ink} />
          ) : pending.length ? pending.map((request) => (
            <PrivatePhotoRequestRow
              busy={accessMutation.isPending}
              key={request.request_id}
              onAction={(action) => accessMutation.mutate({ requestId: request.request_id, action })}
              request={request}
            />
          )) : (
            <Text style={styles.requestEmpty}>Chưa có yêu cầu mới.</Text>
          )}
        </View>
      </SettingsSection>

      {decided.length ? (
        <SettingsSection
          description="Quyền đã duyệt có thể thu hồi ngay; yêu cầu đã từ chối được lưu để bạn nhận biết lịch sử."
          title="Đã xử lý"
        >
          <View style={styles.requestList}>
            {decided.map((request) => (
              <PrivatePhotoRequestRow
                busy={accessMutation.isPending}
                key={request.request_id}
                onAction={(action) => accessMutation.mutate({ requestId: request.request_id, action })}
                request={request}
              />
            ))}
          </View>
        </SettingsSection>
      ) : null}

      {uploadMutation.data ? (
        <Text accessibilityRole="alert" style={styles.success}>Đã thêm {uploadMutation.data} ảnh riêng tư.</Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error === accessMutation.error || error === requestsQuery.error ? getReadablePrivatePhotoError(error) : getReadableProfileMediaError(error)}
        </Text>
      ) : null}

      <View style={styles.backRow}>
        <SettingsAction label="Quay lại Cài đặt" onPress={() => router.push('/settings')} secondary />
      </View>
    </LuxySettingsPage>
  );
}

function PrivatePhotoRequestRow({
  request,
  busy,
  onAction,
}: {
  request: RequestWithAvatar;
  busy: boolean;
  onAction: (action: 'approved' | 'declined' | 'revoked') => void;
}) {
  const name = request.display_name || request.username;
  return (
    <View style={styles.requestCard} testID={`private-photo-request-${request.request_id}`}>
      <View style={styles.requestIdentity}>
        {request.avatarUrl ? (
          <Image accessibilityLabel={`Ảnh đại diện của ${name}`} source={{ uri: request.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}><Text style={styles.avatarFallbackText}>{name.slice(0, 1).toUpperCase()}</Text></View>
        )}
        <View style={styles.requestCopy}>
          <Text style={styles.requestName}>{name}</Text>
          <Text style={styles.requestMeta}>{requestStatusLabel(request.status)} · {formatRequestDate(request.requested_at)}</Text>
        </View>
      </View>
      {request.status === 'pending' ? (
        <View style={styles.requestActions}>
          <SettingsAction disabled={busy} label="Từ chối" onPress={() => onAction('declined')} secondary />
          <SettingsAction disabled={busy} label="Duyệt xem ảnh" onPress={() => onAction('approved')} />
        </View>
      ) : request.status === 'approved' ? (
        <View style={styles.requestActions}>
          <SettingsAction disabled={busy} label="Thu hồi quyền" onPress={() => onAction('revoked')} secondary />
        </View>
      ) : null}
    </View>
  );
}

function statusLabel(status: MyMediaItem['moderation_status']): string {
  if (status === 'approved') return 'Đã duyệt';
  if (status === 'pending_review') return 'Đang kiểm tra';
  if (status === 'quarantined') return 'Đang xem xét';
  if (status === 'rejected') return 'Không đạt';
  return status;
}

function requestStatusLabel(status: ReceivedPrivatePhotoRequest['status']): string {
  if (status === 'pending') return 'Đang chờ';
  if (status === 'approved') return 'Đã cấp quyền';
  if (status === 'declined') return 'Đã từ chối';
  return 'Đã thu hồi';
}

function formatRequestDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  content: { gap: luxySpacing.lg, padding: luxySpacing.lg },
  actionRow: { gap: luxySpacing.sm },
  actionHelp: { color: luxyColors.muted, fontSize: 12.5, lineHeight: 18 },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: luxySpacing.md },
  photoWrap: { gap: 5, width: '31.5%' },
  photo: { aspectRatio: 0.78, backgroundColor: luxyColors.elevatedSubtle, borderRadius: luxyRadii.sm, width: '100%' },
  photoStatus: { color: luxyColors.muted, fontSize: 11.5 },
  empty: { alignItems: 'center', gap: 5, justifyContent: 'center', minHeight: 180 },
  emptySymbol: { color: luxyColors.softMuted, fontSize: 36 },
  emptyTitle: { color: luxyColors.text, fontSize: 15.5, fontWeight: '700' },
  emptyText: { color: luxyColors.muted, fontSize: 12.5, textAlign: 'center' },
  requestList: { gap: luxySpacing.md, padding: luxySpacing.lg },
  requestEmpty: { color: luxyColors.muted, fontSize: 13, paddingVertical: luxySpacing.md, textAlign: 'center' },
  requestCard: { borderColor: luxyColors.border, borderRadius: luxyRadii.md, borderWidth: 1, gap: luxySpacing.md, padding: luxySpacing.md },
  requestIdentity: { alignItems: 'center', flexDirection: 'row', gap: luxySpacing.md },
  avatar: { backgroundColor: luxyColors.elevatedSubtle, borderRadius: 24, height: 48, width: 48 },
  avatarFallback: { alignItems: 'center', backgroundColor: luxyColors.elevatedSubtle, borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  avatarFallbackText: { color: luxyColors.muted, fontSize: 18, fontWeight: '700' },
  requestCopy: { flex: 1, gap: 3 },
  requestName: { color: luxyColors.text, fontSize: 14.5, fontWeight: '700' },
  requestMeta: { color: luxyColors.muted, fontSize: 11.5 },
  requestActions: { flexDirection: 'row', flexWrap: 'wrap', gap: luxySpacing.sm },
  success: { color: '#166534', fontSize: 13.5, marginBottom: luxySpacing.lg },
  error: { color: luxyColors.danger, fontSize: 13.5, marginBottom: luxySpacing.lg },
  backRow: { alignItems: 'flex-start', marginBottom: luxySpacing.xl },
});
