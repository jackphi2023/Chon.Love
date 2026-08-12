import {
  createPrivateMediaUrl,
  getReadablePrivatePhotoAccessError,
  isMediaVisibleToOwner,
  listMyMedia,
  listMyPrivatePhotoAccessRequests,
  respondToPrivatePhotoAccessRequest,
  revokePrivatePhotoAccess,
  uploadProfileImage,
  type MyMediaItem,
  type PrivatePhotoOwnerRequest,
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

export default function PrivatePhotosSettingsPage() {
  const auth = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const client = getMobileSupabaseClient();
  const accessQueryKey = ['settings', 'private-photo-access', auth.userId] as const;

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

  const pendingRequestsQuery = useQuery({
    queryKey: [...accessQueryKey, 'pending'],
    enabled: Boolean(client && auth.userId),
    staleTime: 10_000,
    queryFn: async () => {
      if (!client) return [] as PrivatePhotoOwnerRequest[];
      return listMyPrivatePhotoAccessRequests(client, 'pending');
    },
  });

  const approvedRequestsQuery = useQuery({
    queryKey: [...accessQueryKey, 'approved'],
    enabled: Boolean(client && auth.userId),
    staleTime: 10_000,
    queryFn: async () => {
      if (!client) return [] as PrivatePhotoOwnerRequest[];
      return listMyPrivatePhotoAccessRequests(client, 'approved');
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

  const respondMutation = useMutation({
    mutationFn: async ({ requestId, approve }: { requestId: string; approve: boolean }) => {
      if (!client) throw new Error('supabase_not_configured');
      return respondToPrivatePhotoAccessRequest(client, requestId, approve);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accessQueryKey });
      await queryClient.invalidateQueries({ queryKey: ['private-photo-access'] });
      await queryClient.invalidateQueries({ queryKey: ['private-photo-media'] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (requesterId: string) => {
      if (!client) throw new Error('supabase_not_configured');
      return revokePrivatePhotoAccess(client, requesterId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accessQueryKey });
      await queryClient.invalidateQueries({ queryKey: ['private-photo-access'] });
      await queryClient.invalidateQueries({ queryKey: ['private-photo-media'] });
    },
  });

  if (!auth.isRestoring && !auth.userId) return <Redirect href="/(auth)" />;

  const mediaError = uploadMutation.error ?? photosQuery.error;
  const accessError = respondMutation.error ?? revokeMutation.error ?? pendingRequestsQuery.error ?? approvedRequestsQuery.error;
  const pendingRequests = pendingRequestsQuery.data ?? [];
  const approvedRequests = approvedRequestsQuery.data ?? [];

  return (
    <LuxySettingsPage
      description="Ảnh bảo mật chỉ được chia sẻ khi chính bạn chấp nhận yêu cầu của từng thành viên."
      testID="luxy-private-photo-settings"
      title="Ảnh bảo mật"
    >
      <SettingsNotice title="Bạn kiểm soát quyền xem">
        Quà tặng, Premium hay Diamond không tự động mở khóa ảnh bảo mật. Mỗi người muốn xem phải gửi yêu cầu và chỉ có bạn mới có thể chấp nhận, từ chối hoặc thu hồi quyền đã cấp.
      </SettingsNotice>

      <SettingsSection
        description="Yêu cầu mới chưa có quyền xem ảnh cho đến khi bạn bấm Chấp nhận."
        testID="private-photo-pending-requests"
        title={`Yêu cầu đang chờ${pendingRequests.length ? ` (${pendingRequests.length})` : ''}`}
      >
        <View style={styles.content}>
          {pendingRequestsQuery.isLoading ? (
            <ActivityIndicator accessibilityLabel="Đang tải yêu cầu xem ảnh" color={luxyColors.ink} />
          ) : pendingRequests.length ? (
            <View style={styles.requestList}>
              {pendingRequests.map((request) => (
                <AccessRequestRow
                  busy={respondMutation.isPending}
                  key={request.request_id}
                  onApprove={() => respondMutation.mutate({ requestId: request.request_id, approve: true })}
                  onReject={() => respondMutation.mutate({ requestId: request.request_id, approve: false })}
                  request={request}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Hiện chưa có yêu cầu xem ảnh riêng tư nào.</Text>
          )}
        </View>
      </SettingsSection>

      <SettingsSection
        description="Các thành viên này đang có quyền xem album riêng tư. Bạn có thể thu hồi bất cứ lúc nào."
        testID="private-photo-approved-grants"
        title={`Đang được chia sẻ${approvedRequests.length ? ` (${approvedRequests.length})` : ''}`}
      >
        <View style={styles.content}>
          {approvedRequestsQuery.isLoading ? (
            <ActivityIndicator accessibilityLabel="Đang tải quyền xem ảnh" color={luxyColors.ink} />
          ) : approvedRequests.length ? (
            <View style={styles.requestList}>
              {approvedRequests.map((request) => (
                <View key={request.request_id} style={styles.requestRow}>
                  <View style={styles.requestCopy}>
                    <Text style={styles.requestName}>{request.display_name}</Text>
                    <Text style={styles.requestMeta}>@{request.username} · Đã được chia sẻ</Text>
                  </View>
                  <SettingsAction
                    disabled={revokeMutation.isPending}
                    label="Thu hồi quyền"
                    onPress={() => revokeMutation.mutate(request.requester_id)}
                    secondary
                  />
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Bạn chưa chia sẻ album riêng tư cho thành viên nào.</Text>
          )}
        </View>
      </SettingsSection>

      <SettingsSection
        description="Ảnh được tải với media visibility = private, gắn vào album riêng tư và vẫn đi qua pipeline moderation hiện tại."
        testID="private-photo-library"
        title="Thư viện ảnh riêng tư"
      >
        <View style={styles.content}>
          <View style={styles.actionRow}>
            <SettingsAction
              disabled={uploadMutation.isPending}
              label={uploadMutation.isPending ? 'Đang tải ảnh…' : 'Chọn ảnh bảo mật'}
              onPress={() => uploadMutation.mutate()}
              testID="private-photo-upload"
            />
            <Text style={styles.actionHelp}>Có thể chọn nhiều ảnh cùng lúc. Ảnh không xuất hiện trong album công khai.</Text>
          </View>

          {photosQuery.isLoading ? (
            <ActivityIndicator accessibilityLabel="Đang tải ảnh bảo mật" color={luxyColors.ink} />
          ) : photosQuery.data?.length ? (
            <View style={styles.gallery}>
              {photosQuery.data.map((photo) => (
                <View key={photo.id} style={styles.photoWrap}>
                  <Image accessibilityLabel="Ảnh bảo mật" source={{ uri: photo.url }} style={styles.photo} />
                  <Text style={styles.photoStatus}>{statusLabel(photo.moderation_status)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptySymbol}>▣</Text>
              <Text style={styles.emptyTitle}>Chưa có ảnh bảo mật</Text>
              <Text style={styles.emptyText}>Chọn ảnh ở trên để tạo thư viện riêng tư đầu tiên.</Text>
            </View>
          )}
        </View>
      </SettingsSection>

      {uploadMutation.data ? (
        <Text accessibilityRole="alert" style={styles.success}>Đã thêm {uploadMutation.data} ảnh bảo mật.</Text>
      ) : null}
      {mediaError ? (
        <Text accessibilityRole="alert" style={styles.error}>{getReadableProfileMediaError(mediaError)}</Text>
      ) : null}
      {accessError ? (
        <Text accessibilityRole="alert" style={styles.error}>{getReadablePrivatePhotoAccessError(accessError)}</Text>
      ) : null}

      <View style={styles.backRow}>
        <SettingsAction label="Quay lại Cài đặt" onPress={() => router.push('/settings')} secondary />
      </View>
    </LuxySettingsPage>
  );
}

function AccessRequestRow({
  request,
  busy,
  onApprove,
  onReject,
}: {
  request: PrivatePhotoOwnerRequest;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <View style={styles.requestRow} testID="private-photo-pending-request-row">
      <View style={styles.requestCopy}>
        <Text style={styles.requestName}>{request.display_name}</Text>
        <Text style={styles.requestMeta}>@{request.username} muốn xem ảnh riêng tư của bạn</Text>
      </View>
      <View style={styles.requestActions}>
        <SettingsAction disabled={busy} label="Chấp nhận" onPress={onApprove} />
        <SettingsAction disabled={busy} label="Từ chối" onPress={onReject} secondary />
      </View>
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

const styles = StyleSheet.create({
  content: { gap: luxySpacing.lg, padding: luxySpacing.lg },
  actionRow: { gap: luxySpacing.sm },
  actionHelp: { color: luxyColors.muted, fontSize: 12.5, lineHeight: 18 },
  requestList: { gap: luxySpacing.md },
  requestRow: { alignItems: 'flex-start', borderBottomColor: luxyColors.border, borderBottomWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: luxySpacing.md, justifyContent: 'space-between', paddingBottom: luxySpacing.md },
  requestCopy: { flex: 1, minWidth: 190 },
  requestName: { color: luxyColors.text, fontSize: 14.5, fontWeight: '700' },
  requestMeta: { color: luxyColors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  requestActions: { flexDirection: 'row', flexWrap: 'wrap', gap: luxySpacing.sm },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: luxySpacing.md },
  photoWrap: { gap: 5, width: '31.5%' },
  photo: { aspectRatio: 0.78, backgroundColor: luxyColors.elevatedSubtle, borderRadius: luxyRadii.sm, width: '100%' },
  photoStatus: { color: luxyColors.muted, fontSize: 11.5 },
  empty: { alignItems: 'center', gap: 5, justifyContent: 'center', minHeight: 220 },
  emptySymbol: { color: luxyColors.softMuted, fontSize: 36 },
  emptyTitle: { color: luxyColors.text, fontSize: 15.5, fontWeight: '700' },
  emptyText: { color: luxyColors.muted, fontSize: 12.5, textAlign: 'center' },
  success: { color: '#166534', fontSize: 13.5, marginBottom: luxySpacing.lg },
  error: { color: luxyColors.danger, fontSize: 13.5, marginBottom: luxySpacing.lg },
  backRow: { alignItems: 'flex-start', marginBottom: luxySpacing.xl },
});
