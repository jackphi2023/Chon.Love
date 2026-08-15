import { getLuxyMemberProfile, getLuxyMemberVerificationBadges } from '@myfan/supabase';
import { luxyColors, luxyRadii, luxyShadows, luxySpacing } from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type VerificationKey = 'selfie' | 'identity' | 'linkedin';

const verificationMeta: Record<VerificationKey, { icon: string; label: string }> = {
  selfie: { icon: '◎', label: 'Ảnh chụp cá nhân' },
  identity: { icon: '▭', label: 'CCCD' },
  linkedin: { icon: 'in', label: 'LinkedIn' },
};

function getProfileUsername(pathname: string): string | null {
  const match = pathname.match(/^\/profile\/([^/?#]+)$/u);
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
  const username = getProfileUsername(pathname);
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [hovered, setHovered] = useState<VerificationKey | null>(null);

  const profileQuery = useQuery({
    queryKey: ['luxy-member-profile', auth.userId, username],
    enabled: Boolean(client && auth.userId && username),
    staleTime: 30_000,
    queryFn: async () => {
      if (!client || !username) throw new Error('profile_not_available');
      return getLuxyMemberProfile(client, username);
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
    if (!username || typeof document === 'undefined') {
      setPortalTarget(null);
      return undefined;
    }

    let observer: MutationObserver | null = null;
    let mounted = true;

    const attach = () => {
      const hero = document.querySelector('[data-testid="luxy-member-profile-hero-photo"]');
      if (!hero?.parentElement) return false;

      let target = hero.parentElement.querySelector<HTMLElement>('[data-chon-love-verification-badges="true"]');
      if (!target) {
        target = document.createElement('div');
        target.dataset.chonLoveVerificationBadges = 'true';
        target.style.width = '100%';
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
      const target = document.querySelector<HTMLElement>('[data-chon-love-verification-badges="true"]');
      target?.remove();
      setPortalTarget(null);
    };
  }, [username]);

  if (!portalTarget || !profileQuery.data) return null;

  const states: Record<VerificationKey, boolean> = {
    selfie: badgesQuery.data?.selfie_verified ?? false,
    identity: badgesQuery.data?.identity_verified ?? false,
    linkedin: badgesQuery.data?.linkedin_verified ?? false,
  };

  return createPortal(
    <View style={styles.row} testID="luxy-member-verification-badges">
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
              style={({ pressed }) => [styles.iconButton, verified ? styles.iconVerified : styles.iconUnverified, pressed && styles.pressed]}
              testID={`luxy-verification-${key}`}
            >
              <Text style={[styles.iconText, verified ? styles.iconTextVerified : styles.iconTextUnverified]}>
                {verificationMeta[key].icon}
              </Text>
            </Pressable>
            <Text numberOfLines={1} style={[styles.label, verified && styles.labelVerified]}>{verificationMeta[key].label}</Text>
            {hovered === key ? (
              <View pointerEvents="none" style={styles.tooltip}>
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
    backgroundColor: luxyColors.surface,
    borderBottomColor: luxyColors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: luxySpacing.sm,
    paddingVertical: 12,
    width: '100%',
  },
  itemWrap: { alignItems: 'center', minWidth: 72, position: 'relative' },
  iconButton: {
    alignItems: 'center',
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  iconVerified: { backgroundColor: '#0B3B67', borderColor: '#0B3B67' },
  iconUnverified: { backgroundColor: '#F3F4F6', borderColor: '#9CA3AF' },
  iconText: { fontSize: 16, fontWeight: '800', lineHeight: 18 },
  iconTextVerified: { color: luxyColors.surface },
  iconTextUnverified: { color: '#7B818B' },
  label: { color: '#7B818B', fontSize: 9.5, marginTop: 5, textAlign: 'center' },
  labelVerified: { color: '#0B3B67', fontWeight: '700' },
  tooltip: {
    backgroundColor: '#081726',
    borderRadius: luxyRadii.sm,
    bottom: -42,
    minWidth: 190,
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: 'absolute',
    zIndex: 50,
    ...luxyShadows.navigation,
  },
  tooltipText: { color: luxyColors.surface, fontSize: 11, lineHeight: 15, textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
