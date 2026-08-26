import { getLuxyMemberProfile, getLuxyMemberVerificationBadges } from '@myfan/supabase';
import { chonBreakpoints, chonColors, chonShadows, chonTypography } from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ChonVerificationIcon } from '@/components/chon-verification-icon';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type VerificationKey = 'selfie' | 'identity' | 'linkedin';

const verificationMeta: Record<VerificationKey, { label: string }> = {
  selfie: { label: 'Ảnh chụp cá nhân' },
  identity: { label: 'CCCD' },
  linkedin: { label: 'LinkedIn' },
};

let activePortalOwner: symbol | null = null;

function getProfileIdentifier(pathname: string): string | null {
  const match = pathname.match(/^\/(?:profile|thanh-vien)\/([^/?#]+)$/u);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function tooltipText(key: VerificationKey, verified: boolean): string {
  if (key === 'selfie') return `${verified ? 'Đã' : 'Chưa'} xác thực ảnh chụp cá nhân`;
  if (key === 'identity') return `${verified ? 'Đã' : 'Chưa'} xác thực CCCD`;
  return `${verified ? 'Đã' : 'Chưa'} xác thực LinkedIn`;
}

export function MemberProfileVerificationBadges() {
  const pathname = usePathname();
  const identifier = getProfileIdentifier(pathname);
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const { width: viewportWidth } = useWindowDimensions();
  const ownerRef = useRef<symbol>(Symbol('chon-verification-badges'));
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [hovered, setHovered] = useState<VerificationKey | null>(null);
  const verificationIconHeight = viewportWidth >= chonBreakpoints.desktop ? 44 : 38;

  const profileQuery = useQuery({
    queryKey: ['luxy-member-profile', auth.userId, identifier],
    enabled: Boolean(client && auth.userId && identifier),
    staleTime: 30_000,
    queryFn: async () => {
      if (!client || !identifier) throw new Error('profile_not_available');
      return getLuxyMemberProfile(client, identifier);
    },
  });

  const badgesQuery = useQuery({
    queryKey: ['luxy-member-verification-badges', profileQuery.data?.id],
    enabled: Boolean(client && profileQuery.data?.id),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!client || !profileQuery.data?.id) throw new Error('profile_not_available');
      return getLuxyMemberVerificationBadges(client, profileQuery.data.id);
    },
  });

  useEffect(() => {
    setHovered(null);
    if (!identifier || typeof document === 'undefined') {
      setPortalTarget(null);
      return undefined;
    }

    const owner = ownerRef.current;
    if (activePortalOwner && activePortalOwner !== owner) {
      setPortalTarget(null);
      return undefined;
    }
    activePortalOwner = owner;

    let observer: MutationObserver | null = null;
    let mounted = true;

    const attach = () => {
      const hero = document.querySelector('[data-testid="chon-member-profile-hero-photo"]');
      if (!hero?.parentElement) return false;

      let target = hero.parentElement.querySelector<HTMLElement>('[data-chon-love-verification-badges="true"]');
      if (!target) {
        target = document.createElement('div');
        target.dataset.chonLoveVerificationBadges = 'true';
        target.style.width = '100%';
        target.style.maxWidth = '100%';
        target.style.overflow = 'visible';
        hero.insertAdjacentElement('afterend', target);
      }

      if (mounted) setPortalTarget(target);
      return true;
    };

    if (!attach()) {
      observer = new MutationObserver(() => {
        if (attach()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      mounted = false;
      observer?.disconnect();
      if (activePortalOwner === owner) {
        activePortalOwner = null;
        const target = document.querySelector<HTMLElement>('[data-chon-love-verification-badges="true"]');
        target?.remove();
      }
      setPortalTarget(null);
    };
  }, [identifier]);

  if (!portalTarget || !profileQuery.data || !badgesQuery.data) return null;

  const states: Record<VerificationKey, boolean> = {
    selfie: badgesQuery.data.selfie_verified,
    identity: badgesQuery.data.identity_verified,
    linkedin: badgesQuery.data.linkedin_verified,
  };

  return createPortal(
    <View accessibilityLabel="Trạng thái xác thực" style={styles.row} testID="chon-member-verification-badges">
      {(Object.keys(verificationMeta) as VerificationKey[]).map((key) => {
        const verified = states[key];
        const tooltip = tooltipText(key, verified);
        return (
          <View key={key} style={styles.itemWrap}>
            <Pressable
              accessibilityLabel={tooltip}
              accessibilityRole="button"
              onHoverIn={() => setHovered(key)}
              onHoverOut={() => setHovered((current) => (current === key ? null : current))}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              testID={`chon-verification-${key}`}
            >
              <ChonVerificationIcon
                height={verificationIconHeight}
                testID={`chon-verification-icon-${key}-${verified ? 'verified' : 'unverified'}`}
                type={key}
                verified={verified}
              />
            </Pressable>
            <Text numberOfLines={1} style={[styles.label, verified && styles.labelVerified]}>{verificationMeta[key].label}</Text>
            {hovered === key ? (
              <View
                pointerEvents="none"
                style={[
                  styles.tooltip,
                  key === 'selfie' ? styles.tooltipFirst : key === 'linkedin' ? styles.tooltipLast : styles.tooltipMiddle,
                ]}
              >
                <Text style={styles.tooltipText}>{tooltip}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>,
    portalTarget,
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-start',
    backgroundColor: chonColors.surface,
    borderBottomColor: chonColors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
    maxWidth: '100%',
    paddingHorizontal: 4,
    paddingVertical: 10,
    width: '100%',
  },
  itemWrap: { alignItems: 'center', flex: 1, minWidth: 0, position: 'relative' },
  iconButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  label: { color: chonColors.softMuted, fontSize: chonTypography.sizes.help, marginTop: 4, maxWidth: '100%', paddingHorizontal: 2, textAlign: 'center' },
  labelVerified: { color: chonColors.goldStrong, fontWeight: '700' },
  tooltip: {
    backgroundColor: chonColors.ink,
    borderRadius: 8,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: 'absolute',
    top: 58,
    width: 176,
    zIndex: 50,
    ...chonShadows.card,
  },
  tooltipFirst: { left: 0 },
  tooltipMiddle: { left: -54 },
  tooltipLast: { right: 0 },
  tooltipText: { color: chonColors.surface, fontSize: chonTypography.sizes.help, lineHeight: chonTypography.lineHeights.help, textAlign: 'center' },
  pressed: { opacity: 0.72 },
});