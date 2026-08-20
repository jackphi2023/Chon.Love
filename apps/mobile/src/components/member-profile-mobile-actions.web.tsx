import {
  getLuxyMemberProfile,
  getLuxyProfileConversation,
  getMyLuxyMembershipSnapshot,
} from '@myfan/supabase';
import { luxyBreakpoints, luxyColors, luxyLayout, luxyRadii, luxyShadows, luxySpacing } from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { ChonBrandIcon } from '@/components/chon-brand-icon';
import { CHON_ICON_SIZE_MOBILE } from '@/components/chon-ui-sizing';
import { LuxyGiftModal } from '@/components/luxy-gift-modal';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const fixedTopStyle = {
  left: 0,
  position: 'fixed',
  right: 0,
  top: 0,
} as unknown as ViewStyle;

const fixedBottomStyle = {
  bottom: 0,
  left: 0,
  position: 'fixed',
  right: 0,
} as unknown as ViewStyle;

const safeAreaPromptStyle = {
  boxSizing: 'border-box',
  height: `calc(${luxyLayout.authenticatedPromoHeight}px + env(safe-area-inset-top))`,
  paddingTop: 'env(safe-area-inset-top)',
} as unknown as ViewStyle;

const safeAreaDockStyle = {
  boxSizing: 'border-box',
  paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
} as unknown as ViewStyle;

function getProfileIdentifier(pathname: string): string | null {
  const match = pathname.match(/^\/(?:profile|thanh-vien)\/([^/?#]+)$/u);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function MemberProfileMobileActions() {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const { width } = useWindowDimensions();
  const identifier = getProfileIdentifier(pathname);
  const mobileWeb = width < luxyBreakpoints.desktop;
  const enabled = Boolean(mobileWeb && identifier && auth.userId && client);
  const [giftOpen, setGiftOpen] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ['luxy-member-profile', auth.userId, identifier],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      if (!client || !identifier) throw new Error('profile_not_available');
      return getLuxyMemberProfile(client, identifier);
    },
  });

  const membershipQuery = useQuery({
    queryKey: ['luxy-membership', auth.userId],
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!client) throw new Error('supabase_unavailable');
      return getMyLuxyMembershipSnapshot(client);
    },
  });

  const profile = profileQuery.data;
  const membership = membershipQuery.data;
  const isFreeMembership = membership?.tier === 'free';
  const displayName = profile?.display_name || profile?.username || 'thành viên này';
  const actionsVisible = Boolean(enabled && profile && !profile.blocked_by_viewer);

  useEffect(() => {
    setGiftOpen(false);
    setActionError(null);
  }, [pathname]);

  useEffect(() => {
    if (!mobileWeb || !identifier || typeof document === 'undefined') return undefined;
    const element = document.createElement('style');
    element.dataset.chonLoveProfileMobileActions = 'true';
    element.textContent = `
      @media (max-width: ${luxyBreakpoints.desktop - 1}px) {
        [data-testid="luxy-member-profile-message-composer"] { display: none !important; }
        [data-testid="luxy-member-profile-page"] {
          box-sizing: border-box !important;
          padding-bottom: ${actionsVisible ? 'calc(84px + env(safe-area-inset-bottom))' : '0px'} !important;
          padding-top: ${isFreeMembership ? `calc(${luxyLayout.authenticatedPromoHeight}px + env(safe-area-inset-top))` : '0px'} !important;
        }
      }
    `;
    document.head.appendChild(element);
    return () => element.remove();
  }, [actionsVisible, identifier, isFreeMembership, mobileWeb]);

  if (!actionsVisible || !profile) return null;

  const openMembership = () => router.push('/settings/membership');

  const openConversation = async () => {
    setActionError(null);
    if (!membership?.can_message) {
      openMembership();
      return;
    }
    if (!client) return;
    setMessageBusy(true);
    try {
      const conversationId = await getLuxyProfileConversation(client, profile.id);
      if (!conversationId) throw new Error('conversation_not_available');
      router.push({ pathname: '/chat/[conversationId]', params: { conversationId } });
    } catch {
      setActionError('Không thể mở tin nhắn lúc này. Vui lòng thử lại.');
    } finally {
      setMessageBusy(false);
    }
  };

  return (
    <>
      {isFreeMembership ? (
        <Pressable
          accessibilityLabel="Nâng cấp ngay để gửi tin nhắn"
          accessibilityRole="button"
          onPress={openMembership}
          style={({ pressed }) => [styles.upgradePrompt, fixedTopStyle, safeAreaPromptStyle, pressed && styles.pressed]}
          testID="luxy-profile-free-upgrade-promo"
        >
          <Text style={styles.upgradePromptText}>
            <Text style={styles.upgradePromptStrong}>Nâng cấp ngay</Text> để gửi tin nhắn
          </Text>
        </Pressable>
      ) : null}

      <View style={[styles.actionDock, fixedBottomStyle, safeAreaDockStyle]} testID="luxy-profile-mobile-action-dock">
        {actionError ? <Text accessibilityRole="alert" style={styles.actionError}>{actionError}</Text> : null}
        <View style={styles.actionRow}>
          <Pressable
            accessibilityLabel={`Tặng quà cho ${displayName}`}
            accessibilityRole="button"
            onPress={() => setGiftOpen(true)}
            style={({ pressed }) => [styles.giftButton, pressed && styles.pressed]}
            testID="luxy-profile-gift-button"
          >
            <ChonBrandIcon name="gift" size={CHON_ICON_SIZE_MOBILE} />
            <Text style={styles.giftButtonText}>Tặng quà</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={`Gửi tin nhắn cho ${displayName}`}
            accessibilityRole="button"
            disabled={messageBusy}
            onPress={() => void openConversation()}
            style={({ pressed }) => [styles.messageButton, pressed && styles.pressed, messageBusy && styles.disabled]}
            testID="luxy-profile-fixed-message-button"
          >
            <ChonBrandIcon name="message" size={CHON_ICON_SIZE_MOBILE} />
            <Text style={styles.messageButtonText}>{messageBusy ? 'Đang mở…' : 'Gửi tin nhắn'}</Text>
          </Pressable>
        </View>
      </View>

      <LuxyGiftModal
        onClose={() => setGiftOpen(false)}
        recipientId={profile.id}
        recipientName={displayName}
        visible={giftOpen}
      />
    </>
  );
}

const styles = StyleSheet.create({
  upgradePrompt: {
    alignItems: 'center',
    backgroundColor: '#090909',
    height: luxyLayout.authenticatedPromoHeight,
    justifyContent: 'center',
    minHeight: luxyLayout.authenticatedPromoHeight,
    paddingHorizontal: luxySpacing.lg,
    zIndex: 980,
  },
  upgradePromptText: { color: luxyColors.surface, fontSize: 14, lineHeight: 18 },
  upgradePromptStrong: { fontWeight: '800', textDecorationLine: 'underline' },
  actionDock: {
    backgroundColor: luxyColors.surface,
    borderTopColor: luxyColors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 10,
    paddingHorizontal: 10,
    paddingTop: 9,
    zIndex: 970,
    ...luxyShadows.navigation,
  },
  actionRow: {
    alignItems: 'stretch',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    maxWidth: 620,
    width: '100%',
  },
  giftButton: {
    alignItems: 'center',
    backgroundColor: luxyColors.surface,
    borderColor: luxyColors.actionRed,
    borderRadius: luxyRadii.sm,
    borderWidth: 1,
    flex: 0.42,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 50,
    minWidth: 0,
    paddingHorizontal: 10,
  },
  giftButtonText: { color: luxyColors.actionRed, fontSize: 13, fontWeight: '700' },
  messageButton: {
    alignItems: 'center',
    backgroundColor: luxyColors.actionRed,
    borderRadius: luxyRadii.sm,
    flex: 0.58,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 50,
    minWidth: 0,
    paddingHorizontal: 10,
  },
  messageButtonText: { color: luxyColors.surface, fontSize: 14, fontWeight: '800' },
  actionError: { color: luxyColors.danger, fontSize: 11, marginBottom: 7, textAlign: 'center' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.76 },
});