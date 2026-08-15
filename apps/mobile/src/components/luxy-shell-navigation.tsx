import {
  getMyLuxyMembershipSnapshot,
  listLuxyInterests,
  listLuxyMailbox,
} from '@myfan/supabase';
import {
  luxyBrand,
  luxyColors,
  luxyLayout,
  luxyRadii,
  luxyShadows,
  luxySpacing,
  luxyTypography,
  resolveLuxyResponsiveShellMode,
} from '@myfan/ui';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { getMobileSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const primaryItems = [
  { key: 'search', label: 'Kết nối', href: '/(tabs)' as const },
  { key: 'favorites', label: 'Yêu thích', symbol: '♥', href: '/(tabs)/favorites' as const },
  { key: 'messages', label: 'Tin nhắn', symbol: '▤', href: '/(tabs)/messages' as const },
  { key: 'upgrade', label: 'Nâng cấp', symbol: '↑', href: '/settings/membership' as const },
] as const;

const accountItems = [
  { label: 'Hồ sơ', href: '/(tabs)/profile' as const },
  { label: 'Quà', href: '/(tabs)/gifts' as const },
  { label: 'Số dư', href: '/(tabs)/balance' as const },
  { label: 'Cài đặt', href: '/settings' as const },
] as const;

type PrimaryItem = (typeof primaryItems)[number];
type ShellVariant = 'phone' | 'tablet' | 'desktop';

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

function ConnectionIcon({ compact = false }: { compact?: boolean }) {
  return (
    <View accessibilityElementsHidden style={[styles.connectionIcon, compact && styles.connectionIconCompact]}>
      <View style={[styles.connectionLine, compact && styles.connectionLineCompact]} />
      <View style={[styles.connectionNode, styles.connectionNodeLeft, compact && styles.connectionNodeCompact]} />
      <View style={[styles.connectionNode, styles.connectionNodeRight, compact && styles.connectionNodeCompact]} />
    </View>
  );
}

export function LuxyShellNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const auth = useAuth();
  const client = getMobileSupabaseClient();
  const [accountOpen, setAccountOpen] = useState(false);
  const shellMode = resolveLuxyResponsiveShellMode(width);

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

  const isFreeMembership = membershipQuery.data?.tier === 'free';

  const badgeFor = (key: PrimaryItem['key']) => {
    if (key === 'favorites') return interestsBadgeQuery.data ?? 0;
    if (key === 'messages') return messagesBadgeQuery.data ?? 0;
    return 0;
  };

  const navigateHome = () => {
    setAccountOpen(false);
    router.replace('/(tabs)');
  };

  const upgradePromo = isFreeMembership ? (
    <Pressable
      accessibilityLabel="Nâng cấp ngay để gửi tin nhắn"
      accessibilityRole="button"
      onPress={() => router.push('/settings/membership')}
      style={({ pressed }) => [styles.promo, pressed && styles.promoPressed]}
      testID="luxy-free-upgrade-promo"
    >
      <Text style={styles.promoText}>
        <Text style={styles.promoStrong}>Nâng cấp ngay</Text> để gửi tin nhắn
      </Text>
    </Pressable>
  ) : null;

  const primaryItem = (item: PrimaryItem, variant: ShellVariant) => {
    const active = isPrimaryActive(item.key, pathname);
    const upgrade = item.key === 'upgrade';
    const phone = variant === 'phone';
    const tablet = variant === 'tablet';
    const badge = badgeFor(item.key);
    return (
      <Pressable
        accessibilityLabel={item.label}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        key={item.key}
        onPress={() => {
          setAccountOpen(false);
          router.push(item.href);
        }}
        style={({ pressed }) => [
          styles.navItem,
          phone && styles.phoneNavItem,
          tablet && styles.tabletNavItem,
          active && styles.navActive,
          phone && active && !upgrade && styles.phoneNavActive,
          upgrade && styles.upgrade,
          phone && upgrade && styles.phoneUpgrade,
          tablet && upgrade && styles.tabletUpgrade,
          pressed && styles.pressed,
        ]}
      >
        {upgrade ? (
          <Text numberOfLines={1} style={[styles.navText, styles.upgradeText]}>{item.label}</Text>
        ) : (
          <View style={[styles.navStack, phone && styles.phoneNavStack]}>
            <View style={styles.symbolWrap}>
              {item.key === 'search' ? (
                <ConnectionIcon compact={phone} />
              ) : (
                <Text accessibilityElementsHidden style={[styles.navSymbol, phone && styles.phoneSymbol]}>{item.symbol}</Text>
              )}
              {badge > 0 ? (
                <View accessibilityElementsHidden style={styles.navBadge}>
                  <Text accessibilityElementsHidden style={styles.navBadgeText}>{badge > 99 ? '99+' : badge}</Text>
                </View>
              ) : null}
            </View>
            <Text numberOfLines={1} style={[styles.navText, phone && styles.phoneNavText, active && styles.navTextActive]}>{item.label}</Text>
          </View>
        )}
      </Pressable>
    );
  };

  const accountControl = (variant: ShellVariant) => {
    const phone = variant === 'phone';
    const tablet = variant === 'tablet';
    return (
      <Pressable
        accessibilityLabel="Mở menu tài khoản Chọn.love"
        accessibilityRole="button"
        accessibilityState={{ expanded: accountOpen, selected: isAccountRoute(pathname) }}
        onPress={() => setAccountOpen((value) => !value)}
        style={({ pressed }) => [
          styles.accountButton,
          phone && styles.phoneAccountButton,
          tablet && styles.tabletAccountButton,
          isAccountRoute(pathname) && styles.accountActive,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.avatar, phone && styles.phoneAvatar]}>
          <Text style={[styles.avatarText, phone && styles.phoneAvatarText]}>C</Text>
        </View>
        {variant === 'desktop' ? <Text style={styles.accountLabel}>Tài khoản</Text> : null}
        <Text accessibilityElementsHidden style={styles.chevron}>{accountOpen ? '⌃' : '⌄'}</Text>
      </Pressable>
    );
  };

  const accountMenu = (variant: ShellVariant) => accountOpen ? (
    <View
      accessibilityRole="menu"
      style={[
        styles.accountMenu,
        variant === 'phone' && styles.phoneMenu,
        variant === 'phone' && isFreeMembership && styles.phoneMenuWithPromo,
        variant === 'tablet' && styles.tabletMenu,
      ]}
    >
      {accountItems.map((item) => (
        <Pressable
          accessibilityRole="menuitem"
          key={item.label}
          onPress={() => {
            setAccountOpen(false);
            router.push(item.href);
          }}
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
        >
          <Text style={styles.menuLabel}>{item.label}</Text>
        </Pressable>
      ))}
      <View style={styles.menuDivider} />
      <Text style={styles.menuNote}>Chọn.love · hồ sơ & cài đặt</Text>
    </View>
  ) : null;

  if (shellMode === 'phone') {
    return (
      <View style={styles.shell}>
        <View style={styles.phoneTopRow}>
          <Pressable accessibilityLabel="Chọn.love — về Kết nối" accessibilityRole="button" onPress={navigateHome} style={({ pressed }) => [styles.phoneBrandButton, pressed && styles.pressed]}>
            <Text numberOfLines={1} style={[styles.brand, styles.phoneBrand]}>{width < 430 ? luxyBrand.shortName : luxyBrand.productName}</Text>
          </Pressable>
          {accountControl('phone')}
          {accountMenu('phone')}
        </View>
        {upgradePromo}
        <View style={styles.phoneNavRow}>{primaryItems.map((item) => primaryItem(item, 'phone'))}</View>
      </View>
    );
  }

  if (shellMode === 'tablet') {
    return (
      <View style={styles.shell}>
        {upgradePromo}
        <View style={styles.navRow}>
          <View style={styles.tabletInner}>
            <Pressable accessibilityLabel="Chọn.love — về Kết nối" accessibilityRole="button" onPress={navigateHome} style={({ pressed }) => [styles.brandButton, styles.tabletBrandButton, pressed && styles.pressed]}>
              <Text numberOfLines={1} style={[styles.brand, styles.tabletBrand]}>{luxyBrand.shortName}</Text>
            </Pressable>
            <View style={styles.tabletPrimary}>{primaryItems.map((item) => primaryItem(item, 'tablet'))}</View>
            {accountControl('tablet')}
            {accountMenu('tablet')}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      {upgradePromo}
      <View style={styles.navRow}>
        <View style={styles.desktopInner}>
          <Pressable accessibilityLabel="Chọn.love — về Kết nối" accessibilityRole="button" onPress={navigateHome} style={({ pressed }) => [styles.brandButton, styles.desktopBrandButton, pressed && styles.pressed]}>
            <Text numberOfLines={1} style={styles.brand}>{luxyBrand.productName}</Text>
          </Pressable>
          <View style={styles.desktopPrimary}>{primaryItems.map((item) => primaryItem(item, 'desktop'))}</View>
          {accountControl('desktop')}
          {accountMenu('desktop')}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { backgroundColor: luxyColors.surface, position: 'relative', zIndex: 100 },
  promo: { alignItems: 'center', backgroundColor: '#090909', height: luxyLayout.authenticatedPromoHeight, justifyContent: 'center', paddingHorizontal: luxySpacing.lg },
  promoPressed: { backgroundColor: '#1A1A1A' },
  promoText: { color: luxyColors.surface, fontSize: 14, lineHeight: 18 },
  promoStrong: { fontWeight: '800', textDecorationLine: 'underline' },
  navRow: { alignItems: 'stretch', backgroundColor: luxyColors.surface, height: luxyLayout.authenticatedNavHeight, position: 'relative', ...luxyShadows.navigation },
  desktopInner: { alignSelf: 'center', flex: 1, flexDirection: 'row', maxWidth: luxyLayout.contentMaxWidth, position: 'relative', width: '100%' },
  tabletInner: { flex: 1, flexDirection: 'row', minWidth: 0, position: 'relative', width: '100%' },
  brandButton: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: luxySpacing.lg },
  desktopBrandButton: { minWidth: 188, paddingHorizontal: luxySpacing.xl },
  tabletBrandButton: { minWidth: 104, paddingHorizontal: luxySpacing.md },
  phoneBrandButton: { alignItems: 'center', height: luxyLayout.authenticatedPhoneTopHeight, justifyContent: 'center', minWidth: 76, paddingHorizontal: luxySpacing.lg },
  brand: { color: luxyColors.brandCoral, fontFamily: luxyTypography.families.brand, fontSize: 27, fontWeight: '400', letterSpacing: -1.4 },
  tabletBrand: { fontSize: 23, letterSpacing: -1 },
  phoneBrand: { fontSize: 24, letterSpacing: -1.1 },
  desktopPrimary: { alignItems: 'stretch', flex: 1, flexDirection: 'row' },
  tabletPrimary: { alignItems: 'stretch', flex: 1, flexDirection: 'row', minWidth: 0 },
  phoneTopRow: { alignItems: 'center', backgroundColor: luxyColors.surface, borderBottomColor: luxyColors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', height: luxyLayout.authenticatedPhoneTopHeight, justifyContent: 'space-between', position: 'relative', zIndex: 110 },
  phoneNavRow: { alignItems: 'stretch', backgroundColor: luxyColors.brandRedSurface, flexDirection: 'row', height: luxyLayout.authenticatedPhoneNavHeight, width: '100%', ...luxyShadows.navigation },
  navItem: { alignItems: 'center', borderBottomColor: 'transparent', borderBottomWidth: 3, justifyContent: 'center', minHeight: luxyLayout.authenticatedNavHeight, minWidth: 92, paddingHorizontal: luxySpacing.lg },
  tabletNavItem: { flex: 1, minWidth: 0, paddingHorizontal: luxySpacing.xs },
  phoneNavItem: { flex: 1, minHeight: luxyLayout.authenticatedPhoneNavHeight, minWidth: 0, paddingHorizontal: luxySpacing.xs, paddingVertical: 2 },
  navActive: { backgroundColor: luxyColors.subtleSurface, borderBottomColor: luxyColors.ink },
  phoneNavActive: { backgroundColor: luxyColors.surface, borderBottomColor: luxyColors.actionRed },
  navStack: { alignItems: 'center', gap: 1, justifyContent: 'center' },
  phoneNavStack: { gap: 0 },
  symbolWrap: { alignItems: 'center', justifyContent: 'center', minHeight: 21, minWidth: 24, position: 'relative' },
  navSymbol: { color: luxyColors.ink, fontSize: 20, fontWeight: '700', lineHeight: 21 },
  connectionIcon: { height: 21, position: 'relative', width: 28 },
  connectionIconCompact: { height: 18, width: 24 },
  connectionLine: { backgroundColor: luxyColors.ink, height: 2, left: 7, position: 'absolute', top: 10, transform: [{ rotate: '-16deg' }], width: 14 },
  connectionLineCompact: { left: 6, top: 8, width: 12 },
  connectionNode: { backgroundColor: luxyColors.surface, borderColor: luxyColors.ink, borderRadius: 6, borderWidth: 2, height: 10, position: 'absolute', top: 5, width: 10 },
  connectionNodeCompact: { borderRadius: 5, height: 9, top: 4, width: 9 },
  connectionNodeLeft: { left: 1 },
  connectionNodeRight: { right: 1 },
  navBadge: { alignItems: 'center', backgroundColor: luxyColors.brandCoral, borderRadius: 5, justifyContent: 'center', minHeight: 15, minWidth: 15, paddingHorizontal: 3, position: 'absolute', right: -8, top: -3 },
  navBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  navText: { color: luxyColors.text, fontSize: 14, fontWeight: '400', lineHeight: 18 },
  phoneNavText: { fontSize: 10.5, lineHeight: 13 },
  phoneSymbol: { fontSize: 17, lineHeight: 18 },
  navTextActive: { fontWeight: '700' },
  upgrade: { alignSelf: 'center', backgroundColor: luxyColors.actionRed, borderBottomWidth: 0, borderRadius: luxyRadii.pill, marginHorizontal: luxySpacing.sm, minHeight: 36, minWidth: 100, paddingHorizontal: luxySpacing.lg },
  tabletUpgrade: { flex: 1, marginHorizontal: luxySpacing.xs, minHeight: 44, minWidth: 0, paddingHorizontal: luxySpacing.sm },
  phoneUpgrade: { alignSelf: 'center', flex: 1, marginHorizontal: luxySpacing.xs, minHeight: 44, minWidth: 0, paddingHorizontal: luxySpacing.xs, paddingVertical: 2 },
  upgradeText: { color: luxyColors.surface, fontWeight: '700' },
  accountButton: { alignItems: 'center', flexDirection: 'row', gap: luxySpacing.sm, justifyContent: 'center', minWidth: 164, paddingHorizontal: luxySpacing.xl },
  tabletAccountButton: { minWidth: 64, paddingHorizontal: luxySpacing.sm },
  phoneAccountButton: { height: luxyLayout.authenticatedPhoneTopHeight, minWidth: 60, paddingHorizontal: luxySpacing.md },
  accountActive: { backgroundColor: luxyColors.subtleSurface },
  avatar: { alignItems: 'center', backgroundColor: luxyColors.elevatedSubtle, borderColor: luxyColors.border, borderRadius: luxyRadii.pill, borderWidth: 1, height: 42, justifyContent: 'center', width: 42 },
  phoneAvatar: { height: 36, width: 36 },
  avatarText: { color: luxyColors.muted, fontFamily: luxyTypography.families.display, fontSize: 20 },
  phoneAvatarText: { fontSize: 17 },
  accountLabel: { color: luxyColors.text, fontSize: 16, fontWeight: '500', maxWidth: 110 },
  chevron: { color: luxyColors.text, fontSize: 15 },
  accountMenu: { backgroundColor: luxyColors.surface, borderColor: luxyColors.border, borderRadius: luxyRadii.sm, borderWidth: 1, minWidth: 224, paddingVertical: luxySpacing.sm, position: 'absolute', right: luxySpacing.md, top: luxyLayout.authenticatedNavHeight - 2, zIndex: 140, ...luxyShadows.navigation },
  phoneMenu: { maxWidth: 280, minWidth: 216, right: luxySpacing.sm, top: luxyLayout.authenticatedPhoneTopHeight + luxyLayout.authenticatedPhoneNavHeight - 2 },
  phoneMenuWithPromo: { top: luxyLayout.authenticatedPhoneTopHeight + luxyLayout.authenticatedPhoneNavHeight + luxyLayout.authenticatedPromoHeight - 2 },
  tabletMenu: { right: luxySpacing.sm },
  menuItem: { justifyContent: 'center', minHeight: 44, paddingHorizontal: luxySpacing.lg },
  menuItemPressed: { backgroundColor: luxyColors.subtleSurface },
  menuLabel: { color: luxyColors.text, fontSize: 15 },
  menuDivider: { backgroundColor: luxyColors.border, height: StyleSheet.hairlineWidth, marginVertical: luxySpacing.sm },
  menuNote: { color: luxyColors.softMuted, fontSize: 11, lineHeight: 15, paddingHorizontal: luxySpacing.lg, paddingVertical: luxySpacing.xs },
  pressed: { opacity: 0.72 },
});
