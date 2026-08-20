import { getMyLuxyMembershipSnapshot, listLuxyInterests, listLuxyMailbox } from '@myfan/supabase';
import {
  luxyColors,
  luxyLayout,
  luxyRadii,
  luxyShadows,
  luxySpacing,
} from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChonBrandIcon, ChonUserAvatar } from '@/components/chon-brand-icon';
import { ChonLoveLogo } from '@/components/chon-love-logo';
import { CHON_ICON_SIZE_DESKTOP } from '@/components/chon-ui-sizing';
import { logger } from '@/lib/logger';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const CHON_GOLD = '#FFBB00';

const primaryItems = [
  { key: 'search', label: 'Kết nối', icon: 'connect' as const, href: '/(tabs)' as const },
  { key: 'favorites', label: 'Yêu thích', icon: 'favorite' as const, href: '/(tabs)/favorites' as const },
  { key: 'messages', label: 'Tin nhắn', icon: 'message' as const, href: '/(tabs)/messages' as const },
  { key: 'upgrade', label: 'Nâng cấp', symbol: '✦', href: '/settings/membership' as const },
] as const;

const accountItems = [
  { label: 'Hồ sơ', href: '/(tabs)/profile' as const },
  { label: 'Quà', href: '/(tabs)/gifts' as const },
  { label: 'Số dư', href: '/(tabs)/balance' as const },
  { label: 'Cài đặt', href: '/settings' as const },
] as const;

type PrimaryItem = (typeof primaryItems)[number];

function isPrimaryActive(key: PrimaryItem['key'], pathname: string): boolean {
  if (key === 'search') return pathname === '/' || pathname === '/index';
  if (key === 'favorites') return pathname.startsWith('/favorites');
  if (key === 'messages') return pathname.startsWith('/messages') || pathname.startsWith('/chat');
  if (key === 'upgrade') return pathname.startsWith('/settings/membership');
  return false;
}

function isAccountRoute(pathname: string): boolean {
  if (pathname.startsWith('/settings/membership')) return false;
  return ['/profile', '/gifts', '/balance', '/settings'].some((route) => pathname.startsWith(route));
}

export function LuxyDesktopNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const [accountOpen, setAccountOpen] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const membershipQuery = useQuery({
    queryKey: ['luxy-membership', auth.userId],
    enabled: Boolean(client && auth.userId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!client) throw new Error('supabase_unavailable');
      return getMyLuxyMembershipSnapshot(client);
    },
  });

  const interestsBadgeQuery = useQuery({
    queryKey: ['luxy-nav-interests', auth.userId, 'favorited_me'],
    enabled: Boolean(client && auth.userId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!client) return 0;
      return (await listLuxyInterests(client, 'favorited_me', { limit: 40, offset: 0 })).length;
    },
  });

  const messagesBadgeQuery = useQuery({
    queryKey: ['luxy-nav-messages', auth.userId],
    enabled: Boolean(client && auth.userId),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!client) return 0;
      const rows = await listLuxyMailbox(client, { limit: 50, offset: 0 });
      return rows
        .filter((row) => !row.is_archived && !row.blocked)
        .reduce((sum, row) => sum + row.unread_count, 0);
    },
  });

  const badgeFor = (key: PrimaryItem['key']) => {
    if (key === 'favorites') return interestsBadgeQuery.data ?? 0;
    if (key === 'messages') return messagesBadgeQuery.data ?? 0;
    return 0;
  };

  const navigateProtected = (href: PrimaryItem['href']) => {
    setAccountOpen(false);
    if (!auth.userId) {
      router.push('/(auth)');
      return;
    }
    router.push(href);
  };

  const navigateHome = () => {
    setAccountOpen(false);
    if (!auth.userId) {
      router.push('/(auth)');
      return;
    }
    router.replace('/(tabs)');
  };

  const handleLogout = async () => {
    setAccountOpen(false);
    try {
      await auth.signOut();
      router.replace('/');
    } catch (error) {
      logger.error('Unable to sign out from Chon.Love navigation', error, { feature: 'navigation_sign_out' });
    }
  };

  const isFreeMembership = membershipQuery.data?.tier === 'free';

  return (
    <View style={styles.shell} testID="chon-desktop-navigation">
      {auth.userId && isFreeMembership ? (
        <Pressable
          accessibilityLabel="Nâng cấp ngay để gửi tin nhắn"
          accessibilityRole="button"
          onPress={() => router.push('/settings/membership')}
          style={({ pressed }) => [styles.promo, pressed && styles.promoPressed]}
          testID="luxy-free-upgrade-promo"
        >
          <Text style={styles.promoText}><Text style={styles.promoStrong}>Nâng cấp ngay</Text> để gửi tin nhắn</Text>
        </Pressable>
      ) : null}
      <View style={styles.navRow}>
        <View style={styles.inner}>
          <Pressable
            accessibilityLabel="Chon.Love — về Kết nối"
            accessibilityRole="button"
            onPress={navigateHome}
            style={({ pressed }) => [styles.brandButton, pressed && styles.pressed]}
          >
            <ChonLoveLogo height={58} width={174} />
          </Pressable>

          <View style={styles.primaryNav}>
            {primaryItems.map((item) => {
              const active = isPrimaryActive(item.key, pathname);
              const hovered = hoveredKey === item.key;
              const badge = badgeFor(item.key);
              const upgrade = item.key === 'upgrade';
              return (
                <Pressable
                  accessibilityLabel={item.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={item.key}
                  onPointerEnter={() => setHoveredKey(item.key)}
                  onPointerLeave={() => setHoveredKey(null)}
                  onPress={() => navigateProtected(item.href)}
                  style={({ pressed }) => [
                    styles.navItem,
                    active && styles.navItemActive,
                    hovered && styles.navItemHover,
                    upgrade && styles.upgradeItem,
                    upgrade && hovered && styles.upgradeItemHover,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.iconWrap}>
                    {'icon' in item ? (
                      <ChonBrandIcon name={item.icon} size={CHON_ICON_SIZE_DESKTOP} />
                    ) : (
                      <Text accessibilityElementsHidden style={[styles.navIcon, styles.upgradeIcon]}>{item.symbol}</Text>
                    )}
                    {badge > 0 ? (
                      <View accessibilityElementsHidden style={styles.badge}>
                        <Text accessibilityElementsHidden style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text numberOfLines={1} style={[styles.navLabel, active && styles.navLabelActive, upgrade && styles.upgradeLabel]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {auth.userId ? (
            <View style={styles.accountWrap}>
              <Pressable
                accessibilityLabel="Mở menu hồ sơ"
                accessibilityRole="button"
                accessibilityState={{ expanded: accountOpen, selected: isAccountRoute(pathname) }}
                onPointerEnter={() => setHoveredKey('account')}
                onPointerLeave={() => setHoveredKey(null)}
                onPress={() => setAccountOpen((value) => !value)}
                style={({ pressed }) => [
                  styles.accountButton,
                  isAccountRoute(pathname) && styles.accountButtonActive,
                  hoveredKey === 'account' && styles.accountButtonHover,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.accountAvatar}><ChonUserAvatar size={34} /></View>
                <Text style={styles.accountLabel}>Tài khoản</Text>
              </Pressable>

              {accountOpen ? (
                <View accessibilityRole="menu" style={styles.accountMenu}>
                  {accountItems.map((item) => {
                    const menuKey = `account:${item.label}`;
                    return (
                      <Pressable
                        accessibilityRole="menuitem"
                        key={item.label}
                        onPointerEnter={() => setHoveredKey(menuKey)}
                        onPointerLeave={() => setHoveredKey(null)}
                        onPress={() => {
                          setAccountOpen(false);
                          router.push(item.href);
                        }}
                        style={({ pressed }) => [
                          styles.menuItem,
                          hoveredKey === menuKey && styles.menuItemHover,
                          pressed && styles.menuItemPressed,
                        ]}
                      >
                        <Text style={styles.menuLabel}>{item.label}</Text>
                      </Pressable>
                    );
                  })}
                  <View style={styles.menuDivider} />
                  <Pressable
                    accessibilityRole="menuitem"
                    onPointerEnter={() => setHoveredKey('logout')}
                    onPointerLeave={() => setHoveredKey(null)}
                    onPress={() => void handleLogout()}
                    style={({ pressed }) => [
                      styles.menuItem,
                      hoveredKey === 'logout' && styles.menuItemHover,
                      pressed && styles.menuItemPressed,
                    ]}
                    testID="chon-navigation-logout"
                  >
                    <Text style={styles.menuLabel}>Đăng xuất</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPointerEnter={() => setHoveredKey('login')}
              onPointerLeave={() => setHoveredKey(null)}
              onPress={() => router.push('/(auth)')}
              style={({ pressed }) => [styles.loginButton, hoveredKey === 'login' && styles.loginButtonHover, pressed && styles.pressed]}
            >
              <Text style={styles.loginText}>Đăng nhập</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { backgroundColor: luxyColors.surface, position: 'relative', zIndex: 120 },
  promo: {
    alignItems: 'center',
    backgroundColor: '#090909',
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: luxySpacing.lg,
  },
  promoPressed: { backgroundColor: '#1A1A1A' },
  promoText: { color: luxyColors.surface, fontSize: 12.5, lineHeight: 17 },
  promoStrong: { fontWeight: '800', textDecorationLine: 'underline' },
  navRow: {
    alignItems: 'stretch',
    backgroundColor: luxyColors.surface,
    height: 72,
    position: 'relative',
    ...luxyShadows.navigation,
  },
  inner: {
    alignSelf: 'center',
    flex: 1,
    flexDirection: 'row',
    maxWidth: luxyLayout.contentMaxWidth,
    paddingHorizontal: luxyLayout.contentHorizontalPaddingDesktop,
    position: 'relative',
    width: '100%',
  },
  brandButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    minWidth: 196,
    paddingHorizontal: 10,
  },
  primaryNav: { alignItems: 'stretch', flex: 1, flexDirection: 'row', justifyContent: 'center' },
  navItem: {
    alignItems: 'center',
    borderBottomColor: 'transparent',
    borderBottomWidth: 3,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minWidth: 118,
    paddingHorizontal: 14,
  },
  navItemActive: { backgroundColor: luxyColors.brandRedSurface, borderBottomColor: luxyColors.actionRed },
  navItemHover: {
    backgroundColor: 'rgba(255,187,0,0.10)',
    shadowColor: '#000000',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 2,
  },
  iconWrap: { alignItems: 'center', justifyContent: 'center', minHeight: CHON_ICON_SIZE_DESKTOP, minWidth: CHON_ICON_SIZE_DESKTOP, position: 'relative' },
  navIcon: { color: CHON_GOLD, fontSize: 20, fontWeight: '700', lineHeight: 22, textAlign: 'center' },
  navLabel: { color: luxyColors.charcoal, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  navLabelActive: { color: luxyColors.actionRed, fontWeight: '700' },
  badge: {
    alignItems: 'center',
    backgroundColor: luxyColors.actionRed,
    borderColor: luxyColors.surface,
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 16,
    minWidth: 16,
    paddingHorizontal: 3,
    position: 'absolute',
    right: -8,
    top: -5,
  },
  badgeText: { color: luxyColors.surface, fontSize: 9, fontWeight: '800' },
  upgradeItem: {
    alignSelf: 'center',
    backgroundColor: luxyColors.actionRed,
    borderBottomWidth: 0,
    borderRadius: luxyRadii.pill,
    marginHorizontal: 10,
    minHeight: 42,
    minWidth: 126,
  },
  upgradeItemHover: {
    backgroundColor: '#E24A47',
    shadowColor: '#C81C1D',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 3,
  },
  upgradeIcon: { color: CHON_GOLD },
  upgradeLabel: { color: luxyColors.surface, fontWeight: '700' },
  accountWrap: { justifyContent: 'center', minWidth: 162, position: 'relative' },
  accountButton: {
    alignItems: 'center',
    borderRadius: luxyRadii.pill,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  accountButtonActive: { backgroundColor: luxyColors.subtleSurface },
  accountButtonHover: {
    backgroundColor: 'rgba(255,187,0,0.10)',
    shadowColor: '#000000',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 2,
  },
  accountAvatar: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  accountLabel: { color: luxyColors.charcoal, fontSize: 14, fontWeight: '600' },
  accountMenu: {
    backgroundColor: luxyColors.surface,
    borderColor: luxyColors.border,
    borderRadius: luxyRadii.md,
    borderWidth: 1,
    minWidth: 220,
    paddingVertical: luxySpacing.sm,
    position: 'absolute',
    right: 0,
    top: 61,
    zIndex: 160,
    ...luxyShadows.navigation,
  },
  menuItem: { alignItems: 'center', minHeight: 44, paddingHorizontal: luxySpacing.lg, justifyContent: 'center' },
  menuItemHover: { backgroundColor: CHON_GOLD },
  menuItemPressed: { backgroundColor: 'rgba(255,187,0,0.82)' },
  menuLabel: { color: luxyColors.charcoal, fontSize: 14, fontWeight: '600' },
  menuDivider: { backgroundColor: luxyColors.border, height: StyleSheet.hairlineWidth, marginVertical: luxySpacing.sm },
  loginButton: {
    alignItems: 'center',
    alignSelf: 'center',
    borderColor: luxyColors.actionRed,
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 118,
    paddingHorizontal: 18,
  },
  loginButtonHover: {
    backgroundColor: luxyColors.brandRedSurface,
    shadowColor: '#C81C1D',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 2,
  },
  loginText: { color: luxyColors.actionRed, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.78 },
});