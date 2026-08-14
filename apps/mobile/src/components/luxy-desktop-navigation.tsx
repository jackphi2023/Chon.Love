import { listLuxyInterests, listLuxyMailbox } from '@myfan/supabase';
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
import { ChonLoveLogo } from '@/components/chon-love-logo';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const primaryItems = [
  { key: 'search', label: 'Tìm kiếm', symbol: '⌕', href: '/(tabs)' as const },
  { key: 'favorites', label: 'Yêu thích', symbol: '♥', href: '/(tabs)/favorites' as const },
  { key: 'messages', label: 'Tin nhắn', symbol: '✉', href: '/(tabs)/messages' as const },
  { key: 'upgrade', label: 'Nâng cấp', symbol: '✦', href: '/settings/membership' as const },
] as const;

const accountItems = [
  { label: 'Hồ sơ của tôi', href: '/(tabs)/profile' as const },
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

  return (
    <View style={styles.shell} testID="chon-desktop-navigation">
      {auth.userId ? (
        <View style={styles.promo}>
          <Text style={styles.promoHeart}>♥</Text>
          <Text style={styles.promoText}>Kết nối nghiêm túc · <Text style={styles.promoStrong}>Premium & Diamond</Text></Text>
        </View>
      ) : null}
      <View style={styles.navRow}>
        <View style={styles.inner}>
          <Pressable
            accessibilityLabel="Chon.Love — về Tìm kiếm"
            accessibilityRole="button"
            onPointerEnter={() => setHoveredKey('brand')}
            onPointerLeave={() => setHoveredKey(null)}
            onPress={navigateHome}
            style={({ pressed }) => [styles.brandButton, hoveredKey === 'brand' && styles.brandButtonHover, pressed && styles.pressed]}
          >
            <ChonLoveLogo height={50} width={150} />
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
                    <Text accessibilityElementsHidden style={[styles.navIcon, upgrade && styles.upgradeIcon]}>{item.symbol}</Text>
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
                accessibilityLabel="Mở menu tài khoản"
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
                <View style={styles.accountAvatar}><Text style={styles.accountAvatarText}>●</Text></View>
                <Text style={styles.accountLabel}>Tài khoản</Text>
                <Text accessibilityElementsHidden style={styles.chevron}>{accountOpen ? '⌃' : '⌄'}</Text>
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
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.menuLabel}>{item.label}</Text>
                      </Pressable>
                    );
                  })}
                  <View style={styles.menuDivider} />
                  <Text style={styles.menuNote}>Hồ sơ & cài đặt tài khoản</Text>
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
    backgroundColor: luxyColors.charcoal,
    flexDirection: 'row',
    gap: 8,
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: luxySpacing.lg,
  },
  promoHeart: { color: luxyColors.brandGold, fontSize: 14, fontWeight: '700' },
  promoText: { color: luxyColors.surface, fontSize: 12.5, lineHeight: 17 },
  promoStrong: { color: luxyColors.brandGold, fontWeight: '700' },
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
    borderRadius: luxyRadii.sm,
    justifyContent: 'center',
    marginVertical: 6,
    minWidth: 178,
    paddingHorizontal: 12,
  },
  brandButtonHover: { backgroundColor: luxyColors.brandWarmSurface },
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
  navItemHover: { backgroundColor: luxyColors.brandWarmSurface },
  iconWrap: { alignItems: 'center', justifyContent: 'center', minHeight: 24, minWidth: 24, position: 'relative' },
  navIcon: { color: luxyColors.brandGoldStrong, fontSize: 20, fontWeight: '700', lineHeight: 22, textAlign: 'center' },
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
  upgradeItemHover: { backgroundColor: '#A81415' },
  upgradeIcon: { color: luxyColors.brandGold },
  upgradeLabel: { color: luxyColors.surface, fontWeight: '700' },
  accountWrap: { justifyContent: 'center', minWidth: 174, position: 'relative' },
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
  accountButtonHover: { backgroundColor: luxyColors.brandWarmSurface },
  accountAvatar: {
    alignItems: 'center',
    backgroundColor: luxyColors.surface,
    borderColor: luxyColors.brandGold,
    borderRadius: luxyRadii.pill,
    borderWidth: 2,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  accountAvatarText: { color: luxyColors.brandGoldStrong, fontSize: 12 },
  accountLabel: { color: luxyColors.charcoal, fontSize: 14, fontWeight: '600' },
  chevron: { color: luxyColors.muted, fontSize: 13 },
  accountMenu: {
    backgroundColor: luxyColors.surface,
    borderColor: luxyColors.border,
    borderRadius: luxyRadii.md,
    borderWidth: 1,
    minWidth: 230,
    paddingVertical: luxySpacing.sm,
    position: 'absolute',
    right: 0,
    top: 61,
    zIndex: 160,
    ...luxyShadows.navigation,
  },
  menuItem: { justifyContent: 'center', minHeight: 44, paddingHorizontal: luxySpacing.lg },
  menuItemHover: { backgroundColor: luxyColors.brandWarmSurface },
  menuLabel: { color: luxyColors.charcoal, fontSize: 14, fontWeight: '500' },
  menuDivider: { backgroundColor: luxyColors.border, height: StyleSheet.hairlineWidth, marginVertical: luxySpacing.sm },
  menuNote: { color: luxyColors.softMuted, fontSize: 11, lineHeight: 15, paddingHorizontal: luxySpacing.lg, paddingVertical: 4 },
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
  loginButtonHover: { backgroundColor: luxyColors.brandRedSurface },
  loginText: { color: luxyColors.actionRed, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
