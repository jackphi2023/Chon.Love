import { getLuxyMemberProfile, recordProfileViewByUsername } from '@myfan/supabase';
import { luxyColors, luxyRadii, luxyShadows } from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { Slot, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LuxyGiftModal } from '@/components/luxy-gift-modal';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { useAuth } from '@/providers/auth-provider';

function normalizeUsername(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function PublicProfileRouteLayout() {
  const auth = useAuth();
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  const username = normalizeUsername(params.username).trim();
  const recordedKey = useRef<string | null>(null);
  const client = getMobileSupabaseClient();
  const [giftOpen, setGiftOpen] = useState(false);

  useEffect(() => {
    if (!auth.userId || !username) return;
    const key = `${auth.userId}:${username.toLowerCase()}`;
    if (recordedKey.current === key) return;
    recordedKey.current = key;

    if (!client) return;
    void recordProfileViewByUsername(client, username).catch((error) => {
      // Profile rendering must not fail because the non-critical view signal could not be recorded.
      logger.error('Unable to record Luxy profile view', error);
    });
  }, [auth.userId, client, username]);

  const profileQuery = useQuery({
    queryKey: ['luxy-member-profile', auth.userId, username],
    enabled: Boolean(client && auth.userId && username),
    staleTime: 30_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getLuxyMemberProfile(client, username);
    },
  });

  const profile = profileQuery.data;
  const recipientName = profile?.display_name || profile?.username || 'thành viên này';
  const canOfferGift = Boolean(
    profile && auth.userId && profile.id !== auth.userId && !profile.blocked_by_viewer,
  );

  return (
    <View style={styles.root}>
      <Slot />
      {canOfferGift && profile ? (
        <Pressable
          accessibilityLabel={`Tặng quà cho ${recipientName}`}
          accessibilityRole="button"
          onPress={() => setGiftOpen(true)}
          style={({ pressed }) => [styles.giftButton, pressed && styles.pressed]}
          testID="luxy-profile-gift-button"
        >
          <Text style={styles.giftIcon}>🎁</Text>
          <Text style={styles.giftText}>Tặng quà</Text>
        </Pressable>
      ) : null}
      {profile ? (
        <LuxyGiftModal
          onClose={() => setGiftOpen(false)}
          recipientId={profile.id}
          recipientName={recipientName}
          visible={giftOpen}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  giftButton: {
    alignItems: 'center',
    backgroundColor: luxyColors.surface,
    borderColor: luxyColors.borderStrong,
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    bottom: 22,
    flexDirection: 'row',
    gap: 7,
    minHeight: 46,
    paddingHorizontal: 16,
    position: 'absolute',
    right: 18,
    zIndex: 40,
    ...luxyShadows.card,
  },
  giftIcon: { fontSize: 18 },
  giftText: { color: luxyColors.ink, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
