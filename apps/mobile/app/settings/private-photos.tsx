import {
  createPrivateMediaUrl,
  isMediaVisibleToOwner,
  listMyMedia,
  uploadProfileImage,
  type MyMediaItem,
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

  if (!auth.isRestoring && !auth.userId) return <Redirect href="/(auth)" />;

  const error = uploadMutation.error ?? photosQuery.error;

  return (
    <LuxySettingsPage
      description="Ảnh bảo mật nằm ngoài album công khai/Fan và mặc định chỉ chủ tài khoản có thể xem."
      testID="luxy-private-photo-settings"
      title="Ảnh bảo mật"
    >
      <SettingsNotice title="Tách biệt khỏi quà tặng">
        Quà tặng không mở khóa ảnh bảo mật. Quyền yêu cầu/xem ảnh riêng tư giữa hai thành viên sẽ được triển khai bằng request/accept/decline ở LX-14, độc lập hoàn toàn với gift ledger.
      </SettingsNotice>

      <SettingsSection
        description="Ảnh được tải vào media visibility = private và vẫn đi qua pipeline moderation hiện tại."
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
            <Text style={styles.actionHelp}>Có thể chọn nhiều ảnh cùng lúc. Ảnh không được đưa vào album công khai.</Text>
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
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>{getReadableProfileMediaError(error)}</Text>
      ) : null}

      <View style={styles.backRow}>
        <SettingsAction label="Quay lại Cài đặt" onPress={() => router.push('/settings')} secondary />
      </View>
    </LuxySettingsPage>
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
