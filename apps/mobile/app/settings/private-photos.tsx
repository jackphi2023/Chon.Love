import {
  createPrivateMediaUrl,
  isMediaVisibleToOwner,
  listMyMedia,
  setMyProfilePhotoVisibility,
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
import { getReadableProfileMediaError } from '@/lib/profile-media';
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

  const visibilityMutation = useMutation({
    mutationFn: async (photoId: string) => {
      if (!client) throw new Error('supabase_not_configured');
      return setMyProfilePhotoVisibility(client, photoId, 'public');
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['settings', 'private-photos', auth.userId] }),
        queryClient.invalidateQueries({ queryKey: ['profile', 'media', auth.userId] }),
        queryClient.invalidateQueries({ queryKey: ['luxy-member-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['private-photo-media'] }),
        queryClient.invalidateQueries({ queryKey: ['private-photo-access'] }),
      ]);
    },
  });

  if (!auth.isRestoring && !auth.userId) return <Redirect href="/(auth)" />;

  const error = photosQuery.error ?? visibilityMutation.error;

  return (
    <LuxySettingsPage
      description="Các ảnh bạn đã chọn Ẩn trong trang Hồ sơ. Premium và Diamond có thể xem; Free chỉ thấy khu vực ảnh bị khóa."
      testID="luxy-private-photo-settings"
      title="Ảnh riêng tư"
    >
      <SettingsNotice title="Ảnh mới luôn công khai trước">
        Theo luồng Luxy V1, ảnh hồ sơ mới được upload ở trạng thái Công khai. Vào “Hồ sơ của tôi” và chọn “Ẩn” trên từng ảnh để đưa ảnh vào đây. Quà tặng hoặc các loại kết nối không mở khóa ảnh.
      </SettingsNotice>

      <SettingsSection
        description="Bạn có thể đưa bất kỳ ảnh riêng tư nào trở lại hồ sơ công khai ngay lập tức."
        testID="private-photo-library"
        title={`Thư viện ảnh riêng tư${photosQuery.data?.length ? ` (${photosQuery.data.length})` : ''}`}
      >
        <View style={styles.content}>
          {photosQuery.isLoading ? (
            <ActivityIndicator accessibilityLabel="Đang tải ảnh riêng tư" color={luxyColors.ink} />
          ) : photosQuery.data?.length ? (
            <View style={styles.gallery}>
              {photosQuery.data.map((photo) => (
                <View key={photo.id} style={styles.photoWrap}>
                  <View style={styles.photoFrame}>
                    <Image accessibilityLabel="Ảnh riêng tư" source={{ uri: photo.url }} style={styles.photo} />
                    <View style={styles.privateBadge}><Text style={styles.privateBadgeText}>Ảnh riêng tư</Text></View>
                  </View>
                  <Text style={styles.photoStatus}>{statusLabel(photo.moderation_status)}</Text>
                  <SettingsAction
                    disabled={visibilityMutation.isPending}
                    label="Hiện công khai"
                    onPress={() => visibilityMutation.mutate(photo.id)}
                    secondary
                  />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptySymbol}>▣</Text>
              <Text style={styles.emptyTitle}>Chưa có ảnh riêng tư</Text>
              <Text style={styles.emptyText}>Mở Hồ sơ của tôi, upload ảnh công khai rồi chọn “Ẩn” trên ảnh muốn bảo mật.</Text>
              <SettingsAction label="Quản lý ảnh hồ sơ" onPress={() => router.push('/(tabs)/profile')} />
            </View>
          )}
        </View>
      </SettingsSection>

      <SettingsSection
        description="Quyền xem được kiểm tra lại ở server mỗi lần tải ảnh. Khi gói thành viên của viewer hết hạn, quyền xem ảnh riêng tư cũng hết ngay."
        title="Ai được xem?"
      >
        <View style={styles.rules}>
          <Text style={styles.rule}>• Premium: xem ảnh riêng tư.</Text>
          <Text style={styles.rule}>• Diamond: xem ảnh riêng tư.</Text>
          <Text style={styles.rule}>• Free: chỉ thấy số lượng/khu vực ảnh bị khóa và CTA nâng cấp.</Text>
          <Text style={styles.rule}>• Chủ ảnh: luôn xem và đổi trạng thái ảnh của chính mình.</Text>
        </View>
      </SettingsSection>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{getReadableProfileMediaError(error)}</Text> : null}

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
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: luxySpacing.md },
  photoWrap: { gap: 7, minWidth: 150, width: '31%' },
  photoFrame: { aspectRatio: 0.78, backgroundColor: luxyColors.elevatedSubtle, borderRadius: luxyRadii.sm, overflow: 'hidden', position: 'relative', width: '100%' },
  photo: { height: '100%', width: '100%' },
  privateBadge: { backgroundColor: 'rgba(8,23,38,0.82)', borderRadius: luxyRadii.pill, left: 7, paddingHorizontal: 8, paddingVertical: 4, position: 'absolute', top: 7 },
  privateBadgeText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' },
  photoStatus: { color: luxyColors.muted, fontSize: 11.5 },
  empty: { alignItems: 'center', gap: luxySpacing.sm, justifyContent: 'center', minHeight: 210 },
  emptySymbol: { color: luxyColors.softMuted, fontSize: 36 },
  emptyTitle: { color: luxyColors.text, fontSize: 15.5, fontWeight: '700' },
  emptyText: { color: luxyColors.muted, fontSize: 12.5, lineHeight: 18, maxWidth: 420, textAlign: 'center' },
  rules: { gap: 7, padding: luxySpacing.lg },
  rule: { color: luxyColors.muted, fontSize: 13, lineHeight: 19 },
  error: { color: luxyColors.danger, fontSize: 13.5, marginBottom: luxySpacing.lg },
  backRow: { alignItems: 'flex-start', marginBottom: luxySpacing.xl },
});
