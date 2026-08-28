import {
  getLuxyMemberProfile,
  getLuxyProfileConversation,
  getMyLuxyMembershipSnapshot,
} from '@myfan/supabase';
import { chonBreakpoints, chonColors, chonShadows, chonTypography } from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { ChonBrandIcon } from '@/components/chon-brand-icon';
import { ChonGiftModal } from '@/components/chon-gift-modal';
import { CHON_ICON_SIZE_MOBILE } from '@/components/chon-ui-sizing';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const fixedBottomStyle = {
  bottom: 0,
  left: 0,
  position: 'fixed',
  right: 0,
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

/**
 * Mobile web owns the fixed profile action dock while ChonMemberProfileScreen owns
 * the desktop/in-flow actions. Both use the shared ChonGiftModal and the same server
 * transaction contract; CSS below keeps only one visible action surface per viewport.
 */
export function MemberProfileMobileActions() {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const { width } = useWindowDimensions();
  const identifier = getProfileIdentifier(pathname);
  const mobileWeb = width < chonBreakpoints.desktop;
  const enabled = Boolean(mobileWeb && identifier && auth.userId && client);
  const [messageBusy, setMessageBusy] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
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
  const displayName = profile?.display_name || profile?.username || 'thành viên này';
  const actionsVisible = Boolean(enabled && profile && !profile.blocked_by_viewer);

  useEffect(() => {
    setActionError(null);
    setGiftOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileWeb || !identifier || typeof document === 'undefined') return undefined;
    const element = document.createElement('style');
    element.dataset.chonLoveProfileMobileActions = 'true';
    element.textContent = `
      @media (max-width: ${chonBreakpoints.desktop - 1}px) {
        [data-testid="chon-member-profile-message-composer"],
        [data-testid="chon-member-profile-gift-button"] { display: none !important; }
        [data-testid="chon-member-profile-page"] {
          box-sizing: border-box !important;
          padding-bottom: ${actionsVisible ? 'calc(84px + env(safe-area-inset-bottom))' : '0px'} !important;
        }
      }
    `;
    document.head.appendChild(element);
    return () => element.remove();
  }, [actionsVisible, identifier, mobileWeb]);

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
      <View style={[styles.actionDock, fixedBottomStyle, safeAreaDockStyle]} testID="chon-profile-mobile-action-dock">
        {actionError ? <Text accessibilityRole="alert" style={styles.actionError}>{actionError}</Text> : null}
        <View style={styles.actionRow}>
          <Pressable
            accessibilityLabel={`Tặng quà cho ${displayName}`}
            accessibilityRole="button"
            onPress={() => setGiftOpen(true)}
            style={({ pressed }) => [styles.giftButton, pressed && styles.pressed]}
            testID="chon-profile-fixed-gift-button"
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
            testID="chon-profile-fixed-message-button"
          >
            <ChonBrandIcon name="message" size={CHON_ICON_SIZE_MOBILE} />
            <Text style={styles.messageButtonText}>{messageBusy ? 'Đang mở…' : 'Gửi tin nhắn'}</Text>
          </Pressable>
        </View>
      </View>
      <ChonGiftModal
        onClose={() => setGiftOpen(false)}
        recipientId={profile.id}
        recipientName={displayName}
        visible={giftOpen}
      />
    </>
  );
}

const styles = StyleSheet.create({
  actionDock: {
    alignItems: 'center',
    backgroundColor: chonColors.surface,
    borderTopColor: chonColors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 10,
    paddingHorizontal: 10,
    paddingTop: 9,
    zIndex: 970,
    ...chonShadows.card,
  },
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    maxWidth: 620,
    width: '100%',
  },
  giftButton: {
    alignItems: 'center',
    backgroundColor: chonColors.surface,
    borderColor: chonColors.gold,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  giftButtonText: { color: chonColors.goldStrong, fontSize: chonTypography.sizes.body, fontWeight: '800' },
  messageButton: {
    alignItems: 'center',
    backgroundColor: chonColors.primaryRed,
    borderRadius: 999,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 18,
  },
  messageButtonText: { color: '#FFFFFF', fontSize: chonTypography.sizes.body, fontWeight: '800' },
  actionError: { color: chonColors.danger, fontSize: chonTypography.sizes.help, marginBottom: 7, textAlign: 'center' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.76 },
});
