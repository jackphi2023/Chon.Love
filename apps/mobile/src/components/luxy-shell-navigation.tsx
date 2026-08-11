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

function isPrimaryActive(key: (typeof primaryItems)[number]['key'], pathname: string): boolean {
  if (key === 'search') return pathname === '/' || pathname === '/index';
  if (key === 'messages') return pathname.startsWith('/friends') || pathname.startsWith('/chat');
  return false;
}

export function LuxyShellNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const [accountOpen, setAccountOpen] = useState(false);
  const desktop = width >= luxyBreakpoints.mobile;

  return (
    <View style={styles.shellHeader}>
      {desktop ? (
        <View style={styles.promoStrip}>
          <Text style={styles.promoText}>
            <Text style={styles.promoStrong}>Nâng cấp</Text> để mở toàn bộ trải nghiệm nhắn tin
          </Text>
        </View>
      ) : null}

      <View style={styles.navigationRow}>
        <Pressable
          accessibilityLabel="Luxy.Love — về Tìm kiếm"
          accessibilityRole="button"
          onPress={() => {
            setAccountOpen(false);
            router.replace('/(tabs)');
          }}
          style={({ pressed }) => [styles.brandButton, pressed && styles.pressed]}
        >
          <Text numberOfLines={1} style={styles.brandText}>{desktop ? luxyBrand.productName : luxyBrand.shortName}</Text>
        </Pressable>

        <ScrollView
          contentContainerStyle={styles.primaryNavigation}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.primaryNavigationScroller}
        >
          {primaryItems.map((item) => {
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
                  active && styles.navigationItemActive,
                  isUpgrade && styles.upgradeItem,
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
                  {desktop ? item.label : item.compactLabel}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          accessibilityLabel="Mở menu tài khoản Luxy"
          accessibilityRole="button"
          accessibilityState={{ expanded: accountOpen }}
          onPress={() => setAccountOpen((value) => !value)}
          style={({ pressed }) => [styles.accountButton, pressed && styles.pressed]}
        >
          <View style={styles.accountAvatar}><Text style={styles.accountAvatarText}>L</Text></View>
          {desktop ? <Text numberOfLines={1} style={styles.accountLabel}>Tài khoản</Text> : null}
          <Text accessibilityElementsHidden style={styles.accountChevron}>{accountOpen ? '⌃' : '⌄'}</Text>
        </Pressable>

        {accountOpen ? (
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
            <Text style={styles.accountMenuNote}>Luxy.Love UI foundation · LX-02</Text>
          </View>
        ) : null}
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
    flexDirection: 'row',
    height: luxyLayout.authenticatedNavHeight,
    position: 'relative',
    ...luxyShadows.navigation,
  },
  brandButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
    paddingHorizontal: luxySpacing.lg,
  },
  brandText: {
    color: luxyColors.brandCoral,
    fontFamily: luxyTypography.families.brand,
    fontSize: 27,
    fontWeight: '400',
    letterSpacing: -1.4,
  },
  primaryNavigationScroller: {
    flex: 1,
  },
  primaryNavigation: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },
  navigationItem: {
    alignItems: 'center',
    borderBottomColor: 'transparent',
    borderBottomWidth: 3,
    justifyContent: 'center',
    minHeight: luxyLayout.authenticatedNavHeight,
    minWidth: 72,
    paddingHorizontal: luxySpacing.lg,
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
    minWidth: 96,
    paddingHorizontal: luxySpacing.lg,
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
    minWidth: 64,
    paddingHorizontal: luxySpacing.md,
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
    minWidth: 210,
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
