import {
  luxyBreakpoints,
  luxyBrand,
  luxyColors,
  luxyLayout,
  luxyRadii,
  luxyShadows,
  luxySpacing,
  luxyTypography,
} from '@myfan/ui';
import { usePathname, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

const primaryItems = [
  { key: 'search', label: 'Tìm kiếm', compactLabel: 'Tìm', href: '/(tabs)' as const, pending: false },
  { key: 'favorites', label: 'Yêu thích', compactLabel: 'Yêu thích', href: null, pending: true },
  { key: 'messages', label: 'Tin nhắn', compactLabel: 'Tin', href: '/(tabs)/friends' as const, pending: false },
  { key: 'upgrade', label: 'Nâng cấp', compactLabel: 'Nâng cấp', href: null, pending: true },
] as const;

const accountItems = [
  { label: 'Hồ sơ', href: '/(tabs)/profile' as const },
  { label: 'Hoạt động', href: '/(tabs)/activity' as const },
  { label: 'Quà', href: '/(tabs)/gifts' as const },
  { label: 'Số dư', href: '/(tabs)/balance' as const },
] as const;

type PrimaryItem = (typeof primaryItems)[number];

function isPrimaryActive(key: PrimaryItem['key'], pathname: string): boolean {
  if (key === 'search') return pathname === '/' || pathname === '/index';
  if (key === 'messages') return pathname.startsWith('/friends') || pathname.startsWith('/chat');
  return false;
}

function isAccountRoute(pathname: string): boolean {
  return ['/profile', '/activity', '/gifts', '/balance'].some((route) => pathname.startsWith(route));
}

export function LuxyShellNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const [accountOpen, setAccountOpen] = useState(false);
  const desktop = width >= luxyBreakpoints.desktop;

  const navigateHome = () => {
    setAccountOpen(false);
    router.replace('/(tabs)');
  };

  const renderPrimaryItem = (item: PrimaryItem, compact: boolean) => {
    const active = isPrimaryActive(item.key, pathname);
    const isUpgrade = item.key === 'upgrade';

    return (
      <Pressable
        accessibilityHint={item.pending ? 'Tính năng sẽ được kích hoạt ở phiên Luxy tiếp theo.' : undefined}
        accessibilityRole="button"
        accessibilityState={{ disabled: item.pending, selected: active }}
        disabled={item.pending}
        key={item.key}
        onPress={() => {
          if (!item.href) return;
          setAccountOpen(false);
          router.push(item.href);
        }}
        style={({ pressed }) => [
          styles.navigationItem,
          compact && styles.compactNavigationItem,
          active && styles.navigationItemActive,
          isUpgrade && styles.upgradeItem,
          compact && isUpgrade && styles.compactUpgradeItem,
          item.pending && !isUpgrade && styles.pendingItem,
          pressed && styles.pressed,
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.navigationLabel,
            active && styles.navigationLabelActive,
            isUpgrade && styles.upgradeLabel,
          ]}
        >
          {compact ? item.compactLabel : item.label}
        </Text>
      </Pressable>
    );
  };

  const accountControl = (compact: boolean) => (
    <Pressable
      accessibilityLabel="Mở menu tài khoản Luxy"
      accessibilityRole="button"
      accessibilityState={{ expanded: accountOpen, selected: isAccountRoute(pathname) }}
      onPress={() => setAccountOpen((value) => !value)}
      style={({ pressed }) => [
        styles.accountButton,
        compact && styles.compactAccountButton,
        isAccountRoute(pathname) && styles.accountButtonActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.accountAvatar}>
        <Text style={styles.accountAvatarText}>L</Text>
      </View>
      {!compact ? <Text numberOfLines={1} style={styles.accountLabel}>Tài khoản</Text> : null}
      <Text accessibilityElementsHidden style={styles.accountChevron}>{accountOpen ? '⌃' : '⌄'}</Text>
    </Pressable>
  );

  const accountMenu = (
    accountOpen ? (
      <View accessibilityRole="menu" style={styles.accountMenu}>
        {accountItems.map((item) => (
          <Pressable
            accessibilityRole="menuitem"
            key={item.label}
            onPress={() => {
              setAccountOpen(false);
              router.push(item.href);
            }}
            style={({ pressed }) => [styles.accountMenuItem, pressed && styles.accountMenuItemPressed]}
          >
            <Text style={styles.accountMenuLabel}>{item.label}</Text>
          </Pressable>
        ))}
        <View style={styles.accountMenuDivider} />
        <Text style={styles.accountMenuNote}>Luxy.Love · authenticated shell LX-03</Text>
      </View>
    ) : null
  );

  if (!desktop) {
    return (
      <View style={styles.shellHeader}>
        <View style={styles.navigationRow}>
          <Pressable
            accessibilityLabel="Luxy.Love — về Tìm kiếm"
            accessibilityRole="button"
            onPress={navigateHome}
            style={({ pressed }) => [styles.brandButton, styles.compactBrandButton, pressed && styles.pressed]}
          >
            <Text numberOfLines={1} style={[styles.brandText, styles.compactBrandText]}>{luxyBrand.shortName}</Text>
          </Pressable>

          <ScrollView
            contentContainerStyle={styles.compactPrimaryNavigation}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.primaryNavigationScroller}
          >
            {primaryItems.map((item) => renderPrimaryItem(item, true))}
          </ScrollView>

          {accountControl(true)}
          {accountMenu}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.shellHeader}>
      <View style={styles.promoStrip}>
        <Text style={styles.promoText}>
          <Text style={styles.promoStrong}>Nâng cấp ngay</Text> để mở toàn bộ trải nghiệm nhắn tin
        </Text>
      </View>

      <View style={styles.navigationRow}>
        <View style={styles.desktopNavigationInner}>
          <Pressable
            accessibilityLabel="Luxy.Love — về Tìm kiếm"
            accessibilityRole="button"
            onPress={navigateHome}
            style={({ pressed }) => [styles.brandButton, styles.desktopBrandButton, pressed && styles.pressed]}
          >
            <Text numberOfLines={1} style={styles.brandText}>{luxyBrand.productName}</Text>
          </Pressable>

          <View style={styles.desktopPrimaryNavigation}>
            {primaryItems.map((item) => renderPrimaryItem(item, false))}
          </View>

          {accountControl(false)}
          {accountMenu}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shellHeader: {
    backgroundColor: luxyColors.surface,
    zIndex: 100,
  },
  promoStrip: {
    alignItems: 'center',
    backgroundColor: luxyColors.ink,
    height: luxyLayout.authenticatedPromoHeight,
    justifyContent: 'center',
    paddingHorizontal: luxySpacing.lg,
  },
  promoText: {
    color: luxyColors.surface,
    fontSize: 14,
    lineHeight: 18,
  },
  promoStrong: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  navigationRow: {
    alignItems: 'stretch',
    backgroundColor: luxyColors.surface,
    height: luxyLayout.authenticatedNavHeight,
    position: 'relative',
    ...luxyShadows.navigation,
  },
  desktopNavigationInner: {
    alignSelf: 'center',
    flex: 1,
    flexDirection: 'row',
    maxWidth: luxyLayout.contentMaxWidth,
    position: 'relative',
    width: '100%',
  },
  brandButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: luxySpacing.lg,
  },
  desktopBrandButton: {
    minWidth: 188,
    paddingHorizontal: luxySpacing.xl,
  },
  compactBrandButton: {
    minWidth: 76,
    paddingHorizontal: luxySpacing.md,
  },
  brandText: {
    color: luxyColors.brandCoral,
    fontFamily: luxyTypography.families.brand,
    fontSize: 27,
    fontWeight: '400',
    letterSpacing: -1.4,
  },
  compactBrandText: {
    fontSize: 23,
    letterSpacing: -1,
  },
  desktopPrimaryNavigation: {
    alignItems: 'stretch',
    flex: 1,
    flexDirection: 'row',
  },
  primaryNavigationScroller: {
    flex: 1,
  },
  compactPrimaryNavigation: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },
  navigationItem: {
    alignItems: 'center',
    borderBottomColor: 'transparent',
    borderBottomWidth: 3,
    justifyContent: 'center',
    minHeight: luxyLayout.authenticatedNavHeight,
    minWidth: 104,
    paddingHorizontal: luxySpacing.xl,
  },
  compactNavigationItem: {
    minWidth: 68,
    paddingHorizontal: luxySpacing.md,
  },
  navigationItemActive: {
    backgroundColor: luxyColors.subtleSurface,
    borderBottomColor: luxyColors.ink,
  },
  navigationLabel: {
    color: luxyColors.text,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
  },
  navigationLabelActive: {
    fontWeight: '700',
  },
  upgradeItem: {
    alignSelf: 'center',
    backgroundColor: luxyColors.actionRed,
    borderBottomWidth: 0,
    borderRadius: luxyRadii.pill,
    marginHorizontal: luxySpacing.sm,
    minHeight: 36,
    minWidth: 108,
    paddingHorizontal: luxySpacing.lg,
  },
  compactUpgradeItem: {
    minWidth: 92,
  },
  upgradeLabel: {
    color: luxyColors.surface,
    fontWeight: '600',
  },
  pendingItem: {
    opacity: 0.72,
  },
  accountButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: luxySpacing.sm,
    justifyContent: 'center',
    minWidth: 164,
    paddingHorizontal: luxySpacing.xl,
  },
  compactAccountButton: {
    minWidth: 64,
    paddingHorizontal: luxySpacing.md,
  },
  accountButtonActive: {
    backgroundColor: luxyColors.subtleSurface,
  },
  accountAvatar: {
    alignItems: 'center',
    backgroundColor: luxyColors.elevatedSubtle,
    borderColor: luxyColors.border,
    borderRadius: luxyRadii.pill,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  accountAvatarText: {
    color: luxyColors.muted,
    fontFamily: luxyTypography.families.display,
    fontSize: 20,
  },
  accountLabel: {
    color: luxyColors.text,
    fontSize: 16,
    fontWeight: '500',
    maxWidth: 110,
  },
  accountChevron: {
    color: luxyColors.text,
    fontSize: 15,
  },
  accountMenu: {
    backgroundColor: luxyColors.surface,
    borderColor: luxyColors.border,
    borderRadius: luxyRadii.sm,
    borderWidth: 1,
    minWidth: 224,
    paddingVertical: luxySpacing.sm,
    position: 'absolute',
    right: luxySpacing.md,
    top: luxyLayout.authenticatedNavHeight - 2,
    zIndex: 120,
    ...luxyShadows.navigation,
  },
  accountMenuItem: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: luxySpacing.lg,
  },
  accountMenuItemPressed: {
    backgroundColor: luxyColors.subtleSurface,
  },
  accountMenuLabel: {
    color: luxyColors.text,
    fontSize: 15,
  },
  accountMenuDivider: {
    backgroundColor: luxyColors.border,
    height: StyleSheet.hairlineWidth,
    marginVertical: luxySpacing.sm,
  },
  accountMenuNote: {
    color: luxyColors.softMuted,
    fontSize: 11,
    lineHeight: 15,
    paddingHorizontal: luxySpacing.lg,
    paddingVertical: luxySpacing.xs,
  },
  pressed: {
    opacity: 0.72,
  },
});
