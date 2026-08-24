import {
  getLuxyMemberProfile,
  recordProfileViewByUsername,
} from '@myfan/supabase';
import { luxyBreakpoints, luxyColors, luxyRadii, luxyShadows } from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { Slot, useLocalSearchParams, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ChonBrandIcon } from '@/components/chon-brand-icon';
import { CHON_ICON_SIZE_DESKTOP } from '@/components/chon-ui-sizing';
import { LuxyDesktopFooter } from '@/components/luxy-desktop-footer';
import { LuxyDesktopNavigation } from '@/components/luxy-desktop-navigation';
import { LuxyGiftModal } from '@/components/luxy-gift-modal';
import { MemberProfileVerificationBadges } from '@/components/member-profile-verification-badges';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { useAuth } from '@/providers/auth-provider';

function normalizeIdentifier(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function MemberProfileRouteLayout() {
  const auth = useAuth();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  const identifier = normalizeIdentifier(params.username).trim();
  const recordedKey = useRef<string | null>(null);
  const client = getMobileSupabaseClient();
  const [giftOpen, setGiftOpen] = useState(false);
  const { width } = useWindowDimensions();
  const desktop = width >= luxyBreakpoints.desktop;
  const isEditor = pathname === '/profile/edit';

  const profileQuery = useQuery({
    queryKey: ['luxy-member-profile', auth.userId, identifier],
    enabled: Boolean(!isEditor && client && auth.userId && identifier),
    staleTime: 30_000,
    queryFn: async () => {
      if (!client) throw new Error('supabase_not_configured');
      return getLuxyMemberProfile(client, identifier);
    },
  });

  const profile = profileQuery.data;

  useEffect(() => {
    if (isEditor || !auth.userId || !client || !profile?.id || !profile.username) return;
    const key = `${auth.userId}:${profile.id}`;
    if (recordedKey.current === key) return;
    recordedKey.current = key;

    void recordProfileViewByUsername(client, profile.username).catch((error) => {
      logger.error('Unable to record Chọn.love profile view', error);
    });
  }, [auth.userId, client, isEditor, profile?.id, profile?.username]);

  if (isEditor || !auth.userId) return <Slot />;

  const recipientName = profile?.display_name || profile?.username || 'thành viên này';
  const canOfferGift = Boolean(profile && profile.id !== auth.userId && !profile.blocked_by_viewer);

  return (
    <View style={styles.root}>
      {desktop ? <LuxyDesktopNavigation /> : null}
      <View style={styles.profileStage}>
        <Slot />
        <MemberProfileVerificationBadges />
        {desktop && canOfferGift && profile ? (
          <Pressable
            accessibilityLabel={`Tặng quà cho ${recipientName}`}
            accessibilityRole="button"
            onPress={() => setGiftOpen(true)}
            style={({ pressed }) => [styles.giftButton, pressed && styles.pressed]}
            testID="luxy-profile-desktop-gift-button"
          >
            <ChonBrandIcon name="gift" size={CHON_ICON_SIZE_DESKTOP} />
            <Text style={styles.giftText}>Tặng quà</Text>
          </Pressable>
        ) : null}
        {desktop && profile ? (
          <LuxyGiftModal
            onClose={() => setGiftOpen(false)}
            recipientId={profile.id}
            recipientName={recipientName}
            visible={giftOpen}
          />
        ) : null}
      </View>
      {desktop ? <LuxyDesktopFooter /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  profileStage: { flex: 1, minHeight: 0, position: 'relative' },
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
  giftText: { color: luxyColors.ink, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
