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
import { usePathname, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

const primaryItems = [
  { key: 'search', label: 'Tìm kiếm', symbol: '⌕', href: '/(tabs)' as const, pending: false },
  { key: 'favorites', label: 'Yêu thích', symbol: '♡', href: null, pending: true },
  { key: 'messages', label: 'Tin nhắn', symbol: '✉︎', href: '/(tabs)/friends' as const, pending: false },
  { key: 'upgrade', label: 'Nâng cấp', symbol: '↑', href: null, pending: true },
] as const;

const accountItems = [
  { label: 'Hồ sơ', href: '/(tabs)/profile' as const },
  { label: 'Hoạt động', href: '/(tabs)/activity' as const },
  { label: 'Quà', href: '/(tabs)/gifts' as const },
  { label: 'Số dư', href: '/(tabs)/balance' as const },
] as const;

type PrimaryItem = (typeof primaryItems)[number];
type ShellVariant = 'phone' | 'tablet' | 'desktop';

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
  const shellMode = resolveLuxyResponsiveShellMode(width);
  const compactPhone = width < 430;

  const navigateHome = () => {
    setAccountOpen(false);
    router.replace('/(tabs)');
  };

  const renderPrimaryItem = (item: PrimaryItem, variant: ShellVariant) => {
    const active = isPrimaryActive(item.key, pathname);
    const isUpgrade = item.key === 'upgrade';
    const phone = variant === 'phone';
    const tablet = variant === 'tablet';

    return (
      <Pressable
        accessibilityHint={item.pending ? 'Tính năng sẽ được kích hoạt ở phiên Luxy tiếp theo.' : undefined}
        accessibilityLabel={item.label}
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
          phone && styles.phoneNavigationItem,
          tablet && styles.tabletNavigationItem,
          active && styles.navigationItemActive,
          isUpgrade && styles.upgradeItem,
          phone && isUpgrade && styles.phoneUpgradeItem,
          tablet && isUpgrade && styles.tabletUpgradeItem,
          item.pending && !isUpgrade && styles.pendingItem,
          pressed && styles.pressed,
        ]}
      >
        {phone ? (
          <>
            <Text
              accessibilityElementsHidden
              style={[
                styles.phoneNavigationSymbol,
                isUpgrade && styles.upgradeLabel,
              ]}
            >
              {item.symbol}
            </Text>
            <Text
              numberOfLines={1}
              style={[
                styles.navigationLabel,
                styles.phoneNavigationLabel,
                active && styles.navigationLabelActive,
                isUpgrade && styles.upgradeLabel,
              ]}
            >
              {item.label}
            </Text>
          </>
        ) : (
          <Text
            numberOfLines={1}
            style={[
              styles.navigationLabel,
              active && styles.navigationLabelActive,
              isUpgrade && styles.upgradeLabel,
            ]}
          >
            {item.label}
          </Text>
        )}
      </Pressable>
    );
  };

  const accountControl = (variant: ShellVariant) => {
    const phone = variant === 'phone';
    const tablet = variant === 'tablet';
    const desktop = variant === 'desktop';

    return (
      <Pressable
        accessibilityLabel="Mở menu tài khoản Luxy"
        accessibilityRole="button"
        accessibilityState={{ expanded: accountOpen, selected: isAccountRoute(pathname) }}
        onPress={() => setAccountOpen((value) => !value)}
        style={({ pressed }) => [
          styles.accountButton,
          phone && styles.phoneAccountButton,
          tablet && styles.tabletAccountButton,
          isAccountRoute(pathname) && styles.accountButtonActive,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.accountAvatar, phone && styles.phoneAccountAvatar]}>
          <Text style={[styles.accountAvatarText, phone && styles.phoneAccountAvatarText]}>L</Text>
        </View>
        {desktop ? <Text numberOfLines={1} style={styles.accountLabel}>Tài khoản</Text> : null}
        <Text accessibilityElementsHidden style={styles.accountChevron}>{accountOpen ? '⌃' : '⌄'}</Text>
      </Pressable>
    );
  };

  const renderAccountMenu = (variant: ShellVariant) => {
    if (!accountOpen) return null;

    return (
      <View
        accessibilityRole="menu"
        style={[
          styles.accountMenu,
          variant === 'phone' && styles.phoneAccountMenu,
          variant === 'tablet' && styles.tabletAccountMenu,
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
            style={({ pressed }) => [styles.accountMenuItem, pressed && styles.accountMenuItemPressed]}
          >
            <Text style={styles.accountMenuLabel}>{item.label}</Text>
          </Pressable>
        ))}
        <View style={styles.accountMenuDivider} />
        <Text style={styles.accountMenuNote}>Luxy.Love · responsive shell LX-04</Text>
      </View>
    );
  };

  if (shellMode === 'phone') {
    return (
      <View style={styles.shellHeader}>
        <View style={styles.phoneTopRow}>
          <Pressable
            accessibilityLabel="Luxy.Love — về Tìm kiếm"
            accessibilityRole="button"
            onPress={navigateHome}
            style={({ pressed }) => [styles.phoneBrandButton, pressed && styles.pressed]}
          >
            <Text numberOfLines={1} style={[styles.brandText, styles.phoneBrandText]}>
              {compactPhone ? luxyBrand.shortName : luxyBrand.productName}
            </Text>
          </Pressable>
          {accountControl('phone')}
          {renderAccountMenu('phone')}
        </View>

        <View accessibilityRole="navigation" style={styles.phonePrimaryNavigation}>
          {primaryItems.map((item) => renderPrimaryItem(item, 'phone'))}
        </View>
      </View>
    );
  }

  if (shellMode === 'tablet') {
    return (
      <View style={styles.shellHeader}>
        <View style={styles.navigationRow}>
          <View style={styles.tabletNavigationInner}>
            <Pressable
              accessibilityLabel="Luxy.Love — về Tìm kiếm"
              accessibilityRole="button"
              onPress={navigateHome}
              style={({ pressed }) => [styles.brandButton, styles.tabletBrandButton, pressed && styles.pressed]}
            >
              <Text numberOfLines={1} style={[styles.brandText, styles.tabletBrandText]}>{luxyBrand.shortName}</Text>
            </Pressable>

            <View accessibilityRole="navigation" style={styles.tabletPrimaryNavigation}>
              {primaryItems.map((item) => renderPrimaryItem(item, 'tablet'))}
            </View>

            {accountControl('tablet')}
            {renderAccountMenu('tablet')}
          </View>
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

          <View accessibilityRole="navigation" style={styles.desktopPrimaryNavigation}>
            {primaryItems.map((item) => renderPrimaryItem(item, 'desktop'))}
          </View>

          {accountControl('desktop')}
          {renderAccountMenu('desktop')}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shellHeader: {
    backgroundColor: luxyColors.surface,
    position: 'relative',
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
  tabletNavigationInner: {
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
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
  tabletBrandButton: {
    minWidth: 104,
    paddingHorizontal: luxySpacing.md,
  },
  phoneBrandButton: {
    alignItems: 'center',
    height: luxyLayout.authenticatedPhoneTopHeight,
    justifyContent: 'center',
    minWidth: 76,
    paddingHorizontal: luxySpacing.lg,
  },
  brandText: {
    color: luxyColors.brandCoral,
    fontFamily: luxyTypography.families.brand,
    fontSize: 27,
    fontWeight: '400',
    letterSpacing: -1.4,
  },
  tabletBrandText: {
    fontSize: 23,
    letterSpacing: -1,
  },
  phoneBrandText: {
    fontSize: 24,
    letterSpacing: -1.1,
  },
  desktopPrimaryNavigation: {
    alignItems: 'stretch',
    flex: 1,
    flexDirection: 'row',
  },
  tabletPrimaryNavigation: {
    alignItems: 'stretch',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  phoneTopRow: {
    alignItems: 'center',
    backgroundColor: luxyColors.surface,
    borderBottomColor: luxyColors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: luxyLayout.authenticatedPhoneTopHeight,
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 110,
  },
  phonePrimaryNavigation: {
    alignItems: 'stretch',
    backgroundColor: luxyColors.surface,
    flexDirection: 'row',
    height: luxyLayout.authenticatedPhoneNavHeight,
    width: '100%',
    ...luxyShadows.navigation,
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
  tabletNavigationItem: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: luxySpacing.sm,
  },
  phoneNavigationItem: {
    flex: 1,
    gap: 1,
    minHeight: luxyLayout.authenticatedPhoneNavHeight,
    minWidth: 0,
    paddingHorizontal: luxySpacing.xs,
    paddingVertical: luxySpacing.xs,
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
  phoneNavigationLabel: {
    fontSize: 11.5,
    lineHeight: 14,
  },
  phoneNavigationSymbol: {
    color: luxyColors.text,
    fontSize: 18,
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
  tabletUpgradeItem: {
    flex: 1,
    marginHorizontal: luxySpacing.xs,
    minWidth: 0,
    paddingHorizontal: luxySpacing.sm,
  },
  phoneUpgradeItem: {
    alignSelf: 'center',
    flex: 1,
    marginHorizontal: luxySpacing.xs,
    minHeight: 44,
    minWidth: 0,
    paddingHorizontal: luxySpacing.xs,
    paddingVertical: 2,
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
  tabletAccountButton: {
    minWidth: 64,
    paddingHorizontal: luxySpacing.sm,
  },
  phoneAccountButton: {
    height: luxyLayout.authenticatedPhoneTopHeight,
    minWidth: 60,
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
  phoneAccountAvatar: {
    height: 36,
    width: 36,
  },
  accountAvatarText: {
    color: luxyColors.muted,
    fontFamily: luxyTypography.families.display,
    fontSize: 20,
  },
  phoneAccountAvatarText: {
    fontSize: 17,
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
    zIndex: 140,
    ...luxyShadows.navigation,
  },
  phoneAccountMenu: {
    maxWidth: 280,
    minWidth: 216,
    right: luxySpacing.sm,
    top: luxyLayout.authenticatedPhoneTopHeight + luxyLayout.authenticatedPhoneNavHeight - 2,
  },
  tabletAccountMenu: {
    right: luxySpacing.sm,
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
