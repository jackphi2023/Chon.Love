import {
  createPrivateMediaUrl,
  getPrivatePhotoAccessState,
  getReadablePrivatePhotoAccessError,
  listProfileAlbumMedia,
  requestPrivatePhotoAccess,
} from '@myfan/supabase';
import { luxyColors, luxyRadii, luxySpacing, luxyTypography } from '@myfan/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type PrivatePhotoCardProps = {
  ownerId: string;
  displayName: string;
  privatePhotoCount: number;
  variant?: 'button' | 'gallery';
  onOpenPhoto?: (url: string) => void;
};

type SignedPrivatePhoto = {
  id: string;
  url: string;
};

export function PrivatePhotoCard({
  ownerId,
  displayName,
  privatePhotoCount,
  variant = 'gallery',
  onOpenPhoto,
}: PrivatePhotoCardProps) {
  const client = getMobileSupabaseClient();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const stateKey = useMemo(() => ['private-photo-access', auth.userId, ownerId] as const, [auth.userId, ownerId]);
  const stateQuery = useQuery({
    queryKey: stateKey,
    enabled: Boolean(client && auth.userId && ownerId && auth.userId !== ownerId && privatePhotoCount > 0),
    staleTime: 15_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getPrivatePhotoAccessState(client, ownerId);
    },
  });

  const canView = stateQuery.data?.can_view === true;
  const privateMediaQuery = useQuery({
    queryKey: ['private-photo-media', auth.userId, ownerId],
    enabled: Boolean(client && canView),
    staleTime: 15_000,
    queryFn: async (): Promise<SignedPrivatePhoto[]> => {
      if (!client) throw new Error('supabase_not_configured');
      const media = await listProfileAlbumMedia(client, ownerId, 'private');
      return Promise.all(
        media.map(async (item) => ({
          id: item.media_id,
          url: await createPrivateMediaUrl(client, {
            storage_bucket: item.storage_bucket,
            storage_path: item.storage_path,
          }, 120),
        })),
      );
    },
  });

  if (privatePhotoCount <= 0 || auth.userId === ownerId) return null;

  const status = stateQuery.data?.request_status ?? null;
  const pending = status === 'pending';
  const stateUnavailable = stateQuery.isError;

  async function submitRequest() {
    if (!client || requesting || pending) return;
    setRequesting(true);
    setLocalError(null);
    try {
      await requestPrivatePhotoAccess(client, ownerId);
      await queryClient.invalidateQueries({ queryKey: stateKey });
      setShowModal(true);
    } catch (error) {
      setLocalError(getReadablePrivatePhotoAccessError(error));
    } finally {
      setRequesting(false);
    }
  }

  if (canView && variant === 'button') {
    return (
      <View style={styles.approvedButton} testID="private-photo-access-approved-button">
        <Text style={styles.approvedButtonText}>✓ Ảnh riêng tư đã được chia sẻ ({privatePhotoCount})</Text>
      </View>
    );
  }

  if (canView && variant === 'gallery') {
    const photos = privateMediaQuery.data ?? [];
    return (
      <View style={styles.approvedSection} testID="private-photo-approved-gallery">
        <View style={styles.approvedHeadingRow}>
          <Text style={styles.approvedHeading}>Ảnh riêng tư</Text>
          <Text style={styles.approvedBadge}>Đã được chia sẻ</Text>
        </View>
        <Text style={styles.approvedDescription}>
          {displayName} đã chấp nhận yêu cầu của bạn. Quyền xem có thể được chủ ảnh thu hồi bất cứ lúc nào.
        </Text>
        {privateMediaQuery.isLoading ? (
          <View style={styles.loadingRow}><ActivityIndicator /><Text style={styles.loadingText}>Đang mở ảnh riêng tư…</Text></View>
        ) : photos.length > 0 ? (
          <View style={styles.photoGrid}>
            {photos.map((photo) => (
              <Pressable
                accessibilityLabel={`Mở ảnh riêng tư của ${displayName}`}
                accessibilityRole="button"
                key={photo.id}
                onPress={() => onOpenPhoto?.(photo.url)}
                style={({ pressed }) => [styles.photoTile, pressed && styles.pressed]}
                testID="private-photo-approved-tile"
              >
                <Image accessibilityIgnoresInvertColors resizeMode="cover" source={{ uri: photo.url }} style={styles.photo} />
                <View style={styles.privatePill}><Text style={styles.privatePillText}>Riêng tư</Text></View>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>Ảnh riêng tư hiện chưa sẵn sàng.</Text>
        )}
      </View>
    );
  }

  const trigger = variant === 'button' ? (
    <Pressable
      accessibilityRole="button"
      disabled={stateUnavailable}
      onPress={() => { setLocalError(null); setShowModal(true); }}
      style={({ pressed }) => [styles.requestButton, pressed && styles.pressed, stateUnavailable && styles.disabled]}
      testID="private-photo-request-button"
    >
      <Text style={styles.requestButtonText}>
        {pending ? `Đang chờ duyệt ảnh riêng tư (${privatePhotoCount})` : `Yêu cầu xem ảnh riêng tư (${privatePhotoCount})`}
      </Text>
    </Pressable>
  ) : (
    <Pressable
      accessibilityLabel={`Yêu cầu xem ${privatePhotoCount} ảnh riêng tư của ${displayName}`}
      accessibilityRole="button"
      disabled={stateUnavailable}
      onPress={() => { setLocalError(null); setShowModal(true); }}
      style={({ pressed }) => [styles.lockedTile, pressed && styles.pressed, stateUnavailable && styles.disabled]}
      testID="private-photo-locked-card"
    >
      <Text accessibilityElementsHidden style={styles.lockIcon}>⌑</Text>
      <Text style={styles.lockedTitle}>Ảnh riêng tư ({privatePhotoCount})</Text>
      <Text style={styles.lockedAction}>{pending ? 'Đang chờ chấp nhận' : 'Yêu cầu xem'}</Text>
    </Pressable>
  );

  return (
    <>
      {trigger}
      <Modal animationType="fade" onRequestClose={() => setShowModal(false)} transparent visible={showModal}>
        <View style={styles.backdrop} testID="private-photo-request-modal">
          <Pressable accessibilityLabel="Đóng yêu cầu xem ảnh riêng tư" accessibilityRole="button" onPress={() => setShowModal(false)} style={styles.backdropDismiss} />
          <View accessibilityViewIsModal style={styles.modalCard}>
            <Pressable accessibilityLabel="Đóng" accessibilityRole="button" onPress={() => setShowModal(false)} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
            <Text accessibilityElementsHidden style={styles.modalIcon}>⌑</Text>
            <Text accessibilityRole="header" style={styles.modalTitle}>
              {pending ? 'Đang chờ chấp nhận' : 'Yêu cầu xem ảnh riêng tư'}
            </Text>
            <Text style={styles.modalDescription}>
              {pending
                ? `Yêu cầu đã được gửi đến ${displayName}. Bạn chỉ xem được ảnh sau khi chủ ảnh chấp nhận.`
                : `${displayName} có ${privatePhotoCount} ảnh riêng tư. Gửi yêu cầu để chủ ảnh tự quyết định có chia sẻ với bạn hay không.`}
            </Text>
            <View style={styles.privacyNote}>
              <Text style={styles.privacyNoteTitle}>Quyền riêng tư do chủ ảnh kiểm soát</Text>
              <Text style={styles.privacyNoteText}>Premium, Diamond hoặc quà tặng không tự động mở khóa ảnh riêng tư.</Text>
            </View>
            {localError ? <Text accessibilityRole="alert" style={styles.errorText}>{localError}</Text> : null}
            {!pending ? (
              <Pressable
                accessibilityRole="button"
                disabled={requesting}
                onPress={() => void submitRequest()}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, requesting && styles.disabled]}
                testID="private-photo-request-cta"
              >
                <Text style={styles.primaryButtonText}>{requesting ? 'Đang gửi yêu cầu…' : status === 'rejected' || status === 'revoked' ? 'Gửi lại yêu cầu' : 'Gửi yêu cầu xem ảnh'}</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={() => setShowModal(false)} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>{pending ? 'Đóng' : 'Để sau'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  requestButton: {
    alignItems: 'center',
    backgroundColor: luxyColors.actionRed,
    borderRadius: luxyRadii.pill,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  requestButtonText: { color: luxyColors.surface, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  approvedButton: { backgroundColor: '#F5F0E4', borderRadius: luxyRadii.pill, paddingHorizontal: 16, paddingVertical: 12 },
  approvedButtonText: { color: luxyColors.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  lockedTile: {
    alignItems: 'center',
    backgroundColor: '#F7F3EA',
    borderColor: '#E4D5B1',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 180,
    padding: 18,
  },
  lockIcon: { color: '#D4B16D', fontSize: 48, lineHeight: 52 },
  lockedTitle: { color: luxyColors.text, fontSize: 15, fontWeight: '700', marginTop: 7, textAlign: 'center' },
  lockedAction: { color: luxyColors.actionRed, fontSize: 13, fontWeight: '700', marginTop: 6, textAlign: 'center' },
  approvedSection: { gap: 12 },
  approvedHeadingRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  approvedHeading: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 22 },
  approvedBadge: { backgroundColor: '#F1E7CC', borderRadius: luxyRadii.pill, color: luxyColors.text, fontSize: 11, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5 },
  approvedDescription: { color: luxyColors.muted, fontSize: 13, lineHeight: 19 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoTile: { borderRadius: 10, height: 210, maxWidth: 240, minWidth: 150, overflow: 'hidden', position: 'relative', width: '48%' },
  photo: { height: '100%', width: '100%' },
  privatePill: { backgroundColor: 'rgba(8,23,38,0.78)', borderRadius: luxyRadii.pill, left: 8, paddingHorizontal: 8, paddingVertical: 4, position: 'absolute', top: 8 },
  privatePillText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 54 },
  loadingText: { color: luxyColors.muted, fontSize: 13 },
  emptyText: { color: luxyColors.muted, fontSize: 13 },
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(8,23,38,0.72)', flex: 1, justifyContent: 'center', padding: luxySpacing.lg },
  backdropDismiss: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  modalCard: { backgroundColor: luxyColors.surface, borderRadius: 16, maxWidth: 430, paddingBottom: 26, paddingHorizontal: 22, paddingTop: 36, position: 'relative', width: '100%' },
  closeButton: { alignItems: 'center', height: 44, justifyContent: 'center', position: 'absolute', right: 8, top: 6, width: 44 },
  closeText: { color: luxyColors.muted, fontSize: 36, fontWeight: '300', lineHeight: 38 },
  modalIcon: { color: '#D8B874', fontSize: 50, lineHeight: 54, textAlign: 'center' },
  modalTitle: { color: luxyColors.text, fontFamily: luxyTypography.families.display, fontSize: 25, fontWeight: '400', lineHeight: 31, marginTop: 4, textAlign: 'center' },
  modalDescription: { color: luxyColors.muted, fontSize: 14, lineHeight: 21, marginTop: 9, textAlign: 'center' },
  privacyNote: { backgroundColor: '#FAF7F0', borderRadius: 10, marginTop: 20, padding: 14 },
  privacyNoteTitle: { color: luxyColors.text, fontSize: 13, fontWeight: '700' },
  privacyNoteText: { color: luxyColors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  errorText: { color: luxyColors.actionRed, fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: 'center' },
  primaryButton: { alignItems: 'center', backgroundColor: luxyColors.actionRed, borderRadius: luxyRadii.pill, justifyContent: 'center', marginTop: 22, minHeight: 50, paddingHorizontal: 24 },
  primaryButtonText: { color: luxyColors.surface, fontSize: 14, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: 4 },
  secondaryText: { color: luxyColors.text, fontSize: 13, textDecorationLine: 'underline' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
});
