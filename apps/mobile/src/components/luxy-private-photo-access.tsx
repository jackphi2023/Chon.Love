import {
  createLuxyUpgradeIntent,
  createPrivateMediaUrl,
  getMyLuxyMembershipSnapshot,
  getPrivatePhotoAccessState,
  getReadablePrivatePhotoError,
  listProfilePrivateMedia,
  requestPrivatePhotoAccess,
} from '@myfan/supabase';
import { luxyColors, luxyRadii } from '@myfan/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LuxyUpgradeGateModal } from '@/components/luxy-upgrade-gate-modal';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useState } from 'react';

type Variant = 'button' | 'tile';

type PrivatePhotoWithUrl = {
  media_id: string;
  url: string;
};

export function LuxyPrivatePhotoAccess({
  ownerId,
  displayName,
  privatePhotoCount,
  variant,
  onOpenPhoto,
}: {
  ownerId: string;
  displayName: string;
  privatePhotoCount: number;
  variant: Variant;
  onOpenPhoto: (url: string | null) => void;
}) {
  const client = getMobileSupabaseClient();
  const auth = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);

  const membershipQuery = useQuery({
    queryKey: ['luxy-membership', auth.userId],
    enabled: Boolean(client && auth.userId),
    staleTime: 20_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getMyLuxyMembershipSnapshot(client);
    },
  });

  const accessQuery = useQuery({
    queryKey: ['private-photo-access', auth.userId, ownerId],
    enabled: Boolean(client && auth.userId && ownerId && privatePhotoCount > 0),
    staleTime: 15_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getPrivatePhotoAccessState(client, ownerId);
    },
  });

  const privateMediaQuery = useQuery({
    queryKey: ['private-photo-media', auth.userId, ownerId],
    enabled: Boolean(client && accessQuery.data?.has_access),
    staleTime: 30_000,
    queryFn: async () => {
      if (!client) return [] as PrivatePhotoWithUrl[];
      const rows = await listProfilePrivateMedia(client, ownerId);
      return Promise.all(rows.map(async (media) => ({
        media_id: media.media_id,
        url: await createPrivateMediaUrl(client, {
          storage_bucket: media.storage_bucket,
          storage_path: media.storage_path,
        }),
      })));
    },
  });

  const requestMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return requestPrivatePhotoAccess(client, ownerId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['private-photo-access', auth.userId, ownerId] });
      await queryClient.invalidateQueries({ queryKey: ['private-photo-requests', auth.userId] });
    },
  });

  if (privatePhotoCount <= 0) return null;

  const state = accessQuery.data;
  const approved = state?.has_access === true;
  const pending = state?.status === 'pending';
  const requestLabel = pending
    ? 'Đã gửi yêu cầu · Đang chờ duyệt'
    : state?.status === 'declined' || state?.status === 'revoked'
      ? 'Yêu cầu xem lại'
      : 'Yêu cầu xem ảnh riêng tư';

  async function handleRequest() {
    if (pending || requestMutation.isPending) return;
    if (membershipQuery.data?.can_request_private_photo !== true) {
      setShowUpgrade(true);
      return;
    }
    try {
      await requestMutation.mutateAsync();
    } catch (error) {
      if (String(error).includes('premium_membership_required')) setShowUpgrade(true);
    }
  }

  async function handleUpgrade() {
    if (!client) return;
    setUpgradeBusy(true);
    try {
      await createLuxyUpgradeIntent(client, 'premium', 'member_profile_private_photo');
      setShowUpgrade(false);
      router.push({ pathname: '/settings/membership', params: { plan: 'premium', source: 'member_profile_private_photo' } });
    } finally {
      setUpgradeBusy(false);
    }
  }

  const error = requestMutation.error ?? accessQuery.error ?? privateMediaQuery.error;

  if (variant === 'tile') {
    return (
      <>
        {approved && privateMediaQuery.data?.length ? privateMediaQuery.data.map((media) => (
          <Pressable
            accessibilityLabel={`Xem ảnh riêng tư của ${displayName}`}
            accessibilityRole="button"
            key={media.media_id}
            onPress={() => onOpenPhoto(media.url)}
            style={({ pressed }) => [styles.approvedTile, pressed && styles.pressed]}
            testID="luxy-private-photo-approved-tile"
          >
            <Image accessibilityLabel={`Ảnh riêng tư của ${displayName}`} resizeMode="cover" source={{ uri: media.url }} style={styles.approvedImage} />
            <View style={styles.privateBadge}><Text style={styles.privateBadgeText}>Riêng tư</Text></View>
          </Pressable>
        )) : (
          <Pressable
            accessibilityRole="button"
            disabled={pending || requestMutation.isPending}
            onPress={() => void handleRequest()}
            style={({ pressed }) => [styles.privateTile, pressed && styles.pressed]}
            testID="luxy-private-photo-request"
          >
            {accessQuery.isLoading ? <ActivityIndicator color={luxyColors.ink} /> : <Text style={styles.privateEye}>◉̸</Text>}
            <Text style={styles.privateTileTitle}>Ảnh riêng tư ({state?.private_photo_count ?? privatePhotoCount})</Text>
            <Text style={styles.privateTileButton}>{requestMutation.isPending ? 'Đang gửi…' : requestLabel}</Text>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{getReadablePrivatePhotoError(error)}</Text> : null}
          </Pressable>
        )}
        <LuxyUpgradeGateModal
          busy={upgradeBusy}
          onClose={() => setShowUpgrade(false)}
          onUpgrade={() => void handleUpgrade()}
          reason="private_photo"
          visible={showUpgrade}
        />
      </>
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        disabled={approved || pending || requestMutation.isPending}
        onPress={() => void handleRequest()}
        style={({ pressed }) => [styles.privateRequestButton, pressed && styles.pressed]}
        testID="luxy-private-photo-request-button"
      >
        <Text style={styles.privateRequestText}>
          {approved ? '✓ Đã được xem ảnh riêng tư' : requestMutation.isPending ? 'Đang gửi yêu cầu…' : `${requestLabel} (${state?.private_photo_count ?? privatePhotoCount})`}
        </Text>
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.errorInline}>{getReadablePrivatePhotoError(error)}</Text> : null}
      <LuxyUpgradeGateModal
        busy={upgradeBusy}
        onClose={() => setShowUpgrade(false)}
        onUpgrade={() => void handleUpgrade()}
        reason="private_photo"
        visible={showUpgrade}
      />
    </>
  );
}

const styles = StyleSheet.create({
  privateRequestButton: {
    alignItems: 'center',
    borderColor: luxyColors.border,
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 14,
  },
  privateRequestText: { color: luxyColors.text, fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  privateTile: {
    alignItems: 'center',
    backgroundColor: luxyColors.elevatedSubtle,
    borderColor: luxyColors.border,
    borderRadius: luxyRadii.sm,
    borderWidth: 1,
    gap: 7,
    justifyContent: 'center',
    minHeight: 260,
    padding: 16,
    width: '31.5%',
  },
  privateEye: { color: luxyColors.muted, fontSize: 30 },
  privateTileTitle: { color: luxyColors.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  privateTileButton: { color: luxyColors.actionRed, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  approvedTile: { backgroundColor: luxyColors.ink, borderRadius: luxyRadii.sm, minHeight: 260, overflow: 'hidden', position: 'relative', width: '31.5%' },
  approvedImage: { height: '100%', minHeight: 260, width: '100%' },
  privateBadge: { backgroundColor: 'rgba(8,23,38,0.76)', borderRadius: luxyRadii.pill, left: 9, paddingHorizontal: 9, paddingVertical: 5, position: 'absolute', top: 9 },
  privateBadgeText: { color: luxyColors.surface, fontSize: 10.5, fontWeight: '700' },
  error: { color: luxyColors.danger, fontSize: 10.5, lineHeight: 14, textAlign: 'center' },
  errorInline: { color: luxyColors.danger, fontSize: 11, lineHeight: 15, marginTop: 5 },
  pressed: { opacity: 0.76 },
});
